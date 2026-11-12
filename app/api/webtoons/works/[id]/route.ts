import { dbError, failure, NO_STORE, publicDb, uuid, WebtoonError } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await params; uuid(id); const db = publicDb();
  const [work, episodes] = await Promise.all([db.from("webtoon_works").select("*").eq("id", id).maybeSingle(), db.from("webtoon_episodes").select("*").eq("work_id", id).order("number").limit(500)]);
  dbError(work.error); dbError(episodes.error); if (!work.data) throw new WebtoonError("공개된 작품을 찾을 수 없습니다.", 404);
  return Response.json({ work: work.data, episodes: episodes.data }, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
