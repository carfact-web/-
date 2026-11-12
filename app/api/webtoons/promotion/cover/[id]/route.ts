import sharp from "sharp";
import { dbError, failure, NO_STORE, privilegedDb, publicDb, uuid, WEBTOON_BUCKET, WebtoonError } from "@/lib/server/webtoons/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function visibleCover(id: string) {
 const db = publicDb();
 const episode = await db.from("webtoon_episodes").select("work_id").eq("id", id).eq("published", true).maybeSingle(); dbError(episode.error);
 if (!episode.data) return null;
 const work = await db.from("webtoon_works").select("cover_asset_id").eq("id", episode.data.work_id).eq("published", true).maybeSingle(); dbError(work.error);
 if (!work.data?.cover_asset_id) return null;
 const asset = await db.from("webtoon_assets").select("id,object_key").eq("id", work.data.cover_asset_id).eq("mime", "image/webp").eq("state", "ready").maybeSingle(); dbError(asset.error);
 return asset.data;
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 try {
  const id = uuid((await params).id), asset = await visibleCover(id);
  if (!asset) throw new WebtoonError("공개 홍보 표지가 없습니다.", 404);
  const stored = await privilegedDb().storage.from(WEBTOON_BUCKET).download(asset.object_key);
  if (stored.error || !stored.data) throw new WebtoonError("표지를 불러오지 못했습니다.", 404);
  const image = await sharp(Buffer.from(await stored.data.arrayBuffer()), { limitInputPixels: 40000000 }).rotate().resize({ width: 360, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const again = await visibleCover(id);
  if (!again || again.id !== asset.id) throw new WebtoonError("공개 홍보 표지가 없습니다.", 404);
  return new Response(new Uint8Array(image), { headers: { ...NO_STORE, "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="webtoon-promotion.webp"', "Content-Security-Policy": "default-src 'none'; sandbox" } });
 } catch (error) { return failure(error); }
}
