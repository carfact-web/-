"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLoginPanel } from "@/components/AuthLoginPanel";
import {
  authRedirectStorageKey,
  resolveAuthRedirect,
  saveAuthRedirect,
} from "@/lib/authRedirect";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const {
    authError,
    isAuthenticated,
    isAuthReady,
    isSupabaseConfigured,
    signInWithGoogle,
    signInWithKakao,
  } = useAuth();

  const getRedirectTo = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirectTo =
      searchParams.get("redirect") ?? searchParams.get("redirectTo");

    if (!redirectTo) {
      return window.location.origin + "/";
    }

    try {
      const url = new URL(redirectTo, window.location.origin);

      if (url.origin !== window.location.origin) {
        return window.location.origin + "/";
      }

      return url.href;
    } catch {
      return window.location.origin + "/";
    }
  }, []);
  const getRedirectPath = useCallback(() => {
    return resolveAuthRedirect({ fallbackPath: "/my", shouldClear: true })
      .resolvedRedirect;
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    if (!searchParams.get("redirect") && !searchParams.get("redirectTo")) {
      return;
    }

    const redirectTo = getRedirectTo();

    saveAuthRedirect(redirectTo);
    console.log("auth-login-redirect-save", {
      redirectParam: searchParams.get("redirect"),
      redirectToParam: searchParams.get("redirectTo"),
      storedRedirect: redirectTo,
      localStorageValue: localStorage.getItem(authRedirectStorageKey),
      sessionStorageValue: sessionStorage.getItem(authRedirectStorageKey),
    });
  }, [getRedirectTo]);

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      const target = getRedirectPath();

      console.log("auth-callback-final-router", {
        hasSession: true,
        target,
        source: "login-authenticated",
      });
      router.replace(target);
    }
  }, [getRedirectPath, isAuthenticated, isAuthReady, router]);

  const startKakaoLogin = () => {
    void signInWithKakao(getRedirectTo());
  };

  const startGoogleLogin = () => {
    void signInWithGoogle(getRedirectTo());
  };

  return (
    <main className="min-h-screen bg-black pb-24">
      <AuthLoginPanel
        authError={authError}
        disabled={!isSupabaseConfigured || !isAuthReady}
        onGoogleLogin={startGoogleLogin}
        onKakaoLogin={startKakaoLogin}
      />
    </main>
  );
}
