"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
export interface ReadingPosition {
  page: number;
  fraction: number;
}
export function viewportAnchor() {
  const viewport = window.visualViewport;
  return (
    (viewport?.pageTop ?? window.scrollY) +
    (viewport?.height ?? window.innerHeight) * 0.4
  );
}
/** Metadata reserves every page's real geometry; only the visible window needs pixels. */
export function useReadingPosition(
  root: RefObject<HTMLDivElement | null>,
  sizes: { width: number; height: number }[],
  key: string | null,
  canPersist = true,
) {
  const [current, setCurrent] = useState(1),
    saved = useRef<ReadingPosition | null>(null);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !key) return;
    try {
      const last = JSON.parse(localStorage.getItem(key) || "null");
      if (
        last &&
        Number.isInteger(last.page) &&
        last.page >= 1 &&
        last.page <= sizes.length &&
        Number.isFinite(last.fraction) &&
        last.fraction >= 0 &&
        last.fraction <= 1
      ) {
        const page = node.querySelector<HTMLElement>(
          `[data-reader-page="${last.page}"]`,
        );
        if (page) {
          saved.current = { page: last.page, fraction: last.fraction };
          const rect = page.getBoundingClientRect();
          window.scrollBy({
            top:
              window.scrollY +
              rect.top +
              rect.height * last.fraction -
              viewportAnchor(),
            behavior: "instant",
          });
        }
      }
    } catch {
      /* Restricted storage starts at the beginning. */
    }
  }, [key, root, sizes.length]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0,
      lastWrite = 0,
      previousWidth = node.clientWidth;
    const persist = () => {
      if (key && canPersist && saved.current)
        try {
          localStorage.setItem(key, JSON.stringify(saved.current));
        } catch {
          /* Reading also works without storage. */
        }
    };
    const tick = () => {
      raf = 0;
      const width = node.clientWidth;
      if (!width) return;
      const offset = Math.max(
        0,
        viewportAnchor() - (window.scrollY + node.getBoundingClientRect().top),
      );
      let sum = 0,
        page = 1,
        fraction = 0;
      for (let i = 0; i < sizes.length; i++) {
        const height = (width * sizes[i].height) / sizes[i].width;
        if (offset < sum + height || i === sizes.length - 1) {
          page = i + 1;
          fraction = Math.min(1, Math.max(0, (offset - sum) / height));
          break;
        }
        sum += height;
      }
      saved.current = { page, fraction };
      setCurrent((previous) => (previous === page ? previous : page));
      if (performance.now() - lastWrite > 250) {
        persist();
        lastWrite = performance.now();
        clearTimeout(writeTimer);
      } else if (key && canPersist) {
        clearTimeout(writeTimer);
        writeTimer = setTimeout(persist, 250);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth;
      if (previousWidth && width !== previousWidth && saved.current) {
        const position = saved.current,
          page = node.querySelector<HTMLElement>(
            `[data-reader-page="${position.page}"]`,
          );
        if (page) {
          const rect = page.getBoundingClientRect();
          window.scrollBy({
            top:
              window.scrollY +
              rect.top +
              rect.height * position.fraction -
              viewportAnchor(),
            behavior: "instant",
          });
        }
      }
      previousWidth = width;
      schedule();
    });
    observer.observe(node);
    schedule();
    const visibility = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", visibility);
    window.visualViewport?.addEventListener("scroll", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      persist();
      clearTimeout(writeTimer);
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", visibility);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [root, sizes, key, canPersist]);
  return current;
}
