"use client";
import { PromotionSettingsPanel } from "@/components/webtoons/PromotionSettingsPanel";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { isLocalSandbox } from "@/lib/local/sandbox";
import { webtoonRequest } from "@/lib/webtoons/client";
import { AdminImage } from "@/components/webtoons/AdminImage";
import { PdfUpload } from "@/components/webtoons/PdfUpload";
import { PdfViewer } from "@/components/webtoons/PdfViewer";
import { UploadQueue } from "@/components/webtoons/UploadQueue";
import type { WebtoonAsset, WebtoonEpisode, WebtoonEpisodeEditor, WebtoonWork } from "@/types/webtoon";
interface Payload { works: WebtoonWork[]; episodes: WebtoonEpisodeEditor[]; assets: WebtoonAsset[]; }
const button = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40";
const input = "mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 text-black";
export default function WebtoonAdminPage() {
 const { isAdmin, isAuthReady, isProfileReady, user } = useAuth();
 const [works, setWorks] = useState<WebtoonWork[]>([]), [episodes, setEpisodes] = useState<WebtoonEpisodeEditor[]>([]), [assets, setAssets] = useState<WebtoonAsset[]>([]);
 const [work, setWork] = useState<WebtoonWork | null>(null), [episode, setEpisode] = useState<WebtoonEpisodeEditor | null>(null);
 const [newTitle, setNewTitle] = useState(""), [newEpisodeTitle, setNewEpisodeTitle] = useState(""), [newNumber, setNewNumber] = useState(1);
 const [libraryOpen, setLibraryOpen] = useState(false), [libraryLimit, setLibraryLimit] = useState(60);
 const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
 useEffect(() => {
  if (!isAdmin) return;
  const abort = new AbortController();
  webtoonRequest<Payload>("/api/admin/webtoons", { signal: abort.signal }).then(data => setWorks(data.works)).catch(e => { if (!abort.signal.aborted) setError(e.message); });
  return () => abort.abort();
 }, [isAdmin]);
 async function action(task: () => Promise<void>) {
  setBusy(true); setError(""); setNotice("");
  try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); } finally { setBusy(false); }
 }
 async function load(id: string) {
  const data = await webtoonRequest<Payload>("/api/admin/webtoons?workId=" + id);
  setWorks(data.works); setEpisodes(data.episodes); setAssets(data.assets); return data;
 }
 async function choose(id: string) {
  setLibraryOpen(false); setLibraryLimit(60);
  if (!id) { setWork(null); setEpisode(null); return; }
  await action(async () => { const data = await load(id); setWork(data.works.find(w => w.id === id) ?? null); setEpisode(null); setNewNumber(Math.max(0, ...data.episodes.map(e => e.number)) + 1); });
 }
 async function saveEpisode(published: boolean) {
  if (!episode) return;
  await action(async () => {
   const saved = await webtoonRequest<WebtoonEpisode>("/api/admin/webtoons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "episode", id: episode.id, version: episode.version, title: episode.title, number: episode.number, published, pageIds: episode.content_type === "pdf" ? [] : episode.page_ids, contentType: episode.content_type, pdfAssetId: episode.content_type === "pdf" ? episode.pdf_asset_id : null }) });
   await load(saved.work_id); setEpisode({ ...saved, page_ids: episode.page_ids }); setNotice(published ? "회차를 공개했습니다. 작품도 공개 상태여야 일반 사용자에게 보입니다." : "회차를 비공개 임시저장했습니다.");
  });
 }
 function attach(uploaded: WebtoonAsset[], cover = false) {
  setAssets(current => [...current.filter(a => !uploaded.some(u => u.id === a.id)), ...uploaded]);
  const id = work?.id;
  if (cover) setWork(current => current && current.id === id ? { ...current, cover_asset_id: uploaded[0]?.id ?? current.cover_asset_id } : current);
  else setEpisode(current => current && current.work_id === id ? { ...current, page_ids: [...new Set([...current.page_ids, ...uploaded.map(a => a.id)])].slice(0, 100) } : current);
 }
 function move(index: number, direction: number) {
  setEpisode(current => { if (!current) return current; const pages = [...current.page_ids], target = index + direction; if (target < 0 || target >= pages.length) return current; [pages[index], pages[target]] = [pages[target], pages[index]]; return { ...current, page_ids: pages }; });
 }
 if (!isAuthReady || !isProfileReady) return <main className="p-8">관리자 권한을 확인하고 있습니다.</main>;
 if (!user || !isAdmin) return <main className="space-y-4 p-8"><h1 className="text-2xl font-bold">관리자 권한이 필요합니다.</h1><Link className="underline" href={isLocalSandbox() ? "/local-test" : "/login?redirectTo=/admin/webtoons"}>관리자 계정으로 로그인</Link></main>;
 return <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="space-y-2"><h1 className="text-3xl font-black">웹툰 작품·회차 관리</h1><p className="text-sm text-zinc-600">임시저장한 이미지와 회차는 관리자만 볼 수 있습니다. 작품과 회차가 모두 공개되어야 공개 목록과 뷰어에 표시됩니다.</p><nav className="flex gap-4 text-sm underline"><Link href="/admin">관리자 홈</Link><Link href="/webtoons" target="_blank">공개 웹툰 목록 보기</Link></nav></header>
   <PromotionSettingsPanel />
   {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">{error}</p> : null}
   <p role="status" className="text-sm font-semibold">{notice}</p>
   <section className="grid gap-4 rounded-xl bg-white p-4 md:grid-cols-2">
    <div className="space-y-2"><label className="text-sm font-bold">작품 선택<select aria-label="작품 선택" className={input} value={work?.id ?? ""} disabled={busy} onChange={e => void choose(e.target.value)}><option value="">작품을 선택하세요</option>{works.map(w => <option key={w.id} value={w.id}>{w.title} · {w.published ? "공개" : "비공개"}</option>)}</select></label></div>
    <div className="space-y-2"><label className="text-sm font-bold">새 작품 제목<input className={input} value={newTitle} maxLength={120} disabled={busy} onChange={e => setNewTitle(e.target.value)} /></label><button className={button} disabled={busy || !newTitle.trim()} onClick={() => void action(async () => { const created = await webtoonRequest<WebtoonWork>("/api/admin/webtoons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "work", title: newTitle }) }); await load(created.id); setWork(created); setEpisode(null); setNewTitle(""); setNewNumber(1); setNotice("비공개 작품을 만들었습니다. 표지와 소개를 입력해주세요."); })}>작품 만들기</button></div>
   </section>
   {work ? <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <section className="space-y-4 rounded-xl bg-white p-4" aria-label="작품 편집">
     <h2 className="text-xl font-bold">작품 편집</h2>
     <label className="block text-sm font-bold">작품 제목<input className={input} value={work.title} maxLength={120} disabled={busy} onChange={e => setWork({ ...work, title: e.target.value })} /></label>
     <label className="block text-sm font-bold">작품 소개<textarea className={input} rows={5} maxLength={5000} value={work.description} disabled={busy} onChange={e => setWork({ ...work, description: e.target.value })} /></label>
     {work.cover_asset_id ? <div><AdminImage key={work.cover_asset_id} id={work.cover_asset_id} alt="작품 표지 미리보기" /><button disabled={busy} className={button} onClick={() => setWork({ ...work, cover_asset_id: null })}>표지 연결 해제</button></div> : <p className="text-sm text-zinc-500">표지가 없습니다.</p>}
     <UploadQueue key={work.id + "cover"} workId={work.id} label="표지 이미지 선택" available={1} disabled={busy} onBusy={setBusy} onComplete={a => attach(a, true)} />
     <label className="block text-sm font-bold">기존 이미지로 표지 재사용<select aria-label="기존 이미지로 표지 재사용" className={input} disabled={busy} value={work.cover_asset_id ?? ""} onChange={e => setWork({ ...work, cover_asset_id: e.target.value || null })}><option value="">표지 없음</option>{assets.filter(a => a.mime === "image/webp").map((a, i) => <option key={a.id} value={a.id}>이미지 {i + 1} · {a.width}×{a.height}</option>)}</select></label>
     <label className="flex items-center gap-2"><input type="checkbox" checked={work.published} disabled={busy} onChange={e => setWork({ ...work, published: e.target.checked })} />작품 공개</label>
     <button className={button + " w-full"} disabled={busy} onClick={() => void action(async () => { const saved = await webtoonRequest<WebtoonWork>("/api/admin/webtoons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "work", id: work.id, version: work.version, title: work.title, description: work.description, coverAssetId: work.cover_asset_id, published: work.published }) }); setWork(saved); setWorks(current => current.map(w => w.id === saved.id ? saved : w)); setNotice("작품을 저장했습니다."); })}>작품 저장</button>
     <p className="text-xs text-zinc-500">파일은 수정하지 않고 재사용합니다. 표지·회차에서 제거해도 파일은 보관되며, 24시간 지난 미사용 파일만 정리할 수 있습니다.</p>
     <button className={button} disabled={busy} onClick={() => { if (!window.confirm("24시간 지난 미사용 파일을 영구 삭제할까요? 저장된 표지와 회차 이미지는 유지됩니다.")) return; void action(async () => { const result = await webtoonRequest<{ removed: number; failed: number }>("/api/admin/webtoons/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workId: work.id }) }); await load(work.id); setNotice(`미사용 파일 ${result.removed}개 삭제, ${result.failed}개 재시도 필요`); }); }}>미사용 파일 정리</button>
    </section>
    <section className="min-w-0 space-y-4 rounded-xl bg-white p-4" aria-label="회차 편집">
     <h2 className="text-xl font-bold">회차 관리</h2>
     <label className="block text-sm font-bold">회차 선택<select aria-label="회차 선택" value={episode?.id ?? ""} className={input} disabled={busy} onChange={e => setEpisode(episodes.find(ep => ep.id === e.target.value) ?? null)}><option value="">회차를 선택하세요</option>{episodes.map(e => <option key={e.id} value={e.id}>{e.number}화 · {e.title} · {e.published ? "공개" : "임시저장"}</option>)}</select></label>
     <div className="flex flex-wrap items-end gap-2 rounded border p-3"><label className="w-24 text-sm font-bold">새 회차 번호<input className={input} type="number" min={1} max={99999} value={newNumber} disabled={busy} onChange={e => setNewNumber(Number(e.target.value))} /></label><label className="min-w-0 flex-1 text-sm font-bold">새 회차 제목<input className={input} value={newEpisodeTitle} maxLength={120} disabled={busy} onChange={e => setNewEpisodeTitle(e.target.value)} /></label><button className={button} disabled={busy || !newEpisodeTitle.trim()} onClick={() => void action(async () => { const created = await webtoonRequest<WebtoonEpisode>("/api/admin/webtoons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "episode", workId: work.id, title: newEpisodeTitle, number: newNumber }) }); await load(work.id); setEpisode({ ...created, page_ids: [] }); setNewNumber(newNumber + 1); setNewEpisodeTitle(""); setNotice("임시저장 회차를 만들었습니다."); })}>회차 만들기</button></div>
     {episode ? <div className="space-y-4" key={episode.id}>
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr]"><label className="text-sm font-bold">회차 번호<input className={input} value={episode.number} min={1} max={99999} type="number" disabled={busy} onChange={e => setEpisode({ ...episode, number: Number(e.target.value) })} /></label><label className="text-sm font-bold">회차 제목<input className={input} value={episode.title} maxLength={120} disabled={busy} onChange={e => setEpisode({ ...episode, title: e.target.value })} /></label></div>
      <label className="block text-sm font-bold">회차 콘텐츠 방식<select aria-label="회차 콘텐츠 방식" className={input} disabled={busy} value={episode.content_type || "images"} onChange={e => setEpisode({ ...episode, content_type: e.target.value as "images" | "pdf" })}><option value="images">이미지 여러 장</option><option value="pdf">PDF 한 개</option></select></label>
      <div className="flex flex-wrap gap-3 border-t pt-4"><button className={button} disabled={busy} onClick={() => void saveEpisode(false)}>{episode.published ? "비공개로 저장" : "임시저장"}</button><button className={button + " !bg-red-600 !text-white"} disabled={busy || (episode.content_type === "pdf" ? !episode.pdf_asset_id : !episode.page_ids.length)} onClick={() => void saveEpisode(true)}>회차 공개</button><Link className={button} href={`/webtoons/${work.id}/episodes/${episode.id}`} target="_blank">공개 뷰어 확인</Link></div>
      {episode.content_type === "pdf" ? <div className="space-y-3">
       <PdfUpload workId={work.id} disabled={busy} onBusy={setBusy} onComplete={asset => { setAssets(current => [...current.filter(a => a.id !== asset.id), asset]); setEpisode(current => current?.id === episode.id ? { ...current, pdf_asset_id: asset.id } : current); setNotice("PDF 업로드 완료. 미리보기 후 임시저장 또는 공개해주세요."); }} />
       <label className="block text-sm">기존 PDF 재사용<select aria-label="기존 PDF 재사용" className={input} disabled={busy} value={episode.pdf_asset_id ?? ""} onChange={e => setEpisode({ ...episode, pdf_asset_id: e.target.value || null })}><option value="">PDF 없음</option>{assets.filter(a => a.mime === "application/pdf").map((a, i) => <option key={a.id} value={a.id}>PDF {i + 1} · {a.page_count}페이지 · {(a.bytes / 1048576).toFixed(1)}MiB</option>)}</select></label>
       {episode.pdf_asset_id ? <button className={button} disabled={busy} onClick={() => setEpisode({ ...episode, pdf_asset_id: null })}>PDF 연결 해제</button> : null}
       {assets.filter(a => a.id === episode.pdf_asset_id && a.page_count && a.page_sizes).map(a => <PdfViewer key={a.id} preview pdf={{ id: a.id, page_count: a.page_count!, page_sizes: a.page_sizes! }} />)}
      </div> : <div className="space-y-3">
      <UploadQueue workId={work.id} label="회차 이미지 선택" multiple available={100 - episode.page_ids.length} disabled={busy} onBusy={setBusy} onComplete={a => attach(a)} />
      <p className="text-sm font-semibold">회차 이미지 {episode.page_ids.length}/100장 · 위에서 아래 순서로 표시됩니다.</p>
      <ol aria-label="회차 이미지 순서" className="space-y-3">{episode.page_ids.map((id, i) => <li key={id} data-asset-id={id} className="rounded-lg border p-3"><p className="mb-2 font-bold">{i + 1}번째 이미지</p><AdminImage id={id} alt={`회차 이미지 ${i + 1} 미리보기`} /><div className="mt-2 flex flex-wrap gap-2"><button className={button} aria-label={`${i + 1}번째 이미지 위로`} disabled={busy || i === 0} onClick={() => move(i, -1)}>위로 ↑</button><button className={button} aria-label={`${i + 1}번째 이미지 아래로`} disabled={busy || i === episode.page_ids.length - 1} onClick={() => move(i, 1)}>아래로 ↓</button><button className={button} aria-label={`${i + 1}번째 이미지 제거`} disabled={busy} onClick={() => setEpisode({ ...episode, page_ids: episode.page_ids.filter(p => p !== id) })}>회차에서 제거</button></div></li>)}</ol>
      <details open={libraryOpen} onToggle={e => setLibraryOpen(e.currentTarget.open)} className="rounded border p-3"><summary className="cursor-pointer font-bold">기존 이미지 재사용</summary>{libraryOpen ? <div className="mt-3 grid grid-cols-2 gap-3">{assets.filter(a => a.mime === "image/webp").slice(0, libraryLimit).map((asset, i) => <div key={asset.id} data-library-asset-id={asset.id} className="min-w-0 rounded border p-2"><AdminImage id={asset.id} alt={`기존 이미지 ${i + 1}`} /><button className={button + " mt-2 w-full"} disabled={busy || episode.page_ids.includes(asset.id) || episode.page_ids.length >= 100} onClick={() => setEpisode({ ...episode, page_ids: [...episode.page_ids, asset.id] })}>회차에 추가</button></div>)}{assets.length > libraryLimit ? <button className={button} onClick={() => setLibraryLimit(n => n + 60)}>이미지 더 보기</button> : null}</div> : null}</details>
      </div>}
     </div> : <p className="text-sm text-zinc-500">회차를 만들거나 선택해주세요.</p>}
    </section>
   </div> : null}
  </div>
 </main>;
}
