"use client";

import { AuthLoginPanel } from "@/components/AuthLoginPanel";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

const pageClassName = cn(
  "min-h-screen bg-black px-4 py-8 pb-28 text-white sm:px-6"
);
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-sm leading-6 text-zinc-400"
);
const secondaryButtonClassName = cn(
  "inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
);
const statusClassName = cn(
  "rounded-lg border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-300"
);
const errorClassName = cn(
  "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
);

export default function MyPage() {
  const {
    authError,
    isAuthenticated,
    isAuthReady,
    isSupabaseConfigured,
    signInWithGoogle,
    signInWithKakao,
    signOut,
    user,
    userLabel,
  } = useAuth();

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black pb-24">
        <AuthLoginPanel
          authError={authError}
          disabled={!isSupabaseConfigured || !isAuthReady}
          onGoogleLogin={() => {
            void signInWithGoogle();
          }}
          onKakaoLogin={() => {
            void signInWithKakao();
          }}
        />
      </main>
    );
  }

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <h1 className="text-3xl font-black text-white">마이</h1>

        <section className={cn(panelClassName, "mt-6 space-y-4")}>
          <div className={statusClassName}>
            <p className="font-semibold text-white">로그인됨</p>
            <p className="mt-1 break-all text-zinc-400">
              {userLabel}
              {user?.email ? " · " + user.email : ""}
            </p>
          </div>

          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              void signOut();
            }}
          >
            로그아웃
          </button>

          {authError ? <p className={errorClassName}>{authError}</p> : null}
        </section>
      </div>
    </main>
  );
}
