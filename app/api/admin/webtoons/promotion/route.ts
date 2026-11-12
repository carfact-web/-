import { bool, dbError, failure, integer, NO_STORE, requireWebtoonAdmin, uuid, WebtoonError } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request);
  const [settings, choices] = await Promise.all([
   db.from("webtoon_promotion").select("*").eq("id", 1).single(),
   db.from("webtoon_episodes").select("id,title,work_id,content_type,published_at,webtoon_works!inner(title,published)").eq("published", true).eq("webtoon_works.published", true).order("published_at", { ascending: false }).limit(1000),
  ]); dbError(settings.error); dbError(choices.error);
  return Response.json({ settings: settings.data, choices: choices.data }, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
function instant(value: unknown): string | null {
 if (value === null || value === "") return null;
 if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new WebtoonError("노출 시간을 올바르게 입력해주세요.");
 return new Date(value).toISOString();
}
export async function PUT(request: Request) {
 try {
  const db = await requireWebtoonAdmin(request); const body = await request.json();
  const enabled = bool(body.enabled), episode = body.episode_id ? uuid(body.episode_id) : null;
  if (typeof body.message !== "string" || body.message.trim().length > 280) throw new WebtoonError("안내 문구는 280자 이내로 입력해주세요.");
  const starts = instant(body.starts_at), ends = instant(body.ends_at);
  if ((starts && ends && Date.parse(ends) <= Date.parse(starts)) || (enabled && (!episode || !starts || !ends || !body.message.trim()))) throw new WebtoonError("공개 회차, 안내 문구, 올바른 시작·종료일을 입력해주세요.");
  if (episode) { const visible = await db.rpc("webtoon_promotion_card", { p_id: episode }); dbError(visible.error); if (!visible.data) throw new WebtoonError("홍보할 공개 회차를 선택해주세요."); }
  const result = await db.from("webtoon_promotion").update({ episode_id: episode, message: body.message.trim(), starts_at: starts, ends_at: ends, enabled, version: integer(body.version) + 1, updated_at: new Date().toISOString() }).eq("id", 1).eq("version", body.version).select().maybeSingle(); dbError(result.error);
  if (!result.data) throw new WebtoonError("다른 변경이 먼저 저장됐습니다. 다시 불러온 후 편집해주세요.", 409);
  if (enabled && episode) {
   const again = await db.rpc("webtoon_promotion_card", { p_id: episode }); dbError(again.error);
   if (!again.data) {
    const stopped = await db.from("webtoon_promotion").update({ enabled: false, version: result.data.version + 1 }).eq("id", 1).eq("version", result.data.version); dbError(stopped.error);
    throw new WebtoonError("공개 상태가 변경됐습니다. 다시 불러온 후 설정해주세요.", 409);
   }
  }
  return Response.json(result.data, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
