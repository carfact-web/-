import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  indexNowHost,
  indexNowKey,
  indexNowKeyLocation,
  indexNowSitemapUrl,
  isAllowedIndexNowUrl,
} from "@/lib/indexNow";

export const runtime = "nodejs";

const indexNowEndpoint = "https://api.indexnow.org/indexnow";
const maxUrlsPerRequest = 10000;
const retryDelaysMs = [0, 750, 2000];

const sleep = (delayMs: number) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const submitIndexNow = async (urlList: string[]) => {
  let lastStatus = 0;
  let lastBody = "";

  for (const [attemptIndex, delayMs] of retryDelaysMs.entries()) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      const response = await fetch(indexNowEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          host: indexNowHost,
          key: indexNowKey,
          keyLocation: indexNowKeyLocation,
          urlList,
        }),
      });

      lastStatus = response.status;
      lastBody = await response.text().catch(() => "");

      if (response.ok || response.status === 202) {
        return {
          attemptCount: attemptIndex + 1,
          body: lastBody,
          ok: true,
          status: response.status,
        };
      }

      console.warn("indexnow-submit-attempt-failed", {
        attempt: attemptIndex + 1,
        body: lastBody,
        status: response.status,
        urlCount: urlList.length,
      });
    } catch (error) {
      lastBody = error instanceof Error ? error.message : String(error);
      console.warn("indexnow-submit-attempt-error", {
        attempt: attemptIndex + 1,
        error: lastBody,
        urlCount: urlList.length,
      });
    }
  }

  return {
    attemptCount: retryDelaysMs.length,
    body: lastBody,
    ok: false,
    status: lastStatus,
  };
};

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid-json" },
      {
        status: 400,
      },
    );
  }

  const body = payload as { reason?: unknown; urls?: unknown };
  const urls = Array.from(
    new Set([...toStringArray(body.urls), indexNowSitemapUrl]),
  )
    .filter(isAllowedIndexNowUrl)
    .slice(0, maxUrlsPerRequest);

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "no-valid-urls" },
      {
        status: 400,
      },
    );
  }

  revalidatePath("/sitemap.xml");

  const result = await submitIndexNow(urls);

  if (!result.ok) {
    console.error("indexnow-submit-failed", {
      body: result.body,
      reason: typeof body.reason === "string" ? body.reason : "unknown",
      status: result.status,
      urls,
    });
  }

  return NextResponse.json(
    {
      attemptCount: result.attemptCount,
      keyLocation: indexNowKeyLocation,
      ok: result.ok,
      status: result.status,
      submittedUrls: urls,
    },
    {
      status: result.ok ? 200 : 502,
    },
  );
}
