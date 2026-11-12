"use client";
import { useEffect, useRef, useState } from "react";
import { checkWebtoonFile, webtoonRequest } from "@/lib/webtoons/client";
import type { WebtoonAsset } from "@/types/webtoon";
interface Job { id: string; file: File; asset?: WebtoonAsset; error?: string; }
export function UploadQueue({ workId, label, multiple, available, disabled, onBusy, onComplete }: { workId: string; label: string; multiple?: boolean; available: number; disabled: boolean; onBusy: (busy: boolean) => void; onComplete: (assets: WebtoonAsset[]) => void }) {
 const [jobs, setJobs] = useState<Job[]>([]), [running, setRunning] = useState(false), [message, setMessage] = useState("");
 const controller = useRef<AbortController | null>(null);
 useEffect(() => () => controller.current?.abort(), []);
 async function upload() {
  const abort = new AbortController(); controller.current = abort; setRunning(true); onBusy(true); setMessage("");
  const next = jobs.map(j => ({ ...j }));
  try {
   for (const job of next) {
    if (job.asset) continue;
    const invalid = checkWebtoonFile(job.file); if (invalid) { job.error = invalid; continue; }
    const form = new FormData(); form.set("workId", workId); form.set("file", job.file);
    try { job.asset = await webtoonRequest<WebtoonAsset>("/api/admin/webtoons/upload", { method: "POST", body: form, signal: abort.signal }); job.error = undefined; }
    catch (e) { if (abort.signal.aborted) return; job.error = e instanceof Error ? e.message : "업로드에 실패했습니다."; }
    if (abort.signal.aborted) return;
    setJobs(next.map(j => ({ ...j })));
   }
   if (next.every(j => j.asset)) { onComplete(next.map(j => j.asset!)); setJobs([]); setMessage("업로드 완료. 내용을 저장해야 작품·회차에 반영됩니다."); }
   else { setJobs(next); setMessage("실패한 파일을 다시 시도하거나 제외해주세요. 성공한 파일은 다시 업로드하지 않습니다."); }
  } finally { if (!abort.signal.aborted) { setRunning(false); onBusy(false); } }
 }
 function remove(id: string) {
  const next = jobs.filter(j => j.id !== id);
  if (next.length && next.every(j => j.asset)) { onComplete(next.map(j => j.asset!)); setJobs([]); }
  else setJobs(next);
 }
 return <section className="space-y-2 rounded-lg border border-zinc-200 p-3">
  <label className="block text-sm font-bold">{label}<input type="file" accept="image/png,image/jpeg,image/webp" multiple={multiple} disabled={disabled || !!jobs.length} className="mt-2 block w-full text-sm" onChange={e => {
   const files = Array.from(e.target.files ?? []); e.target.value = "";
   if (files.length > available) { setMessage(`선택 가능한 이미지는 ${available}장입니다.`); return; }
   setJobs(files.map(file => ({ id: crypto.randomUUID(), file, error: checkWebtoonFile(file) ?? undefined }))); setMessage("");
  }} /></label>
  <p className="text-xs text-zinc-500">PNG·JPEG·WebP, 장당 10MB, 폭 4096px·높이 30000px·4천만 화소 이하. 정적 이미지만 가능합니다.</p>
  <ol className="space-y-2">{jobs.map((job, i) => <li key={job.id} className="rounded border p-2 text-sm"><span>{i + 1}. {job.file.name} · {job.asset ? "완료" : running ? "처리 중" : "대기"}</span>{job.error ? <p role="alert" className="text-red-700">{job.error}</p> : null}<button type="button" disabled={disabled || running} className="ml-2 underline" onClick={() => remove(job.id)}>파일 제외</button></li>)}</ol>
  {jobs.length ? <button type="button" disabled={disabled || running} onClick={() => void upload()} className="rounded bg-zinc-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{running ? "업로드 중…" : jobs.some(j => j.error) ? "실패 파일 재시도" : `${label.startsWith("표지") ? "표지" : "이미지"} 업로드`}</button> : null}
  <p role="status" className="text-sm">{message}</p>
 </section>;
}
