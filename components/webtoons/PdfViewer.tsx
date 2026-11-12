"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { supabase } from "@/lib/supabase";
import { mediaUrl } from "@/lib/webtoons/client";
import { PDF_MAX_CANVAS_PIXELS, PDF_RENDER_RADIUS } from "@/lib/webtoons/pdf-limits";
export interface PdfManifest { id: string; page_count: number; page_sizes: { width: number; height: number }[]; }
function CanvasPage({ document, number, width, height }: { document: PDFDocumentProxy; number: number; width: number; height: number }) {
 const canvas = useRef<HTMLCanvasElement>(null); const [error, setError] = useState(false), [text, setText] = useState(""); const [retry, setRetry] = useState(0);
 useEffect(() => {
  let alive = true, task: RenderTask | undefined, page: PDFPageProxy | undefined;
  async function render() {
   page = await document.getPage(number); if (!alive || !canvas.current) { page.cleanup(); return; }
   const factor = Math.min(window.devicePixelRatio || 1, Math.sqrt(PDF_MAX_CANVAS_PIXELS / (width * height)));
   const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width * factor });
   const node = canvas.current; node.width = Math.max(1, Math.floor(viewport.width)); node.height = Math.max(1, Math.floor(viewport.height));
   const context = node.getContext("2d"); if (!context) throw Error("Canvas unavailable");
   task = page.render({ canvas: node, canvasContext: context, viewport, annotationMode: 0 }); await task.promise;
   const content = await page.getTextContent(); if (alive) { setError(false); setText(content.items.map(item => "str" in item ? item.str : "").join(" ").slice(0, 5000)); }
  }
  render().catch(() => { if (alive) setError(true); });
  const node = canvas.current;
  return () => { alive = false; task?.cancel(); if (node) { node.width = 0; node.height = 0; } if (task) void task.promise.catch(() => {}).finally(() => page?.cleanup()); else page?.cleanup(); };
 }, [document, number, width, height, retry]);
 return <>{error ? <div role="alert" className="p-4 text-red-800">{number}페이지를 표시하지 못했습니다. <button className="underline" onClick={() => { setError(false); setRetry(n => n + 1); }}>페이지 재시도</button></div> : null}<canvas ref={canvas} data-pdf-canvas={number} aria-label={`PDF ${number}페이지`} style={{ width: "100%", height: "100%", display: error ? "none" : "block" }} /><span className="sr-only" data-pdf-text={number}>{text}</span></>;
}
export function PdfViewer({ pdf, preview = false }: { pdf: PdfManifest; preview?: boolean }) {
 const [document, setDocument] = useState<PDFDocumentProxy | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(0), [attempt, setAttempt] = useState(0);
 const [width, setWidth] = useState(0), [zoom, setZoom] = useState(1), [current, setCurrent] = useState(1), [jump, setJump] = useState(""), [resumed, setResumed] = useState(false), [top, setTop] = useState(0);
 const root = useRef<HTMLDivElement>(null), pending = useRef<{ page: number; fraction: number; anchor: number } | null>(null), saved = useRef<{ page: number; fraction: number; zoom: number } | null>(null);
 const pinch = useRef<{ distance: number; zoom: number; time: number } | null>(null);
 const storageKey = "carfact.pdf.v1." + pdf.id;
 useEffect(() => {
  let active = true; let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
  async function load() {
   const library = await import("pdfjs-dist"); if (!active) return;
   const base = `/api/webtoons/pdfjs/${library.version}/`;
   library.GlobalWorkerOptions.workerSrc = base + "worker";
   const { data } = preview && supabase ? await supabase.auth.getSession() : { data: { session: null } }; if (!active) return;
   task = library.getDocument({ url: mediaUrl(pdf.id), httpHeaders: data.session ? { Authorization: "Bearer " + data.session.access_token } : undefined, disableRange: true, disableStream: true, disableAutoFetch: true, enableXfa: false, cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/", wasmUrl: base + "wasm/", verbosity: 0 });
   task.onProgress = (p: { loaded: number; total: number }) => { if (active) setLoading(p.total ? Math.round(p.loaded / p.total * 100) : 0); };
   task.onPassword = () => { if (active) setError("암호화된 PDF는 표시할 수 없습니다. 암호화를 해제한 파일로 다시 업로드해주세요."); void task?.destroy(); };
   const doc = await task.promise; if (!active) { await task.destroy(); return; }
   if (doc.numPages !== pdf.page_count) { await task.destroy(); throw Error("PDF 페이지 정보가 일치하지 않습니다."); }
   setDocument(doc);
   if (!preview) try {
    const last = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (last && Number.isInteger(last.page) && last.page > 1 && last.page <= pdf.page_count && last.fraction >= 0 && last.fraction <= 1 && last.zoom >= 1 && last.zoom <= 3) { pending.current = { page: last.page, fraction: last.fraction, anchor: window.innerHeight * 0.4 }; setZoom(last.zoom); setCurrent(last.page); setResumed(true); }
   } catch { /* Invalid/local-storage-disabled state starts from page1. */ }
  }
  load().catch(() => { if (active) setError(e => e || "PDF를 불러오지 못했습니다. 공개 상태와 파일을 확인한 후 다시 시도해주세요."); });
  return () => { active = false; void task?.destroy(); };
 }, [pdf.id, pdf.page_count, preview, storageKey, attempt]);
 useEffect(() => {
  const node = root.current; if (!node) return;
  const observer = new ResizeObserver(entries => { const next = entries[0].contentRect.width; setWidth(previous => { if (previous && previous !== next && saved.current) pending.current = { ...saved.current, anchor: window.innerHeight * 0.4 }; return next; }); }); observer.observe(node);
  const banner = window.document.querySelector('[aria-label="로컬 테스트 환경 안내"]');
  const bannerObserver = banner ? new ResizeObserver(() => setTop(banner.getBoundingClientRect().height)) : null; if (banner) bannerObserver?.observe(banner);
  return () => { observer.disconnect(); bannerObserver?.disconnect(); };
 }, []);
 useLayoutEffect(() => {
  if (!document || !width || !pending.current) return;
  const target = pending.current, node = root.current?.querySelector<HTMLElement>(`[data-pdf-slot="${target.page}"]`);
  if (node) { const rect = node.getBoundingClientRect(); window.scrollBy(0, rect.top + rect.height * target.fraction - target.anchor); pending.current = null; }
 }, [document, width, zoom]);
 useEffect(() => {
  if (!document || !width) return;
  let raf = 0, lastWrite = 0;
  const persist = () => { if (!preview && saved.current) try { localStorage.setItem(storageKey, JSON.stringify(saved.current)); } catch { /* Storage may be unavailable. */ } };
  const tick = () => {
   raf = 0; const container = root.current; if (!container) return;
   const anchor = Math.min(window.innerHeight - 50, Math.max(window.innerHeight * 0.4, top + 110));
   const offset = Math.max(0, anchor - container.getBoundingClientRect().top); let sum = 0, page = 1, fraction = 0;
   for (let i = 0; i < pdf.page_sizes.length; i++) { const height = width * zoom * pdf.page_sizes[i].height / pdf.page_sizes[i].width; if (offset < sum + height + 8 || i === pdf.page_sizes.length - 1) { page = i + 1; fraction = Math.max(0, Math.min(1, (offset - sum) / height)); break; } sum += height + 8; }
   setCurrent(previous => previous === page ? previous : page); saved.current = { page, fraction, zoom };
   if (performance.now() - lastWrite > 250) { persist(); lastWrite = performance.now(); }
  };
  const scroll = () => { if (!raf) raf = requestAnimationFrame(tick); }; scroll(); window.addEventListener("scroll", scroll, { passive: true }); window.addEventListener("pagehide", persist);
  return () => { window.removeEventListener("scroll", scroll); window.removeEventListener("pagehide", persist); cancelAnimationFrame(raf); persist(); };
 }, [document, width, zoom, pdf.page_sizes, storageKey, preview, top]);
 const changeZoom = useCallback((value: number) => {
  const next = Math.max(1, Math.min(3, Math.round(value * 100) / 100)); if (saved.current) pending.current = { ...saved.current, anchor: Math.min(window.innerHeight - 50, Math.max(window.innerHeight * 0.4, top + 110)) }; setZoom(next);
 }, [top]);
 useEffect(() => {
  const node = root.current; if (!node) return;
  const distance = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const start = (e: TouchEvent) => { if (e.touches.length === 2) { e.preventDefault(); pinch.current = { distance: distance(e), zoom, time: 0 }; } };
  const move = (e: TouchEvent) => { if (e.touches.length === 2 && pinch.current) { e.preventDefault(); if (performance.now() - pinch.current.time > 80) { changeZoom(pinch.current.zoom * distance(e) / pinch.current.distance); pinch.current.time = performance.now(); } } };
  const end = () => { pinch.current = null; };
  node.addEventListener("touchstart", start, { passive: false }); node.addEventListener("touchmove", move, { passive: false }); node.addEventListener("touchend", end);
  return () => { node.removeEventListener("touchstart", start); node.removeEventListener("touchmove", move); node.removeEventListener("touchend", end); };
 }, [zoom, changeZoom]);
 function go(page: number) { const node = root.current?.querySelector<HTMLElement>(`[data-pdf-slot="${page}"]`); if (node) window.scrollBy(0, node.getBoundingClientRect().top - top - 100); }
 return <section aria-label={preview ? "관리자 PDF 미리보기" : "PDF 세로 뷰어"} className="mx-auto w-full max-w-3xl" style={{ overflowAnchor: "none" }}>
  <div className="sticky z-40 flex flex-wrap items-center gap-2 border-y border-zinc-400 bg-white p-2 text-sm text-black shadow" style={{ top }}>
   <strong aria-live="polite" data-current-pdf-page={current}>{current} / {pdf.page_count} 페이지</strong>
   <button className="rounded border px-2 py-1" aria-label="PDF 축소" disabled={zoom <= 1} onClick={() => changeZoom(zoom - 0.25)}>−</button><span data-pdf-zoom>{Math.round(zoom * 100)}%</span><button className="rounded border px-2 py-1" aria-label="PDF 확대" disabled={zoom >= 3} onClick={() => changeZoom(zoom + 0.25)}>+</button>
   <input aria-label="이동할 PDF 페이지" type="number" min={1} max={pdf.page_count} value={jump} onChange={e => setJump(e.target.value)} className="w-14 rounded border p-1" /><button className="underline" onClick={() => { const n = Number(jump); if (Number.isInteger(n) && n >= 1 && n <= pdf.page_count) go(n); }}>이동</button>
   <button className="underline" onClick={() => { setResumed(false); pending.current = null; setZoom(1); requestAnimationFrame(() => go(1)); }}>처음부터</button>
   {resumed ? <span className="text-xs">이전 위치에서 이어보는 중</span> : null}
  </div>
  {!document && !error ? <p role="status" className="p-4">PDF 불러오는 중 {loading}%</p> : null}
  {error ? <p role="alert" className="bg-red-50 p-4 text-red-900">{error} <button className="underline" onClick={() => { setDocument(null); setError(""); setAttempt(n => n + 1); }}>다시 불러오기</button></p> : null}
  <div ref={root} className="w-full overflow-x-auto" style={{ overflowAnchor: "none" }}>
   <div style={{ width: width ? width * zoom : "100%" }}>
    {pdf.page_sizes.map((size, i) => { const height = (width || 360) * zoom * size.height / size.width; const active = !!document && Math.abs(i + 1 - current) <= PDF_RENDER_RADIUS; return <div key={i} data-pdf-slot={i + 1} style={{ height, marginBottom: 8, position: "relative", background: "white", overflowAnchor: "none" }}>{active ? <CanvasPage document={document!} number={i + 1} width={width * zoom} height={height} /> : <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">{i + 1}페이지</span>}</div>; })}
   </div>
  </div>
 </section>;
}
