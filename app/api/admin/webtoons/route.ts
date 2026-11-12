import { bool, dbError, failure, integer, NO_STORE, requireWebtoonAdmin, title, uuid, WebtoonError } from "@/lib/server/webtoons/core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request);
  const workId = new URL(request.url).searchParams.get("workId");
  const works = await db.from("webtoon_works").select("*").order("created_at", { ascending: false }).limit(200); dbError(works.error);
  if (!workId) return Response.json({ works: works.data, episodes: [], assets: [] }, { headers: NO_STORE });
  uuid(workId);
  const [episodes, assets] = await Promise.all([
   db.from("webtoon_episodes").select("*").eq("work_id", workId).order("number").limit(500),
   db.from("webtoon_assets").select("*").eq("work_id", workId).eq("state", "ready").order("created_at").limit(5000),
  ]); dbError(episodes.error); dbError(assets.error);
  const ids = (episodes.data ?? []).map(e => e.id);
  const pages = ids.length ? await db.from("webtoon_episode_pages").select("*").in("episode_id", ids).order("position") : { data: [], error: null };
  dbError(pages.error);
  return Response.json({ works: works.data, episodes: (episodes.data ?? []).map(e => ({ ...e, page_ids: (pages.data ?? []).filter(p => p.episode_id === e.id).map(p => p.asset_id) })), assets: assets.data }, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request); const body = await request.json();
  if (body.kind === "work") {
   const result = await db.from("webtoon_works").insert({ title: title(body.title) }).select().single(); dbError(result.error);
   return Response.json(result.data, { status: 201, headers: NO_STORE });
  }
  if (body.kind !== "episode") throw new WebtoonError("등록 유형을 확인해주세요.");
  const result = await db.from("webtoon_episodes").insert({ work_id: uuid(body.workId), title: title(body.title), number: integer(body.number) }).select().single(); dbError(result.error);
  return Response.json(result.data, { status: 201, headers: NO_STORE });
 } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request); const body = await request.json();
  if (body.kind === "work") {
   if (typeof body.description !== "string" || body.description.length > 5000) throw new WebtoonError("소개는 5,000자 이내로 입력해주세요.");
   const result = await db.rpc("webtoon_save_work", { p_id: uuid(body.id), p_version: integer(body.version), p_title: title(body.title), p_description: body.description, p_cover: body.coverAssetId === null ? null : uuid(body.coverAssetId), p_published: bool(body.published) }); dbError(result.error);
   return Response.json(result.data, { headers: NO_STORE });
  }
  if (body.kind !== "episode" || !Array.isArray(body.pageIds) || body.pageIds.length > 100) throw new WebtoonError("회차 이미지 수는 100장 이내로 선택해주세요.");
  const result = await db.rpc("webtoon_save_episode", { p_id: uuid(body.id), p_version: integer(body.version), p_title: title(body.title), p_number: integer(body.number), p_published: bool(body.published), p_assets: body.pageIds.map(uuid), p_type: body.contentType === "pdf" ? "pdf" : "images", p_pdf: body.pdfAssetId ? uuid(body.pdfAssetId) : null }); dbError(result.error);
  return Response.json(result.data, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
// Content is unpublished and detached, not hard-deleted. Orphan deletion has its own admin-only route.
