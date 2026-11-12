import "server-only";
import { Worker } from "node:worker_threads";
import path from "node:path";
import { PDF_MAX_PAGES, PDF_VALIDATION_TIMEOUT_MS, PDF_WORKER_HEAP_MB } from "@/lib/webtoons/pdf-limits";
import { WebtoonError } from "./core";
interface Metadata { count: number; sizes: { width: number; height: number }[]; elapsedMs: number; heapBytes: number; }
export async function validatePdf(input: Buffer): Promise<Metadata> {
 return new Promise((resolve, reject) => {
  const worker = new Worker(path.join(process.cwd(), "lib/server/webtoons/pdf-validate-worker.cjs"), { resourceLimits: { maxOldGenerationSizeMb: PDF_WORKER_HEAP_MB } });
  let finished = false;
  const done = (error?: Error, result?: Metadata) => { if (finished) return; finished = true; clearTimeout(timer); void worker.terminate(); if (error) reject(error); else resolve(result!); };
  const timer = setTimeout(() => done(new WebtoonError("PDF 검증 시간이 초과됐습니다. 파일을 최적화한 후 다시 시도해주세요.", 422)), PDF_VALIDATION_TIMEOUT_MS);
  worker.once("error", () => done(new WebtoonError("PDF 처리 메모리 한도를 초과했거나 검증에 실패했습니다. 최적화한 PDF로 다시 시도해주세요.", 422)));
  worker.once("exit", code => { if (code !== 0) done(new WebtoonError("PDF 검증을 완료하지 못했습니다. 다시 시도해주세요.", 422)); });
  worker.once("message", data => {
   if (data.ok) done(undefined, data);
   else done(new WebtoonError(data.code === "ENCRYPTED" ? "암호화된 PDF는 지원하지 않습니다. 암호화를 해제한 사본을 업로드해주세요." : data.code === "PAGES" ? `PDF는 1~${PDF_MAX_PAGES}페이지까지 가능합니다. 30~40페이지는 일반적인 권장 분량입니다.` : data.code === "DIMENSIONS" ? "PDF 페이지 크기나 가로세로 비율이 처리 범위를 벗어났습니다." : "손상되었거나 올바른 PDF가 아닙니다. PDF로 다시 내보내어 업로드해주세요.", 422));
  });
  const copy = Uint8Array.from(input); worker.postMessage({ bytes: copy, maxPages: PDF_MAX_PAGES }, [copy.buffer]);
 });
}
