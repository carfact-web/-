"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CommunityPostBody, renderCommunityTextColorSegments } from "@/components/CommunityPostBody";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import {
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityPostById,
  fetchCommunityPosts,
  reportCommunityPost,
  saveCommunityComment,
  toggleCommunityLike,
} from "@/lib/communityData";
import type { CommunityComment, CommunityPost } from "@/types/community";
import { sanitizeMultilineUserText } from "@/utils/inputSanitizer";
import { cn } from "@/utils/cn";

const pageClassName = cn(
  "min-h-screen bg-black px-4 py-5 pb-28 text-white sm:px-6 sm:py-8",
);
const shellClassName = cn("mx-auto flex w-full max-w-3xl flex-col gap-4");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/20 sm:p-5",
);
const buttonClassName = cn(
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
);
const primaryButtonClassName = cn(buttonClassName, "bg-red-500 text-white hover:bg-red-400");
const secondaryButtonClassName = cn(
  buttonClassName,
  "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500",
);
const dangerButtonClassName = cn(
  buttonClassName,
  "border border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20",
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition",
  "placeholder:text-zinc-600 focus:border-red-400",
);
const mutedTextClassName = cn("text-sm leading-relaxed text-zinc-400");

export default function CommunityPostDetailPage() {
  const router = useRouter();
  const params = useParams<{ postId: string }>();
  const postId = decodeURIComponent(params.postId);
  const { isAdmin, isAuthenticated, user } = useAuth();
  const { ensureReviewNickname, reviewNickname } = useUserProfile(user);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [neighborPosts, setNeighborPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const canManagePost = Boolean(user && post && (post.userId === user.id || isAdmin));
  const postIndex = useMemo(
    () => neighborPosts.findIndex((item) => item.id === post?.id),
    [neighborPosts, post?.id],
  );
  const previousPost = postIndex > 0 ? neighborPosts[postIndex - 1] : null;
  const nextPost =
    postIndex >= 0 && postIndex < neighborPosts.length - 1
      ? neighborPosts[postIndex + 1]
      : null;

  const loadPost = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const nextPost = await fetchCommunityPostById(postId);

      if (!nextPost) {
        setPost(null);
        setComments([]);
        setNeighborPosts([]);
        setMessage("게시글을 찾을 수 없습니다.");
        return;
      }

      const [nextComments, nextNeighborPosts] = await Promise.all([
        fetchCommunityComments(nextPost.id),
        fetchCommunityPosts(nextPost.isNotice ? "notice" : nextPost.category),
      ]);

      setPost(nextPost);
      setComments(nextComments);
      setNeighborPosts(nextNeighborPosts);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadPost();
    });
  }, [loadPost]);

  const goToLogin = () => {
    router.push("/login?redirectTo=" + encodeURIComponent(window.location.href));
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!post) {
      return;
    }

    if (!isAuthenticated || !user) {
      goToLogin();
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const content = sanitizeMultilineUserText(
      String(formData.get("comment") ?? ""),
    ).slice(0, 500);

    if (content.length < 2) {
      setMessage("댓글은 2자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const nickname =
        reviewNickname || (await ensureReviewNickname()) || "카팩트 사용자";
      const savedComment = await saveCommunityComment({
        authorNickname: nickname,
        content,
        postId: post.id,
        userId: user.id,
      });

      if (!savedComment) {
        setMessage("댓글을 저장하지 못했습니다.");
        return;
      }

      setComments((current) => [...current, savedComment]);
      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      );
      form.reset();
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!post) {
      return;
    }

    if (!isAuthenticated || !user) {
      goToLogin();
      return;
    }

    const didLike = await toggleCommunityLike(post.id, user.id);

    if (didLike) {
      setPost((current) =>
        current
          ? { ...current, likedByMe: true, likeCount: current.likeCount + 1 }
          : current,
      );
    }
  };

  const handleReport = async () => {
    if (!post) {
      return;
    }

    if (!isAuthenticated || !user) {
      goToLogin();
      return;
    }

    const didReport = await reportCommunityPost({
      postId: post.id,
      reason: "community-report",
      userId: user.id,
    });

    if (didReport) {
      setPost((current) =>
        current
          ? { ...current, reportedByMe: true, reportCount: current.reportCount + 1 }
          : current,
      );
      setMessage("신고가 접수되었습니다.");
    }
  };

  const handleDelete = async () => {
    if (!post || !canManagePost || !window.confirm("게시글을 삭제할까요?")) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteCommunityPost(post.id);
      router.push("/community?category=" + post.category);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <button
          type="button"
          className="w-fit text-sm font-bold text-zinc-300 transition hover:text-white"
          onClick={() => router.back()}
        >
          ← 뒤로가기
        </button>

        {message ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        ) : null}

        {isLoading ? (
          <section className={panelClassName}>
            <p className={mutedTextClassName}>게시글을 불러오는 중입니다.</p>
          </section>
        ) : post ? (
          <>
            <article className={panelClassName}>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
                <span>{getCommunityCategoryLabel(post.category)}</span>
                {post.isNotice ? <span>공지</span> : null}
                {post.isPinned ? <span>상단고정</span> : null}
              </div>
              <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                {renderCommunityTextColorSegments(post.title)}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500">
                <VerifiedNickname isVerifiedDealer={post.authorIsVerifiedDealer}>
                  {post.authorNickname}
                </VerifiedNickname>
                <span>{post.createdAt}</span>
                <span>조회수 {post.viewCount ?? 0}</span>
                <span>댓글 {post.commentCount}</span>
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-6">
                <CommunityPostBody content={post.content} images={post.images} />
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={handleLike}
                  disabled={post.likedByMe}
                >
                  {post.likedByMe ? "좋아요됨 " : "좋아요 "}
                  {post.likeCount}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={handleReport}
                  disabled={post.reportedByMe}
                >
                  신고 {post.reportCount}
                </button>
                {canManagePost ? (
                  <>
                    <Link
                      className={secondaryButtonClassName}
                      href={"/community?edit=" + encodeURIComponent(post.id)}
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      삭제
                    </button>
                  </>
                ) : null}
              </div>
            </article>

            <section className={panelClassName}>
              <h2 className="text-lg font-black">댓글 {post.commentCount}</h2>
              <form className="mt-3 flex flex-col gap-3" onSubmit={submitComment}>
                <textarea
                  className={cn(inputClassName, "min-h-24 resize-y")}
                  name="comment"
                  placeholder={
                    isAuthenticated
                      ? "댓글을 입력하세요"
                      : "로그인 후 댓글을 작성할 수 있습니다"
                  }
                  maxLength={500}
                  required
                />
                <button
                  type="submit"
                  className={primaryButtonClassName}
                  disabled={isSubmitting}
                >
                  댓글 등록
                </button>
              </form>

              <div className="mt-5 flex flex-col gap-3">
                {comments.length === 0 ? (
                  <p className={mutedTextClassName}>아직 댓글이 없습니다.</p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-zinc-800 bg-black p-3"
                    >
                      <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                        <VerifiedNickname
                          isVerifiedDealer={comment.authorIsVerifiedDealer}
                        >
                          {comment.authorNickname}
                        </VerifiedNickname>
                        <span>{comment.createdAt}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-[1.7] text-zinc-200">
                        {comment.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <nav className="grid grid-cols-2 gap-3" aria-label="게시글 이동">
              {previousPost ? (
                <Link
                  className={secondaryButtonClassName}
                  href={"/community/post/" + encodeURIComponent(previousPost.id)}
                >
                  이전글
                </Link>
              ) : (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled
                >
                  이전글
                </button>
              )}
              {nextPost ? (
                <Link
                  className={secondaryButtonClassName}
                  href={"/community/post/" + encodeURIComponent(nextPost.id)}
                >
                  다음글
                </Link>
              ) : (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled
                >
                  다음글
                </button>
              )}
            </nav>
          </>
        ) : (
          <section className={panelClassName}>
            <p className={mutedTextClassName}>게시글을 찾을 수 없습니다.</p>
          </section>
        )}
      </div>
    </main>
  );
}
