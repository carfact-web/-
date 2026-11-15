"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./Reader.module.css";
export function ReaderFrame({
  title,
  listHref,
  nextHref,
  children,
  ready,
}: {
  title: string;
  listHref: string;
  nextHref?: string;
  children: ReactNode;
  ready: boolean;
}) {
  const body = useRef<HTMLDivElement>(null),
    [hidden, setHidden] = useState(false),
    [progress, setProgress] = useState(0);
  useEffect(() => {
    const node = body.current;
    if (!node) return;
    let raf = 0,
      previous = window.scrollY,
      travel = 0;
    const tick = () => {
      raf = 0;
      const viewport = window.visualViewport,
        y = viewport?.pageTop ?? window.scrollY,
        delta = y - previous;
      travel = Math.sign(travel) === Math.sign(delta) ? travel + delta : delta;
      if (y < 20) setHidden(false);
      else if (Math.abs(travel) > 12) setHidden(travel > 0);
      previous = y;
      const top = window.scrollY + node.getBoundingClientRect().top,
        height = node.offsetHeight;
      setProgress(
        height
          ? Math.min(
              1,
              Math.max(
                0,
                (y + (viewport?.height ?? window.innerHeight) - top) / height,
              ),
            )
          : 0,
      );
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <main data-webtoon-reader className={styles.frame}>
      <a className={styles.skip} href="#webtoon-body">
        본문으로 건너뛰기
      </a>
      <header
        data-reader-bar
        data-hidden={hidden}
        className={`${styles.bar} ${hidden ? styles.barHidden : ""}`}
      >
        <div className={styles.barInner}>
          <Link
            className={styles.back}
            href={listHref}
            aria-label="회차 목록으로 돌아가기"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m14 5-7 7 7 7" />
            </svg>
          </Link>
          <h1 className={styles.title}>{title}</h1>
        </div>
      </header>
      <div
        className={styles.line}
        role="progressbar"
        aria-label="읽은 위치"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          data-reading-progress
          className={styles.lineFill}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <div ref={body} id="webtoon-body" tabIndex={-1} className={styles.body}>
        {children}
      </div>
      {ready ? (
        <nav className={styles.end} aria-label="읽기를 마친 후 이동">
          {nextHref ? (
            <Link className={styles.next} href={nextHref}>
              다음 화 <span aria-hidden="true">&nbsp;→</span>
            </Link>
          ) : null}
          <Link href={listHref}>목록으로</Link>
        </nav>
      ) : null}
    </main>
  );
}
