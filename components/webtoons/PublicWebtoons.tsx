"use client";
/* eslint-disable @next/next/no-img-element -- Same-origin no-store image endpoint rechecks publication on every request. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { PdfViewer, type PdfManifest } from "./PdfViewer";
import { ReaderFrame } from "./ReaderFrame";
import { ImageEpisodeViewer } from "./ImageEpisodeViewer";
import styles from "./Reader.module.css";
import { mediaUrl } from "@/lib/webtoons/client";
import type { WebtoonEpisode, WebtoonWork } from "@/types/webtoon";
interface Data {
  pdf?: PdfManifest | null;
  works?: WebtoonWork[];
  work?: WebtoonWork;
  episodes?: WebtoonEpisode[];
  episode?: WebtoonEpisode;
  pages?: { id: string; width: number; height: number }[];
  previousId?: string | null;
  nextId?: string | null;
}
export function PublicWebtoons({
  workId,
  episodeId,
}: {
  workId?: string;
  episodeId?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const endpoint = episodeId
    ? "/api/webtoons/episodes/" + episodeId
    : workId
      ? "/api/webtoons/works/" + workId
      : "/api/webtoons";
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "불러오지 못했습니다.");
        return body;
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [endpoint, attempt]);
  if (episodeId)
    return (
      <ReaderFrame
        title={data?.work?.title ?? "웹툰"}
        listHref={workId ? `/webtoons/${workId}` : "/webtoons"}
        nextHref={
          data?.nextId && workId
            ? `/webtoons/${workId}/episodes/${data.nextId}`
            : undefined
        }
        ready={!!data?.episode}
      >
        {error ? (
          <div
            role="alert"
            className={styles.pageError}
            style={{ position: "relative", minHeight: "65dvh" }}
          >
            <p>이야기를 불러오지 못했어요.</p>
            <button
              onClick={() => {
                setError("");
                setAttempt((n) => n + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        ) : !data ? (
          <div aria-hidden="true" className={styles.manifestPending} />
        ) : null}
        {data?.pdf ? (
          <PdfViewer key={data.pdf.id} pdf={data.pdf} />
        ) : data?.pages && data.episode ? (
          <ImageEpisodeViewer
            pages={data.pages}
            episodeId={data.episode.id}
            title={data.episode.title}
          />
        ) : null}
      </ReaderFrame>
    );
  return (
    <main className="min-h-screen bg-zinc-950 pb-12 text-white">
      <header className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Link className="text-sm text-zinc-300 underline" href="/">
          CARFACT 홈
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/webtoons">작품 목록</Link>
          {data?.work ? (
            <Link href={`/webtoons/${data.work.id}`}>회차 목록</Link>
          ) : null}
        </nav>
        <h1 className="text-2xl font-black">
          {data?.episode
            ? `${data.episode.number}화 · ${data.episode.title}`
            : (data?.work?.title ?? "CARFACT 웹툰")}
        </h1>
        {data?.work && !episodeId ? (
          <p className="whitespace-pre-wrap text-zinc-300">
            {data.work.description}
          </p>
        ) : null}
      </header>
      {error ? (
        <p role="alert" className="mx-auto max-w-4xl px-4 py-8">
          {error}
        </p>
      ) : !data ? (
        <p className="px-4 py-8 text-center">불러오는 중…</p>
      ) : null}
      {data?.works ? (
        <section
          aria-label="웹툰 작품"
          className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-4 sm:grid-cols-3"
        >
          {data.works.map((work) => (
            <Link
              key={work.id}
              href={`/webtoons/${work.id}`}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              {work.cover_asset_id ? (
                <img
                  src={mediaUrl(work.cover_asset_id)}
                  alt={`${work.title} 표지`}
                  loading="lazy"
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : null}
              <h2 className="p-3 font-bold">{work.title}</h2>
            </Link>
          ))}
          {data.works.length === 0 ? <p>공개된 작품이 없습니다.</p> : null}
        </section>
      ) : null}
      {data?.episodes ? (
        <section
          aria-label="회차 목록"
          className="mx-auto max-w-4xl space-y-3 px-4"
        >
          {data.episodes.map((e) => (
            <Link
              className="block rounded-xl border border-zinc-800 p-4"
              key={e.id}
              href={`/webtoons/${e.work_id}/episodes/${e.id}`}
            >
              {e.number}화 · {e.title}
            </Link>
          ))}
          {data.episodes.length === 0 ? (
            <p>아직 공개된 회차가 없습니다.</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
