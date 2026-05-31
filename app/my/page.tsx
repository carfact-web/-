"use client";

import { FormEvent, useState } from "react";
import { AuthLoginPanel } from "@/components/AuthLoginPanel";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
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
const primaryButtonClassName = cn(
  "inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700 sm:w-auto"
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-700 bg-black/40 px-4 py-3 text-sm text-white outline-none transition",
  "placeholder:text-zinc-600 focus:border-red-500/70"
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
  const {
    canChangeNickname,
    isProfileReady,
    nickname,
    nicknameChanged,
    profileError,
    reviewNickname,
    updateNickname,
  } = useUserProfile(user);
  const [nicknameMessage, setNicknameMessage] = useState("");

  const submitNickname = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNicknameMessage("");

    const formData = new FormData(event.currentTarget);
    const isUpdated = await updateNickname(String(formData.get("nickname") ?? ""));

    if (isUpdated) {
      setNicknameMessage("닉네임이 저장되었습니다.");
    }
  };

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
              {reviewNickname || userLabel}
              {user?.email ? " · " + user.email : ""}
            </p>
          </div>

          <div className={statusClassName}>
            <p className="font-semibold text-white">후기 작성자명</p>
            {isProfileReady ? (
              canChangeNickname ? (
                <form
                  key={nickname}
                  className="mt-3 space-y-3"
                  onSubmit={submitNickname}
                >
                  <input
                    className={inputClassName}
                    name="nickname"
                    defaultValue={nickname}
                    placeholder="닉네임을 입력하세요"
                    maxLength={20}
                  />
                  <button type="submit" className={primaryButtonClassName}>
                    닉네임 저장
                  </button>
                </form>
              ) : (
                <p className="mt-1 break-all text-zinc-400">
                  {reviewNickname} · 닉네임 변경 완료
                </p>
              )
            ) : (
              <p className="mt-1 text-zinc-400">프로필 확인 중...</p>
            )}
            {nicknameMessage ? (
              <p className="mt-3 text-sm text-red-200">{nicknameMessage}</p>
            ) : null}
            {profileError ? (
              <p className="mt-3 text-sm text-red-200">{profileError}</p>
            ) : null}
            {!nicknameChanged && isProfileReady ? (
              <p className="mt-3 text-xs text-zinc-500">
                닉네임은 최초 1회만 변경할 수 있습니다.
              </p>
            ) : null}
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
