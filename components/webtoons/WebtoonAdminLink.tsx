"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { webtoonRequest } from "@/lib/webtoons/client";
export function WebtoonAdminLink({ className }: { className?: string }) {
 const { isAdmin, isAuthReady, isProfileReady, profile } = useAuth();
 const [busy, setBusy] = useState(false), [error, setError] = useState("");
 if (!isAuthReady || !isProfileReady || !isAdmin || profile?.is_suspended) return null;
 return <><Link href="/admin/webtoons" prefetch={false} className={className} aria-disabled={busy} onClick={async event => {
  event.preventDefault(); if (busy) return; setBusy(true); setError("");
  try { await webtoonRequest("/api/admin/webtoons/session", { method: "POST" }); window.location.assign("/admin/webtoons"); }
  catch (e) { setError(e instanceof Error ? e.message : "관리자 화면에 연결하지 못했습니다."); setBusy(false); }
 }}>웹툰 관리</Link>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}</>;
}
