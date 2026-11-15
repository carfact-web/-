"use client";
/* eslint-disable @next/next/no-img-element -- Auth-independent same-origin media retains publication checks and native lazy loading. */
import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/webtoons/client";
import { useReadingPosition } from "./useReadingPosition";
import styles from "./Reader.module.css";
export interface StoryImage {
  id: string;
  width: number;
  height: number;
}
function Scene({
  page,
  index,
  title,
}: {
  page: StoryImage;
  index: number;
  title: string;
}) {
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  return (
    <div
      data-reader-page={index + 1}
      className={styles.page}
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      {!ready && !failed ? (
        <div
          data-reader-skeleton
          aria-hidden="true"
          className={styles.skeleton}
        />
      ) : null}
      {failed ? (
        <div role="alert" className={styles.pageError}>
          <p>장면을 불러오지 못했어요.</p>
          <button
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <img
          key={attempt}
          src={mediaUrl(page.id)}
          alt={`${title} ${index + 1}번째 장면`}
          width={page.width}
          height={page.height}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          className={`${styles.image} ${ready ? "" : styles.pending}`}
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
export function ImageEpisodeViewer({
  pages,
  episodeId,
  title,
}: {
  pages: StoryImage[];
  episodeId: string;
  title: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useReadingPosition(root, pages, "carfact.images.v1." + episodeId);
  return (
    <section aria-label="웹툰 본문" className={styles.pages}>
      <div ref={root}>
        {pages.map((page, i) => (
          <Scene key={page.id} page={page} index={i} title={title} />
        ))}
      </div>
    </section>
  );
}
