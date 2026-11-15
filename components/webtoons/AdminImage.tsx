"use client";
/* eslint-disable @next/next/no-img-element -- Private image bytes require authenticated fetch and revocable blob URLs. */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mediaUrl } from "@/lib/webtoons/client";
export function AdminImage({
  id,
  alt,
  fullSize = false,
}: {
  id: string;
  alt: string;
  fullSize?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!fullSize);
  useEffect(() => {
    if (!fullSize) return;
    const node = holder.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fullSize]);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl = "";
    async function load() {
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      const response = await fetch(mediaUrl(id), {
        headers: {
          Authorization: "Bearer " + (data.session?.access_token ?? ""),
        },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("preview failed");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }
    load().catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, visible]);
  return (
    <div ref={holder} style={{ minHeight: fullSize && !url ? 300 : undefined }}>
      {url ? (
        <img
          src={url}
          alt={alt}
          className={
            fullSize
              ? "block h-auto w-full"
              : "max-h-64 w-full rounded object-contain"
          }
        />
      ) : (
        <p className="p-4 text-sm text-zinc-500">
          {failed
            ? "미리보기를 불러오지 못했습니다. 새로고침해주세요."
            : "미리보기 불러오는 중…"}
        </p>
      )}
    </div>
  );
}
