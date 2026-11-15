"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { supabase } from "@/lib/supabase";
import { mediaUrl } from "@/lib/webtoons/client";
import {
  PDF_MAX_CANVAS_PIXELS,
  PDF_RENDER_RADIUS,
} from "@/lib/webtoons/pdf-limits";
import { useReadingPosition } from "./useReadingPosition";
import styles from "./Reader.module.css";
export interface PdfManifest {
  id: string;
  page_count: number;
  page_sizes: { width: number; height: number }[];
}
function CanvasPage({
  document,
  number,
  width,
  height,
}: {
  document: PDFDocumentProxy;
  number: number;
  width: number;
  height: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false),
    [text, setText] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true,
      task: RenderTask | undefined,
      page: PDFPageProxy | undefined;
    async function render() {
      page = await document.getPage(number);
      if (!alive || !canvas.current) {
        page.cleanup();
        return;
      }
      const factor = Math.min(
          window.devicePixelRatio || 1,
          Math.sqrt(PDF_MAX_CANVAS_PIXELS / (width * height)),
        ),
        viewport = page.getViewport({
          scale: (width / page.getViewport({ scale: 1 }).width) * factor,
        }),
        node = canvas.current;
      node.width = Math.max(1, Math.floor(viewport.width));
      node.height = Math.max(1, Math.floor(viewport.height));
      const context = node.getContext("2d");
      if (!context) throw Error("Canvas unavailable");
      task = page.render({
        canvas: node,
        canvasContext: context,
        viewport,
        annotationMode: 0,
      });
      await task.promise;
      if (!alive) return;
      setReady(true);
      try {
        const content = await page.getTextContent();
        if (alive)
          setText(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .slice(0, 5000),
          );
      } catch {
        /* Text extraction must not hide an already rendered scene. */
      }
    }
    render().catch(() => {
      if (alive) setError(true);
    });
    const node = canvas.current;
    return () => {
      alive = false;
      task?.cancel();
      if (node) {
        node.width = 0;
        node.height = 0;
      }
      if (task)
        void task.promise.catch(() => {}).finally(() => page?.cleanup());
      else page?.cleanup();
    };
  }, [document, number, width, height, retry]);
  return (
    <>
      {!ready && !error ? (
        <div
          data-reader-skeleton
          aria-hidden="true"
          className={styles.skeleton}
        />
      ) : null}
      {error ? (
        <div role="alert" className={styles.pageError}>
          <p>장면을 불러오지 못했어요.</p>
          <button
            onClick={() => {
              setError(false);
              setRetry((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </div>
      ) : null}
      <canvas
        ref={canvas}
        data-pdf-canvas={number}
        aria-label={`${number}번째 장면`}
        className={`${styles.canvas} ${ready && !error ? "" : styles.pending}`}
      />
      {text ? (
        <span className="sr-only" data-pdf-text={number}>
          {text}
        </span>
      ) : null}
    </>
  );
}
export function PdfViewer({
  pdf,
  preview = false,
}: {
  pdf: PdfManifest;
  preview?: boolean;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    current = useReadingPosition(
      root,
      pdf.page_sizes,
      preview ? null : "carfact.pdf.v1." + pdf.id,
      !!document && !error,
    );
  useEffect(() => {
    let active = true,
      task:
        | ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>
        | undefined;
    async function load() {
      const library = await import("pdfjs-dist");
      if (!active) return;
      const base = `/api/webtoons/pdfjs/${library.version}/`;
      library.GlobalWorkerOptions.workerSrc = base + "worker";
      const { data } =
        preview && supabase
          ? await supabase.auth.getSession()
          : { data: { session: null } };
      if (!active) return;
      task = library.getDocument({
        url: mediaUrl(pdf.id),
        httpHeaders: data.session
          ? { Authorization: "Bearer " + data.session.access_token }
          : undefined,
        disableRange: true,
        disableStream: true,
        disableAutoFetch: true,
        enableXfa: false,
        cMapUrl: base + "cmaps/",
        cMapPacked: true,
        standardFontDataUrl: base + "standard_fonts/",
        wasmUrl: base + "wasm/",
        verbosity: 0,
      });
      task.onPassword = () => {
        if (active) setError(true);
        void task?.destroy();
      };
      const doc = await task.promise;
      if (!active) {
        await task.destroy();
        return;
      }
      if (doc.numPages !== pdf.page_count) {
        await task.destroy();
        throw Error("Manifest mismatch");
      }
      setDocument(doc);
    }
    load().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [pdf.id, pdf.page_count, preview, attempt]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      aria-label={preview ? "관리자 PDF 미리보기" : "웹툰 본문"}
      data-current-pdf-page={current}
      className={styles.pages}
    >
      <div ref={root} style={{ overflowAnchor: "none" }}>
        {error ? (
          <div className={styles.loadError}>
            <div role="alert">
              <p>이야기를 불러오지 못했어요.</p>
              <button
                onClick={() => {
                  setDocument(null);
                  setError(false);
                  setAttempt((n) => n + 1);
                }}
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : null}
        {pdf.page_sizes.map((size, i) => {
          const height = (width * size.height) / size.width,
            active =
              !!document &&
              !error &&
              width > 0 &&
              Math.abs(i + 1 - current) <= PDF_RENDER_RADIUS;
          return (
            <div
              key={i}
              data-reader-page={i + 1}
              data-pdf-slot={i + 1}
              className={styles.page}
              style={{
                aspectRatio: `${size.width} / ${size.height}`,
                height: width ? height : undefined,
              }}
            >
              {active ? (
                <CanvasPage
                  key={`${i}:${width}`}
                  document={document!}
                  number={i + 1}
                  width={width}
                  height={height}
                />
              ) : (
                <div
                  data-reader-skeleton
                  aria-hidden="true"
                  className={styles.skeleton}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
