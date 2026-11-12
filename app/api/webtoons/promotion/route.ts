import { dbError, failure, NO_STORE, publicDb } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
export async function GET() {
 try {
  const result = await publicDb().rpc("webtoon_promotion_payload"); dbError(result.error);
  return Response.json(result.data, { headers: NO_STORE });
 } catch (error) { return failure(error); }
}
