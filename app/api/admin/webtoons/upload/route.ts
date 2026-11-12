import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { dbError, failure, NO_STORE, requireWebtoonAdmin, uuid, WEBTOON_BUCKET, WebtoonError } from "@/lib/server/webtoons/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;
export async function POST(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 65536) throw new WebtoonError("이미지는 한 장에 10MB 이하여야 합니다.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WebtoonError("이미지를 선택해주세요.");
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
   const chunk = await reader.read(); if (chunk.done) break;
   total += chunk.value.byteLength;
   if (total > MAX_BYTES + 65536) { await reader.cancel(); throw new WebtoonError("이미지는 한 장에 10MB 이하여야 합니다.", 413); }
   chunks.push(chunk.value);
  }
  const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  const file = form.get("file"), workId = uuid(form.get("workId"));
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) throw new WebtoonError("이미지는 한 장에 10MB 이하여야 합니다.", 413);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new WebtoonError("PNG·JPEG·WebP 이미지만 업로드할 수 있습니다.", 415);
  const work = await db.from("webtoon_works").select("id").eq("id", workId).maybeSingle(); dbError(work.error); if (!work.data) throw new WebtoonError("작품을 먼저 저장해주세요.", 404);
  let buffer: Buffer, width: number, height: number;
  try {
   const input = Buffer.from(await file.arrayBuffer());
   const image = sharp(input, { limitInputPixels: 40000000, animated: false });
   const meta = await image.metadata();
   if (!["png", "jpeg", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1 || !meta.width || !meta.height || meta.width > 4096 || meta.height > 30000) throw new Error("invalid image");
   const output = await image.rotate().webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
   buffer = output.data; width = output.info.width; height = output.info.height;
   if (buffer.length > MAX_BYTES || width > 4096 || height > 30000) throw new Error("invalid dimensions");
  } catch { throw new WebtoonError("이미지를 읽을 수 없습니다. 정적 PNG·JPEG·WebP, 폭 4096px·높이 30000px·4천만 화소 이하인지 확인해주세요.", 415); }
  const id = randomUUID(), key = `${workId}/${id}.webp`;
  const inserted = await db.from("webtoon_assets").insert({ id, work_id: workId, object_key: key, mime: "image/webp", width, height, bytes: buffer.length, state: "uploading" }); dbError(inserted.error);
  const uploaded = await db.storage.from(WEBTOON_BUCKET).upload(key, buffer, { contentType: "image/webp", upsert: false, cacheControl: "0" });
  if (uploaded.error) {
   const cleanup = await db.storage.from(WEBTOON_BUCKET).remove([key]);
   if (!cleanup.error) await db.from("webtoon_assets").delete().eq("id", id);
   throw new WebtoonError("업로드에 실패했습니다. 파일은 목록에 남아 있으니 다시 시도해주세요.", 502);
  }
  const saved = await db.from("webtoon_assets").update({ state: "ready" }).eq("id", id).select().single(); dbError(saved.error);
  return Response.json(saved.data, { status: 201, headers: NO_STORE });
 } catch (error) { return failure(error); }
}
