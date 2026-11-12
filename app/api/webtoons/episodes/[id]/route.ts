import { dbError, failure, NO_STORE, publicDb, uuid, WebtoonError } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await params; uuid(id); const db = publicDb();
  const episode = await db.from("webtoon_episodes").select("*").eq("id", id).maybeSingle(); dbError(episode.error); if (!episode.data) throw new WebtoonError("공개된 회차를 찾을 수 없습니다.", 404);
  const [work, neighbors, pages] = await Promise.all([
   db.from("webtoon_works").select("*").eq("id", episode.data.work_id).maybeSingle(),
   db.from("webtoon_episodes").select("id,number").eq("work_id", episode.data.work_id).order("number"),
   db.from("webtoon_episode_pages").select("*").eq("episode_id", id).order("position"),
  ]); dbError(work.error); dbError(neighbors.error); dbError(pages.error);
  if (!work.data) throw new WebtoonError("공개된 작품을 찾을 수 없습니다.", 404);
  const ids = (pages.data ?? []).map(p => p.asset_id);
  const assets = ids.length ? await db.from("webtoon_assets").select("id,width,height").in("id", ids) : { data: [], error: null }; dbError(assets.error);
  const index = (neighbors.data ?? []).findIndex(e => e.id === id);
  return Response.json({ work: work.data, episode: episode.data, pages: (pages.data ?? []).map(p => ({ ...assets.data?.find(a => a.id === p.asset_id), id: p.asset_id })), previousId: neighbors.data?.[index - 1]?.id ?? null, nextId: neighbors.data?.[index + 1]?.id ?? null }, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
