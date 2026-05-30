"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

type AuthMethod = "google" | "email";

const pageClassName = cn(
  "min-h-screen bg-black px-4 py-8 pb-28 text-white sm:px-6"
);
const shellClassName = cn("mx-auto flex w-full max-w-3xl flex-col gap-6");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20"
);
const methodButtonClassName = cn(
  "flex-1 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-bold text-zinc-400 transition",
  "hover:border-zinc-600 hover:bg-zinc-900 hover:text-white"
);
const activeMethodButtonClassName = cn(
  "border-red-500/50 bg-red-500/10 text-red-200"
);
const primaryButtonClassName = cn(
  "mt-4 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-4 text-base font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700"
);
const infoClassName = cn(
  "rounded-lg border border-zinc-800 bg-black/40 px-4 py-3 text-sm leading-6 text-zinc-400"
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
  const [authMethod, setAuthMethod] = useState<AuthMethod>("google");

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
        <header>
          <p className="text-xs font-semibold text-red-500">카팩트 로그인</p>
          <h1 className="mt-2 text-3xl font-black text-white">
            로그인 방식을 선택하세요.
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            카카오 계정으로 로그인하면 차량 리포트를 제한 없이 확인하고
            후기를 작성할 수 있습니다.
          </p>
        </header>

        <section className={panelClassName}>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={startKakaoLogin}
            disabled={!isSupabaseConfigured || !isAuthReady}
          >
            카카오로 로그인
          </button>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={cn(
                methodButtonClassName,
                authMethod === "google" && activeMethodButtonClassName
              )}
              onClick={() => setAuthMethod("google")}
            >
              Google
            </button>
            <button
              type="button"
              className={cn(
                methodButtonClassName,
                authMethod === "email" && activeMethodButtonClassName
              )}
              onClick={() => setAuthMethod("email")}
            >
              이메일
            </button>
          </div>

          {authMethod === "google" ? (
            <>
              <button
                type="button"
                className={cn(primaryButtonClassName, "bg-zinc-800 hover:bg-zinc-700")}
                onClick={startGoogleLogin}
                disabled={!isSupabaseConfigured || !isAuthReady}
              >
                Google로 로그인
              </button>

              <p className={cn(infoClassName, "mt-4")}>
                카카오 로그인은 Supabase Authentication Providers의 Kakao
                설정을 사용합니다. Google은 운영 보조 로그인 수단으로 남겨둡니다.
              </p>
            </>
          ) : (
            <div className={cn(infoClassName, "mt-4")}>
              이메일 로그인은 현재 비활성화되어 있습니다. 카팩트 기본 로그인은
              카카오 OAuth입니다.
            </div>
          )}

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
