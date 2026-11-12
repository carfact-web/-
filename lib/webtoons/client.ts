"use client";
import { supabase } from "@/lib/supabase";
export async function webtoonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
 const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
 const headers = new Headers(init.headers);
 if (data.session?.access_token) headers.set("Authorization", "Bearer " + data.session.access_token);
 const response = await fetch(path, { ...init, headers, cache: "no-store" });
 const result = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(result.error || "요청에 실패했습니다. 다시 시도해주세요.");
 return result;
}
export const mediaUrl = (id: string) => "/api/webtoons/media/" + encodeURIComponent(id);
export function checkWebtoonFile(file: File) {
 if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "PNG·JPEG·WebP만 업로드할 수 있습니다.";
 if (!file.size || file.size > 10 * 1024 * 1024) return "이미지는 한 장에 10MB 이하여야 합니다.";
 return null;
}
