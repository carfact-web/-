"use client";
/* eslint-disable @next/next/no-img-element -- Publication-checked, no-store derivative cover endpoint. */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { koreanDay, type PromotionPayload } from "@/lib/webtoons/promotion";
const PromotionContext = createContext<PromotionPayload | null>(null);
const hiddenKey = "carfact.webtoon.promo.hiddenDay";
const seenKey = "carfact.webtoon.promo.seen";
function read(store: "localStorage" | "sessionStorage", key: string) { try { return window[store].getItem(key); } catch { return null; } }
function write(store: "localStorage" | "sessionStorage", key: string, value: string) { try { window[store].setItem(key, value); } catch { /* In-memory fallback remains active. */ } }
export function WebtoonPromotionProvider({ children }: { children: React.ReactNode }) {
 const [data, setData] = useState<PromotionPayload | null>(null), [open, setOpen] = useState(false);
 const seen = useRef(false), offset = useRef(0), pathname = usePathname();
 const eligible = !/^\/(admin|login|auth|local-test)(\/|$)/.test(pathname) && !pathname.includes("/episodes/");
 useEffect(() => {
  let active = true; const abort = new AbortController(); let generation = 0;
  async function refresh() {
   const request = ++generation;
   try {
    const response = await fetch("/api/webtoons/promotion", { cache: "no-store", signal: abort.signal });
    if (!response.ok) throw Error("Promotion unavailable");
    const payload: PromotionPayload = await response.json();
    if (active && request === generation) { offset.current = Date.parse(payload.serverNow) - Date.now(); setData(payload); if (!payload.popup) setOpen(false); }
   } catch { if (active && request === generation) { setData(null); setOpen(false); } }
  }
  void refresh(); const timer = window.setInterval(refresh, 15000);
  const visible = () => { if (document.visibilityState === "visible") void refresh(); };
  window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
  return () => { active = false; abort.abort(); clearInterval(timer); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
 }, [pathname]);
 useEffect(() => {
  if (!data?.popup || !eligible || seen.current) return;
  const now = Date.now() + offset.current;
  if (Date.parse(data.popup.endsAt) <= now || read("localStorage", hiddenKey) === koreanDay(now) || read("sessionStorage", seenKey)) return;
  seen.current = true; write("sessionStorage", seenKey, "1"); setOpen(true);
 }, [data, eligible]);
 useEffect(() => {
  if (!open || !data?.popup) return;
  const remaining = Date.parse(data.popup.endsAt) - (Date.now() + offset.current);
  const timer = window.setTimeout(() => setOpen(false), Math.max(0, Math.min(remaining, 2147483647)));
  const sync = (event: StorageEvent) => { if (event.key === hiddenKey && event.newValue === koreanDay(Date.now() + offset.current)) setOpen(false); };
  window.addEventListener("storage", sync);
  return () => { clearTimeout(timer); window.removeEventListener("storage", sync); };
 }, [data, open]);
 function dismiss(today = false) { if (today) write("localStorage", hiddenKey, koreanDay(Date.now() + offset.current)); setOpen(false); }
 return <PromotionContext value={data}>{children}{open && eligible && data?.popup ? <PromotionPopup popup={data.popup} dismiss={dismiss} /> : null}</PromotionContext>;
}
function PromotionPopup({ popup, dismiss }: { popup: NonNullable<PromotionPayload["popup"]>; dismiss: (today?: boolean) => void }) {
 const panel = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  close.current?.focus({ preventScroll: true });
  const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close.current?.click(); } };
  document.addEventListener("keydown", escape);
  const node = panel.current;
  return () => { document.removeEventListener("keydown", escape); if ((document.activeElement === document.body || node?.contains(document.activeElement)) && previous?.isConnected) previous.focus({ preventScroll: true }); };
 }, []);
 return <aside ref={panel} role="dialog" aria-modal="false" aria-labelledby="webtoon-promo-title" aria-describedby="webtoon-promo-message" className="fixed bottom-24 right-3 z-[70] max-h-[48dvh] w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-950 p-4 text-white shadow-2xl sm:right-6">
  <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold tracking-widest text-red-400">CARFACT WEBTOON</span><button ref={close} type="button" onClick={() => dismiss()} className="min-h-10 rounded-lg px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="웹툰 홍보 닫기">닫기 ×</button></div>
  <div className="mt-2 flex gap-4"><img src={popup.card.coverUrl} alt={`${popup.card.workTitle} 홍보 표지`} width={80} height={108} className="h-28 w-20 shrink-0 rounded-lg bg-zinc-900 object-contain" /><div className="min-w-0"><h2 id="webtoon-promo-title" className="break-words text-lg font-black">{popup.card.workTitle}</h2><p className="mt-1 break-words text-sm text-zinc-300">{popup.card.episodeTitle}</p><p id="webtoon-promo-message" className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{popup.message}</p></div></div>
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" className="min-h-11 rounded-lg px-1 text-xs text-zinc-300 underline focus-visible:outline-2 focus-visible:outline-white" onClick={() => dismiss(true)}>오늘 하루 보지 않기</button><Link href={popup.card.href} onClick={() => dismiss()} className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">지금 보기</Link></div>
 </aside>;
}
export function LatestWebtoon() {
 const data = useContext(PromotionContext), card = data?.latest;
 if (!card) return null;
 return <section aria-labelledby="latest-webtoon-title" className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-5 text-white sm:p-7">
  <p className="text-xs font-black tracking-[0.2em] text-red-400">CARFACT ORIGINAL</p><h2 id="latest-webtoon-title" className="mt-2 text-xl font-black sm:text-2xl">최신 웹툰</h2>
  <div className="mt-5 flex items-start gap-4 sm:gap-7"><img src={card.coverUrl} alt={`${card.workTitle} 홍보 표지`} width={144} height={192} loading="lazy" className="max-h-48 w-24 shrink-0 rounded-xl bg-zinc-900 object-contain sm:w-36" /><div className="min-w-0 flex-1"><h3 className="break-words text-lg font-black sm:text-2xl">{card.workTitle}</h3><p className="mt-2 break-words text-sm font-bold text-zinc-200 sm:text-base">{card.episodeTitle}</p>{card.description ? <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-zinc-400">{card.description}</p> : null}<Link href={card.href} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-black transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">웹툰 보러 가기 →</Link></div></div>
 </section>;
}
