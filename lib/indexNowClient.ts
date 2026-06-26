import { indexNowSitemapUrl } from "@/lib/indexNow";

type NotifyIndexNowInput = {
  reason: string;
  urls: string[];
};

export const notifyIndexNow = async ({ reason, urls }: NotifyIndexNowInput) => {
  const uniqueUrls = Array.from(new Set([...urls, indexNowSitemapUrl]));

  if (uniqueUrls.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/indexnow", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason,
        urls: uniqueUrls,
      }),
      keepalive: true,
    });

    if (!response.ok) {
      console.warn("indexnow-notify-failed", {
        reason,
        status: response.status,
      });
    }
  } catch (error) {
    console.warn("indexnow-notify-error", {
      error,
      reason,
    });
  }
};
