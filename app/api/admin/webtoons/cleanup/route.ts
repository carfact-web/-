import { dbError, failure, NO_STORE, requireWebtoonAdmin, uuid, WEBTOON_BUCKET } from "@/lib/server/webtoons/core";
export const runtime = "nodejs";
export async function POST(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request); const { workId } = await request.json();
  const claimed = await db.rpc("webtoon_claim_orphans", { p_work: uuid(workId) }); dbError(claimed.error);
  let removed = 0, failed = 0;
  for (const asset of claimed.data ?? []) {
   const result = await db.storage.from(WEBTOON_BUCKET).remove([asset.object_key]);
   if (result.error) { failed++; continue; }
   const deleted = await db.from("webtoon_assets").delete().eq("id", asset.id).eq("state", "deleting");
   if (deleted.error) failed++; else removed++;
  }
  return Response.json({ removed, failed, message: "24시간 지난 미사용 파일만 정리합니다. 저장된 작품·회차의 이미지는 유지됩니다." }, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
