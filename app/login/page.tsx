"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

const pageClassName = cn(
  "min-h-screen bg-black px-4 py-10 pb-28 text-white sm:px-6"
);
const shellClassName = cn(
  "mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md items-center justify-center"
);
const panelClassName = cn(
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/20"
);
const primaryButtonClassName = cn(
  "inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-4 text-base font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700"
);
const secondaryButtonClassName = cn(
  "inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-base font-bold text-zinc-100 transition",
  "hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
);
const errorClassName = cn(
  "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
);

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

  const getRedirectTo = useCallback(() =>
    new URLSearchParams(window.location.search).get("redirectTo") ||
    window.location.origin + "/", []);
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
    <main className={pageClassName}>
      <div className={shellClassName}>
        <section className={panelClassName}>
          <header className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-lg font-black text-white">
              CF
            </div>
            <p className="mt-4 text-sm font-bold text-red-400">카팩트</p>
            <h1 className="mt-2 text-3xl font-black text-white">로그인</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              카카오 또는 Google 계정으로 간편하게 시작하세요.
            </p>
          </header>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={startKakaoLogin}
              disabled={!isSupabaseConfigured || !isAuthReady}
            >
              카카오로 로그인
            </button>

            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={startGoogleLogin}
              disabled={!isSupabaseConfigured || !isAuthReady}
            >
              Google로 로그인
            </button>
          </div>

          {!isSupabaseConfigured ? (
            <p className={cn(errorClassName, "mt-4")}>
              Supabase Auth 환경변수 설정이 필요합니다.
            </p>
          ) : null}

          {authError ? <p className={cn(errorClassName, "mt-4")}>{authError}</p> : null}
        </section>
      </div>
    </main>
  );
}
