import { dbError, failure, NO_STORE, privilegedDb, publicDb, requireWebtoonAdmin, uuid, WEBTOON_BUCKET, WebtoonError } from "@/lib/server/webtoons/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await params; uuid(id);
  const visible = await publicDb().from("webtoon_assets").select("id,object_key,mime").eq("id", id).eq("state", "ready").maybeSingle(); dbError(visible.error);
  let asset = visible.data; let adminPreview = false;
  if (!asset && request.headers.has("authorization")) {
   const db = await requireWebtoonAdmin(request);
   const result = await db.from("webtoon_assets").select("id,object_key,mime").eq("id", id).eq("state", "ready").maybeSingle(); dbError(result.error); asset = result.data; adminPreview = true;
  }
  if (!asset) throw new WebtoonError("공개된 이미지를 찾을 수 없습니다.", 404);
  const result = await privilegedDb().storage.from(WEBTOON_BUCKET).download(asset.object_key);
  if (result.error || !result.data) throw new WebtoonError("이미지를 불러오지 못했습니다.", 404);
  if (!adminPreview) {
   const again = await publicDb().from("webtoon_assets").select("id").eq("id", id).eq("state", "ready").maybeSingle(); dbError(again.error);
   if (!again.data) throw new WebtoonError("공개된 이미지를 찾을 수 없습니다.", 404);
  }
  return new Response(new Uint8Array(await result.data.arrayBuffer()), { headers: { ...NO_STORE, "Content-Type": asset.mime, "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": asset.mime === "application/pdf" ? 'inline; filename="webtoon.pdf"' : 'inline; filename="webtoon.webp"' } });
 } catch (error) { return failure(error); }
}
