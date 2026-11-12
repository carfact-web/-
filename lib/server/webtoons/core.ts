import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";

export const WEBTOON_BUCKET = "webtoon-private";
export const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
export class WebtoonError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function uuid(value: unknown) {
 if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new WebtoonError("유효한 항목을 선택해주세요.");
 return value;
}
export function title(value: unknown) {
 if (typeof value !== "string" || !value.trim() || value.trim().length > 120) throw new WebtoonError("제목은 1~120자로 입력해주세요.");
 return value.trim();
}
export function integer(value: unknown, max = 99999) {
 if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) throw new WebtoonError("번호와 버전을 올바르게 입력해주세요.");
 return value;
}
export function bool(value: unknown) { if (typeof value !== "boolean") throw new WebtoonError("공개 여부를 선택해주세요."); return value; }
export function dbError(error: { code?: string; message?: string } | null) {
 if (!error) return;
 if (error.code === "23505") throw new WebtoonError("이미 사용 중인 회차 번호입니다.", 409);
 if (error.message?.includes("edit_conflict")) throw new WebtoonError("다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 편집해주세요.", 409);
 if (error.message?.includes("not_found")) throw new WebtoonError("항목을 찾을 수 없습니다.", 404);
 if (error.message?.includes("cover_required")) throw new WebtoonError("공개하려면 표지를 선택해주세요.");
 if (error.message?.includes("invalid_pdf")) throw new WebtoonError("공개할 PDF 한 개를 업로드하고 이미지 목록을 비워주세요.");
 if (error.message?.includes("invalid_pages")) throw new WebtoonError("공개할 회차에는 이미지가 1~100장 필요합니다.");
 if (error.message?.includes("invalid_asset") || error.message?.includes("duplicate_pages")) throw new WebtoonError("같은 작품의 업로드 완료 이미지만 중복 없이 선택해주세요.");
 throw new WebtoonError("저장소 처리에 실패했습니다. 잠시 후 다시 시도해주세요.", 503);
}
export function failure(error: unknown) {
 const known = error instanceof WebtoonError;
 return Response.json({ error: known ? error.message : "처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: known ? error.status : 500, headers: NO_STORE });
}
export function publicDb() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if (!url || !key) throw new WebtoonError("서비스 설정을 확인해주세요.", 503);
 return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireWebtoonAdmin(request: Request) {
 const clients = getSupabaseAdminClients();
 if (!clients) throw new WebtoonError("관리자 서비스 설정을 확인해주세요.", 503);
 const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 // A service key is not a human administrator session.
 if (!token || token === process.env.SUPABASE_SERVICE_ROLE_KEY) throw new WebtoonError("관리자 로그인이 필요합니다.", 401);
 const { data, error } = await clients.auth.auth.getUser(token);
 if (error || !data.user) throw new WebtoonError("로그인 세션을 확인해주세요.", 401);
 const result = await clients.admin.from("user_profiles").select("role,is_suspended").eq("id", data.user.id).maybeSingle();
 if (result.error || !result.data || result.data.is_suspended || !["admin", "super_admin"].includes(result.data.role)) throw new WebtoonError("관리자 권한이 필요합니다.", 403);
 return clients.admin;
}
export function privilegedDb() {
 const clients = getSupabaseAdminClients();
 if (!clients) throw new WebtoonError("이미지 서비스를 사용할 수 없습니다.", 503);
 return clients.admin;
}
