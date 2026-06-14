"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLoginPanel } from "@/components/AuthLoginPanel";
import { renderCommunityTextColorSegments } from "@/components/CommunityPostBody";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import { clearAuthRedirect, resolveAuthRedirect } from "@/lib/authRedirect";
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
import { stripCommunityTextColorMarkup } from "@/utils/communityTextColor";

const pageClassName = cn(
  "min-h-screen bg-black px-4 py-8 pb-28 text-white sm:px-6",
);
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-sm leading-6 text-zinc-400",
);
const secondaryButtonClassName = cn(
  "inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto",
);
const primaryButtonClassName = cn(
  "inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700 sm:w-auto",
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-700 bg-black/40 px-4 py-3 text-sm text-white outline-none transition",
  "placeholder:text-zinc-600 focus:border-red-500/70",
);
const statusClassName = cn(
  "rounded-lg border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-300",
);
const errorClassName = cn(
  "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
);
const summaryGridClassName = cn("mt-6 grid grid-cols-3 gap-3");
const summaryCardClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4",
);
const activitySectionClassName = cn(
  "mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5",
);
const activityLinkClassName = cn(
  "block rounded-lg border border-zinc-800 bg-black px-4 py-3 transition",
  "hover:border-zinc-600 hover:bg-zinc-900",
);
const paginationButtonClassName = cn(
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-transparent disabled:hover:text-zinc-300",
);
const activePaginationButtonClassName = cn(
  "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500",
);
const activityPageSize = 5;

