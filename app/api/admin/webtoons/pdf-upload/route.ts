import { randomUUID } from "node:crypto";
import { PDF_MAX_BYTES } from "@/lib/webtoons/pdf-limits";
import { validatePdf } from "@/lib/server/webtoons/pdf";
import { dbError, failure, NO_STORE, requireWebtoonAdmin, uuid, WEBTOON_BUCKET, WebtoonError } from "@/lib/server/webtoons/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let processing = false;
export async function POST(request: Request) {
 let acquired = false;
 try {
  const db = await requireWebtoonAdmin(request);
  if (processing) throw new WebtoonError("다른 PDF를 처리하고 있습니다. 완료 후 다시 시도해주세요.", 429);
  if (Number(request.headers.get("content-length") ?? 0) > PDF_MAX_BYTES + 65536) throw new WebtoonError("PDF는 50MiB 이하여야 합니다.", 413);
  processing = true; acquired = true;
  const reader = request.body?.getReader(); if (!reader) throw new WebtoonError("PDF를 선택해주세요.");
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const item = await reader.read(); if (item.done) break; total += item.value.length; if (total > PDF_MAX_BYTES + 65536) { await reader.cancel(); throw new WebtoonError("PDF는 50MiB 이하여야 합니다.", 413); } chunks.push(item.value); }
  const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  const file = form.get("file"), workId = uuid(form.get("workId"));
  if (form.getAll("file").length !== 1 || !(file instanceof File) || file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) throw new WebtoonError("PDF 파일 한 개를 선택해주세요.", 415);
  if (!file.size || file.size > PDF_MAX_BYTES) throw new WebtoonError("PDF는 50MiB 이하여야 합니다.", 413);
  const work = await db.from("webtoon_works").select("id").eq("id", workId).maybeSingle(); dbError(work.error); if (!work.data) throw new WebtoonError("작품을 먼저 저장해주세요.", 404);
  const bytes = Buffer.from(await file.arrayBuffer()), meta = await validatePdf(bytes), id = randomUUID(), key = `${workId}/${id}.pdf`;
  const inserted = await db.from("webtoon_assets").insert({ id, work_id: workId, object_key: key, mime: "application/pdf", width: null, height: null, bytes: bytes.length, state: "uploading", page_count: meta.count, page_sizes: meta.sizes }); dbError(inserted.error);
  const uploaded = await db.storage.from(WEBTOON_BUCKET).upload(key, bytes, { contentType: "application/pdf", cacheControl: "0", upsert: false });
  if (uploaded.error) { const removed = await db.storage.from(WEBTOON_BUCKET).remove([key]); if (!removed.error) await db.from("webtoon_assets").delete().eq("id", id); throw new WebtoonError("PDF 업로드에 실패했습니다. 선택한 파일로 다시 시도해주세요.", 502); }
  const saved = await db.from("webtoon_assets").update({ state: "ready" }).eq("id", id).select().single(); dbError(saved.error);
  return Response.json({ ...saved.data, validation_ms: meta.elapsedMs, validation_heap_bytes: meta.heapBytes }, { status: 201, headers: NO_STORE });
 } catch (error) { return failure(error); }
 finally { if (acquired) processing = false; }
}
