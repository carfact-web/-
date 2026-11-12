import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import WebtoonAdminEditor from "@/components/webtoons/WebtoonAdminEditor";
import { requireWebtoonAdmin, WebtoonError } from "@/lib/server/webtoons/core";
export const dynamic = "force-dynamic";
export default async function WebtoonAdminPage() {
 const incoming = await headers(), cookie = (await cookies()).get("carfact_webtoon_admin")?.value;
 const authorization = incoming.get("authorization") || (cookie ? "Bearer " + cookie : "");
 try {
  await requireWebtoonAdmin(new Request("http://carfact.internal/admin/webtoons", { headers: { authorization } }));
 } catch (error) {
  if (error instanceof WebtoonError && [401, 403].includes(error.status)) notFound();
  throw error;
 }
 return <WebtoonAdminEditor />;
}
