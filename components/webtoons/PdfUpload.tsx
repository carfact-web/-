"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PDF_MAX_BYTES, PDF_MAX_PAGES } from "@/lib/webtoons/pdf-limits";
import type { WebtoonAsset } from "@/types/webtoon";
export function PdfUpload({ workId, disabled, onBusy, onComplete }: { workId: string; disabled: boolean; onBusy: (busy: boolean) => void; onComplete: (asset: WebtoonAsset) => void }) {
 const [file, setFile] = useState<File | null>(null), [progress, setProgress] = useState(0), [error, setError] = useState(""), [running, setRunning] = useState(false);
 const request = useRef<XMLHttpRequest | null>(null); useEffect(() => () => request.current?.abort(), []);
 async function upload() {
  if (!file) return; setError(""); setRunning(true); onBusy(true); setProgress(0);
  try {
   const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
   const form = new FormData(); form.set("workId", workId); form.set("file", file);
   const asset = await new Promise<WebtoonAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); request.current = xhr; xhr.open("POST", "/api/admin/webtoons/pdf-upload"); xhr.setRequestHeader("Authorization", "Bearer " + (data.session?.access_token ?? ""));
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => { let body; try { body = JSON.parse(xhr.responseText); } catch { reject(Error("PDF 처리 응답을 읽지 못했습니다. 다시 시도해주세요.")); return; } if (xhr.status >= 200 && xhr.status < 300) resolve(body); else reject(Error(body.error || "업로드에 실패했습니다. 다시 시도해주세요.")); };
    xhr.onerror = () => reject(Error("네트워크 오류로 업로드에 실패했습니다. 파일을 유지한 채 다시 시도할 수 있습니다.")); xhr.onabort = () => reject(Error("업로드가 중단됐습니다.")); xhr.send(form);
   }); onComplete(asset); setFile(null);
  } catch (e) { setError(e instanceof Error ? e.message : "업로드에 실패했습니다."); }
  finally { setRunning(false); onBusy(false); }
 }
 return <section className="space-y-3 rounded border p-3"><label className="block text-sm font-bold">회차 PDF 선택<input disabled={disabled} type="file" accept="application/pdf,.pdf" className="mt-2 block w-full text-sm" onChange={e => { const selected = e.target.files?.[0] ?? null; e.target.value = ""; setError(""); if (selected && (selected.type !== "application/pdf" || !selected.size || selected.size > PDF_MAX_BYTES)) { setError("PDF 한 개, 50MiB 이하 파일을 선택해주세요."); return; } setFile(selected); }} /></label>
  <p className="text-xs text-zinc-600">일반 분량 30~40페이지 · 최대 {PDF_MAX_PAGES}페이지 / 50MiB · 암호화 PDF 미지원. 서버 검증은 15초·192MiB 예산으로 처리합니다. 모바일은 주변 최대 5페이지만 렌더링합니다.</p>
  {file ? <p className="break-all text-sm">{file.name} · {(file.size / 1048576).toFixed(1)}MiB</p> : null}
  {running ? <div role="status"><progress max={100} value={progress} className="w-full" />PDF 업로드 {progress}%{progress === 100 ? " · 서버 검증·저장 중…" : ""}</div> : null}
  {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
  <button className="rounded border bg-zinc-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={disabled || !file || running} onClick={() => void upload()}>{running ? "PDF 처리 중…" : error ? "PDF 업로드 재시도" : "PDF 업로드"}</button>
 </section>;
}
