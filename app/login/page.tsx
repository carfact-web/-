"use client";

import { useEffect, useState } from "react";
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
  } = useAuth();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("google");

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isAuthReady, router]);

  const startGoogleLogin = () => {
    void signInWithGoogle(window.location.origin + "/");
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
            1단계에서는 Google 로그인을 우선 연결하고, 이메일 로그인은 같은
            구조에서 확장할 수 있게 준비합니다.
          </p>
        </header>

        <section className={panelClassName}>
          <div className="flex gap-2">
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
                className={primaryButtonClassName}
                onClick={startGoogleLogin}
                disabled={!isSupabaseConfigured || !isAuthReady}
              >
                Google로 로그인
              </button>

              <p className={cn(infoClassName, "mt-4")}>
                Supabase Dashboard에서 Authentication &gt; Providers &gt;
                Google을 활성화하고 Google OAuth Client ID/Secret 및 redirect
                URL을 설정해야 실제 로그인이 완료됩니다.
              </p>
            </>
          ) : (
            <div className={cn(infoClassName, "mt-4")}>
              이메일 로그인은 다음 단계에서 같은 인증 훅에 연결할 수 있도록
              방식만 분리해 두었습니다. 이번 1단계에서는 Google 로그인을
              우선 사용합니다.
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