export default function MyPage() {
  const router = useRouter();
  const {
    authError,
    isAuthenticated,
    isAdmin,
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
    isVerifiedDealer,
    isProfileReady,
    nickname,
    nicknameChangeAvailable,
    profileError,
    reviewNickname,
    updateNickname,
  } = useUserProfile(user);
  const [nicknameMessage, setNicknameMessage] = useState("");
  const [accountActivity, setAccountActivity] = useState<AccountActivity>(
    getEmptyAccountActivity,
  );
  const [activityError, setActivityError] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  const freePosts = useMemo(
    () =>
      accountActivity.communityPosts.filter((post) => post.category === "free"),
    [accountActivity.communityPosts],
  );
  const maintenancePosts = useMemo(
    () =>
      accountActivity.communityPosts.filter(
        (post) => post.category === "maintenance",
      ),
    [accountActivity.communityPosts],
  );
  const receivedLikeCount =
    accountActivity.communityLikeCount + accountActivity.reviewHelpfulCount;

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) {
      return;
    }

    const redirect = resolveAuthRedirect({ fallbackPath: "/my" });

    if (!redirect.redirectTo) {
      return;
    }

    clearAuthRedirect();

    if (redirect.resolvedRedirect !== "/my") {
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
        reason: "my-page-pending-redirect",
      });
      console.log("auth-callback-final-router", {
        hasSession: true,
        target: redirect.resolvedRedirect,
        source: "my-page-pending-redirect",
      });
      router.replace(redirect.resolvedRedirect);
    }
  }, [isAuthReady, isAuthenticated, router]);

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
              : "내 활동 정보를 불러오지 못했습니다.",
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
    const isUpdated = await updateNickname(
      String(formData.get("nickname") ?? ""),
    );

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
              <VerifiedNickname isVerifiedDealer={isVerifiedDealer}>
                {reviewNickname || userLabel}
              </VerifiedNickname>
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
                  <VerifiedNickname isVerifiedDealer={isVerifiedDealer}>
                    {reviewNickname}
                  </VerifiedNickname>
                  {" · 닉네임 변경 완료"}
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
            {isProfileReady ? (
              <p className="mt-3 text-xs text-zinc-500">
                닉네임은 최초 1회만 변경할 수 있습니다.
                {nicknameChangeAvailable > 0
                  ? " 현재 변경권 " +
                    nicknameChangeAvailable +
                    "회 보유 중입니다."
                  : ""}
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

          {isAdmin ? (
            <Link href="/admin" className={primaryButtonClassName}>
              관리자 페이지로 이동
            </Link>
          ) : null}

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
          {activityError ? (
            <p className={errorClassName}>{activityError}</p>
          ) : null}
          <input
            type="search"
            className={inputClassName}
            placeholder="내 활동 검색"
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
          />
          <ActivityList
            key={"reviews-" + activitySearch}
            searchQuery={activitySearch}
            title="내가 쓴 차량 후기"
            emptyText="작성한 차량 후기가 없습니다."
            items={accountActivity.reviews.map((review) => ({
              href: review.vehicleSnapshot?.plateNumber
                ? "/car/" +
                  encodeURIComponent(review.vehicleSnapshot.plateNumber)
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
              searchText: [
                review.vehicleSnapshot?.brand,
                review.vehicleSnapshot?.model,
                review.vehicleSnapshot?.plateNumber,
                review.content,
              ]
                .filter(Boolean)
                .join(" "),
            }))}
          />
          <ActivityList
            key={"free-" + activitySearch}
            searchQuery={activitySearch}
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
              searchText: [post.title, post.content]
                .filter(Boolean)
                .map(stripCommunityTextColorMarkup)
                .join(" "),
              title: post.title,
            }))}
          />
          <ActivityList
            key={"maintenance-" + activitySearch}
            searchQuery={activitySearch}
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
              searchText: [post.title, post.content]
                .filter(Boolean)
                .map(stripCommunityTextColorMarkup)
                .join(" "),
              title: post.title,
            }))}
          />
          <ActivityList
            key={"received-" + activitySearch}
            searchQuery={activitySearch}
            title="내가 받은 좋아요/도움돼요"
            emptyText="아직 받은 좋아요/도움돼요가 없습니다."
            items={accountActivity.receivedActivity.map((activity) => ({
              href: activity.href,
              meta: activity.label + " · " + activity.count + "개",
              searchText: activity.searchText,
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
  searchQuery,
  title,
}: {
  emptyText: string;
  items: { href: string; meta: string; searchText?: string; title: string }[];
  searchQuery: string;
  title: string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const normalizedSearchQuery = normalizeActivitySearch(searchQuery);
  const filteredItems = normalizedSearchQuery
    ? items.filter((item) =>
        normalizeActivitySearch(
          [item.title, item.meta, item.searchText].filter(Boolean).join(" "),
        ).includes(normalizedSearchQuery),
      )
    : items;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / activityPageSize),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * activityPageSize;
  const visibleItems = filteredItems.slice(
    pageStartIndex,
    pageStartIndex + activityPageSize,
  );

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">{title}</h3>
        {filteredItems.length ? (
          <span className="text-xs font-bold text-zinc-500">
            {filteredItems.length.toLocaleString()}개
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {filteredItems.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-500">
            {normalizedSearchQuery ? "검색 결과가 없습니다." : emptyText}
          </p>
        ) : (
          visibleItems.map((item) => (
            <Link
              key={item.href + item.title}
              href={item.href}
              className={activityLinkClassName}
            >
              <p className="font-bold text-white">
                {renderCommunityTextColorSegments(item.title)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{item.meta}</p>
            </Link>
          ))
        )}
      </div>
      {totalPages > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className={paginationButtonClassName}
            disabled={safeCurrentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;

            return (
              <button
                key={page}
                type="button"
                aria-current={safeCurrentPage === page ? "page" : undefined}
                className={cn(
                  paginationButtonClassName,
                  safeCurrentPage === page && activePaginationButtonClassName,
                )}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            );
          })}
          <button
            type="button"
            className={paginationButtonClassName}
            disabled={safeCurrentPage === totalPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}

const normalizeActivitySearch = (value: string) =>
  stripCommunityTextColorMarkup(value).toLowerCase().replace(/\s+/g, " ").trim();
