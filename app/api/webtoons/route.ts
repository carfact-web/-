import { dbError, failure, NO_STORE, publicDb } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
export async function GET() {
 try {
  const result = await publicDb().from("webtoon_works").select("*").order("updated_at", { ascending: false }).limit(200); dbError(result.error);
  return Response.json({ works: result.data }, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
