"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveAuthRedirect } from "@/lib/authRedirect";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const getSafeRedirectPath = () => {
  const redirect = resolveAuthRedirect({
    fallbackPath: "/my",
    shouldClear: true,
  });

  console.log("auth-callback-query", {
    href: redirect.currentHref,
    search: redirect.currentSearch,
    redirectParam: redirect.redirectParam,
    redirectToParam: redirect.redirectToParam,
    localStorageRedirect: redirect.localStorageRedirect,
    sessionStorageRedirect: redirect.sessionStorageRedirect,
  });
  console.log("auth-callback-resolved-redirect", {
    source: redirect.source,
    redirectTo: redirect.redirectTo,
    resolvedRedirect: redirect.resolvedRedirect,
    reason: redirect.redirectTo ? "ok" : "missing redirect",
  });

  return redirect.resolvedRedirect;
};

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      console.log("auth-callback-final-router", {
        hasSession: false,
        target: "/login",
        reason: "supabase not configured",
      });
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

      const finalRouterTarget = sessionResult.data.session
        ? getSafeRedirectPath()
        : "/login";

      console.log("auth-callback-final-router", {
        hasSession: Boolean(sessionResult.data.session),
        target: finalRouterTarget,
      });
      router.replace(finalRouterTarget);
    };

    handleAuthCallback()
      .catch((error) => {
        console.log("supabase-auth-callback-error", {
          error: error instanceof Error ? error.message : "callback failed",
        });
        console.log("auth-callback-final-router", {
          hasSession: false,
          target: "/login",
          reason: "callback error",
        });
        router.replace("/login");
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <p className="text-sm text-white/70">로그인 처리 중...</p>
    </main>
  );
}
