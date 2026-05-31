"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLoginPanel } from "@/components/AuthLoginPanel";
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
    const redirectTo = new URLSearchParams(window.location.search).get("redirectTo");

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
    try {
      const url = new URL(getRedirectTo(), window.location.origin);

      if (url.origin !== window.location.origin) {
        return "/";
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/";
    }
  }, [getRedirectTo]);

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      router.replace(getRedirectPath());
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
