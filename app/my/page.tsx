"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthLoginPanel } from "@/components/AuthLoginPanel";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  fetchAccountActivity,
  getCommunityPostHref,
  getEmptyAccountActivity,
  type AccountActivity,
} from "@/lib/accountActivity";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import { supabase } from "@/lib/supabase";
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
const summaryGridClassName = cn("mt-6 grid grid-cols-3 gap-3");
const summaryCardClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4"
);
const activitySectionClassName = cn(
  "mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5"
);
const activityLinkClassName = cn(
  "block rounded-lg border border-zinc-800 bg-black px-4 py-3 transition",
  "hover:border-zinc-600 hover:bg-zinc-900"
);

export default function MyPage() {
  const {
    authError,
    isAuthenticated,
    isAuthReady,
    isSupabaseConfigured,
    session,
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
  const [accountActivity, setAccountActivity] = useState<AccountActivity>(
    getEmptyAccountActivity
  );
  const [activityError, setActivityError] = useState("");
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  const freePosts = useMemo(
    () =>
      accountActivity.communityPosts.filter((post) => post.category === "free"),
    [accountActivity.communityPosts]
  );
  const maintenancePosts = useMemo(
    () =>
      accountActivity.communityPosts.filter(
        (post) => post.category === "maintenance"
      ),
    [accountActivity.communityPosts]
  );
  const receivedLikeCount =
    accountActivity.communityLikeCount + accountActivity.reviewHelpfulCount;

  useEffect(() => {
    if (!isAuthReady || !supabase) {
      return;
    }

    void Promise.all([supabase.auth.getSession(), supabase.auth.getUser()])
      .then(([sessionResult, userResult]) => {
        console.log("my-auth-session-check", {
          getSessionError: sessionResult.error?.message ?? null,
          getSessionUserId: sessionResult.data.session?.user.id ?? null,
          getUserError: userResult.error?.message ?? null,
          getUserId: userResult.data.user?.id ?? null,
          hookSessionUserId: session?.user.id ?? null,
          hookUserId: user?.id ?? null,
          isAuthenticated,
        });
      })
      .catch((error) => {
        console.log("my-auth-session-check", {
          error:
            error instanceof Error ? error.message : "session check failed",
          getSessionUserId: null,
          getUserId: null,
          hookSessionUserId: session?.user.id ?? null,
          hookUserId: user?.id ?? null,
          isAuthenticated,
        });
      });
  }, [isAuthReady, isAuthenticated, session?.user.id, user?.id]);

  useEffect(() => {
    let isActive = true;

    if (!user?.id) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setAccountActivity(getEmptyAccountActivity());
        }
      });
      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!isActive) {
        return;
      }

      setIsActivityLoading(true);
      setActivityError("");

      fetchAccountActivity(user.id)
        .then((activity) => {
          if (!isActive) {
            return;
          }

          setAccountActivity(activity);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          setAccountActivity(getEmptyAccountActivity());
          setActivityError(
            error instanceof Error
              ? error.message
              : "내 활동 정보를 불러오지 못했습니다."
          );
        })
        .finally(() => {
          if (isActive) {
            setIsActivityLoading(false);
          }
        });
    });

    return () => {
      isActive = false;
    };
  }, [user?.id]);

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
        <h1 className="text-3xl font-black text-white">내 계정</h1>

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

        <section className={summaryGridClassName} aria-label="내 활동 요약">
          <div className={summaryCardClassName}>
            <p className="text-xs font-bold text-zinc-500">차량 후기</p>
            <p className="mt-2 text-2xl font-black text-white">
              {accountActivity.reviewCount}
            </p>
          </div>
          <div className={summaryCardClassName}>
            <p className="text-xs font-bold text-zinc-500">커뮤니티 글</p>
            <p className="mt-2 text-2xl font-black text-white">
              {accountActivity.communityPosts.length}
            </p>
          </div>
          <div className={summaryCardClassName}>
            <p className="text-xs font-bold text-zinc-500">받은 반응</p>
            <p className="mt-2 text-2xl font-black text-white">
              {receivedLikeCount}
            </p>
          </div>
        </section>

        <section className={activitySectionClassName}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">내 활동</h2>
            {isActivityLoading ? (
              <span className="text-xs font-semibold text-zinc-500">
                불러오는 중
              </span>
            ) : null}
          </div>
          {activityError ? <p className={errorClassName}>{activityError}</p> : null}
          <ActivityList
            title="내가 쓴 차량 후기"
            emptyText="작성한 차량 후기가 없습니다."
            items={accountActivity.reviews.map((review) => ({
              href: review.vehicleSnapshot?.plateNumber
                ? "/car/" + encodeURIComponent(review.vehicleSnapshot.plateNumber)
                : "/",
              meta: review.createdAt,
              title: review.vehicleSnapshot
                ? [
                    review.vehicleSnapshot.brand,
                    review.vehicleSnapshot.model,
                    review.vehicleSnapshot.plateNumber,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : review.content,
            }))}
          />
          <ActivityList
            title="내가 쓴 자유게시판 글"
            emptyText="작성한 자유게시판 글이 없습니다."
            items={freePosts.map((post) => ({
              href: getCommunityPostHref(post),
              meta:
                getCommunityCategoryLabel(post.category) +
                " · 댓글 " +
                post.commentCount +
                " · 좋아요 " +
                post.likeCount,
              title: post.title,
            }))}
          />
          <ActivityList
            title="내가 쓴 정비후기 글"
            emptyText="작성한 정비후기 글이 없습니다."
            items={maintenancePosts.map((post) => ({
              href: getCommunityPostHref(post),
              meta:
                getCommunityCategoryLabel(post.category) +
                " · 댓글 " +
                post.commentCount +
                " · 좋아요 " +
                post.likeCount,
              title: post.title,
            }))}
          />
          <ActivityList
            title="내가 받은 좋아요/도움돼요"
            emptyText="아직 받은 좋아요/도움돼요가 없습니다."
            items={accountActivity.receivedActivity.map((activity) => ({
              href: activity.href,
              meta: activity.label + " · " + activity.count + "개",
              title: activity.title,
            }))}
          />
        </section>
      </div>
    </main>
  );
}

function ActivityList({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: { href: string; meta: string; title: string }[];
  title: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-black text-white">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-500">
            {emptyText}
          </p>
        ) : (
          items.map((item) => (
            <Link key={item.href + item.title} href={item.href} className={activityLinkClassName}>
              <p className="font-bold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.meta}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
