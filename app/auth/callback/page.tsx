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

    const client = supabase;
    const handleAuthCallback = async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);

        if (error) {
          console.log("supabase-auth-callback-exchange", {
            error: error.message,
          });
        }
      }

      const [sessionResult, userResult] = await Promise.all([
        client.auth.getSession(),
        client.auth.getUser(),
      ]);

      console.log("supabase-auth-callback-session", {
        error: sessionResult.error?.message ?? null,
        sessionUserId: sessionResult.data.session?.user.id ?? null,
        hasSession: Boolean(sessionResult.data.session),
      });
      console.log("supabase-auth-callback-user", {
        error: userResult.error?.message ?? null,
        userId: userResult.data.user?.id ?? null,
      });

      router.replace(sessionResult.data.session ? getSafeRedirectPath() : "/login");
    };

    handleAuthCallback()
      .catch((error) => {
        console.log("supabase-auth-callback-error", {
          error: error instanceof Error ? error.message : "callback failed",
        });
        router.replace("/login");
      })
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <p className="text-sm text-white/70">로그인 처리 중...</p>
    </main>
  );
}
