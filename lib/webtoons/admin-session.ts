"use client";
export async function clearWebtoonAdminSession() {
 const response = await fetch("/api/admin/webtoons/session", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
 if (!response.ok) throw new Error("관리자 화면 세션을 정리하지 못했습니다. 다시 시도해주세요.");
}
