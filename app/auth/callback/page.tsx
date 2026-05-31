"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authRedirectStorageKey } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const getSafeRedirectPath = () => {
  const fallbackPath = "/my";
  const redirectTo = localStorage.getItem(authRedirectStorageKey);

  localStorage.removeItem(authRedirectStorageKey);

  if (!redirectTo) {
    return fallbackPath;
  }

  try {
    const url = new URL(redirectTo, window.location.origin);

    if (url.origin !== window.location.origin) {
      return fallbackPath;
    }

    return url.pathname + url.search + url.hash;
  } catch {
    return fallbackPath;
  }
};

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      router.replace("/login");
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        router.replace(data.session ? getSafeRedirectPath() : "/login");
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <p className="text-sm text-white/70">로그인 처리 중...</p>
    </main>
  );
}
