"use client";
/* eslint-disable @next/next/no-img-element -- Private image bytes require authenticated fetch and revocable blob URLs. */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mediaUrl } from "@/lib/webtoons/client";
export function AdminImage({ id, alt }: { id: string; alt: string }) {
 const [url, setUrl] = useState(""); const [failed, setFailed] = useState(false);
 useEffect(() => {
  const controller = new AbortController(); let objectUrl = "";
  async function load() {
   const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
   const response = await fetch(mediaUrl(id), { headers: { Authorization: "Bearer " + (data.session?.access_token ?? "") }, cache: "no-store", signal: controller.signal });
   if (!response.ok) throw new Error("preview failed");
   const blob = await response.blob(); if (controller.signal.aborted) return;
   objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
  }
  load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
  return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
 }, [id]);
 return url ? <img src={url} alt={alt} className="max-h-64 w-full rounded object-contain" /> : <p className="p-4 text-sm text-zinc-500">{failed ? "미리보기를 불러오지 못했습니다. 새로고침해주세요." : "미리보기 불러오는 중…"}</p>;
}
