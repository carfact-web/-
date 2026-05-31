"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  communityCategories,
  getCommunityCategoryLabel,
  isCommunityCategory,
} from "@/lib/communityCategories";
import {
  fetchCommunityComments,
  fetchCommunityPosts,
  reportCommunityPost,
  saveCommunityComment,
  saveCommunityPost,
  toggleCommunityLike,
} from "@/lib/communityData";
import type {
  CommunityCategory,
  CommunityComment,
  CommunityImageAttachment,
  CommunityPost,
} from "@/types/community";
import { sanitizeUserText } from "@/utils/inputSanitizer";
import { cn } from "@/utils/cn";

const pageClassName = cn(
  "min-h-screen overflow-x-hidden bg-black px-4 py-6 pb-28 text-white sm:px-6 sm:py-8"
);
const shellClassName = cn("mx-auto flex w-full max-w-4xl flex-col gap-5");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/20 sm:p-5"
);
const mutedTextClassName = cn("text-sm leading-relaxed text-zinc-400");
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition",
  "placeholder:text-zinc-600 focus:border-red-400"
);
const buttonClassName = cn(
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition",
  "disabled:cursor-not-allowed disabled:opacity-60"
);
const primaryButtonClassName = cn(
  buttonClassName,
  "bg-red-500 text-white hover:bg-red-400"
);
const secondaryButtonClassName = cn(
  buttonClassName,
  "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
);

const normalizeField = (value: string, maxLength: number) =>
  sanitizeUserText(value).replace(/\s+/g, " ").trim().slice(0, maxLength);

const allowedCommunityImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const maxCommunityImages = 3;
const maxCommunityImageBytes = 5 * 1024 * 1024;

const isAllowedCommunityImageType = (
  type: string
): type is CommunityImageAttachment["type"] =>
  allowedCommunityImageTypes.includes(
    type as CommunityImageAttachment["type"]
  );

const readCommunityImageFile = async (
  file: File
): Promise<CommunityImageAttachment> => {
  if (!isAllowedCommunityImageType(file.type)) {
    throw new Error("jpg, png, webp 이미지만 첨부할 수 있습니다.");
  }

  if (file.size > maxCommunityImageBytes) {
    throw new Error("이미지는 1장당 5MB 이하만 첨부할 수 있습니다.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지를 불러오지 못했습니다."));
        return;
      }

      resolve({
        id: [file.name, file.size, Date.now()].join("-"),
        name: file.name,
        size: file.size,
        type: file.type as CommunityImageAttachment["type"],
        url: reader.result,
      });
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const { ensureReviewNickname, reviewNickname } = useUserProfile(user);

  const [activeCategory, setActiveCategory] =
    useState<CommunityCategory>("free");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [postImages, setPostImages] = useState<CommunityImageAttachment[]>([]);
  const [targetPostId, setTargetPostId] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const activeCategoryLabel = useMemo(
    () => getCommunityCategoryLabel(activeCategory),
    [activeCategory]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const postId = params.get("post");

    void Promise.resolve().then(() => {
      if (category && isCommunityCategory(category)) {
        setActiveCategory(category);
      }

      if (postId) {
        setTargetPostId(postId);
      }
    });
  }, []);

  const goToLogin = () => {
    const redirectTo =
      typeof window === "undefined" ? "/community" : window.location.href;

    router.push("/login?redirectTo=" + encodeURIComponent(redirectTo));
  };

  const getAuthorNickname = async () => {
    const nickname = reviewNickname || (await ensureReviewNickname());

    return nickname.trim() || "카팩트 사용자";
  };

  const loadPosts = useCallback(async (category: CommunityCategory) => {
    setIsLoadingPosts(true);
    setMessage("");

    try {
      const nextPosts = await fetchCommunityPosts(category);
      setPosts(nextPosts);
      setSelectedPost((current) => {
        if (!current || current.category !== category) {
          return null;
        }

        return nextPosts.find((post) => post.id === current.id) ?? current;
      });
    } catch (error) {
      setPosts([]);
      setSelectedPost(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "커뮤니티 글을 불러오지 못했습니다."
      );
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  const loadComments = useCallback(async (postId: string) => {
    setIsLoadingComments(true);

    try {
      const nextComments = await fetchCommunityComments(postId);
      setComments(nextComments);
    } catch (error) {
      setComments([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "댓글을 불러오지 못했습니다."
      );
    } finally {
      setIsLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadPosts(activeCategory);
    });
  }, [activeCategory, loadPosts]);

  const selectedPostId = selectedPost?.id;

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (!selectedPostId) {
        setComments([]);
        return;
      }

      void loadComments(selectedPostId);
    });
  }, [loadComments, selectedPostId]);

  useEffect(() => {
    if (!targetPostId) {
      return;
    }

    const targetPost = posts.find((post) => post.id === targetPostId);

    if (targetPost) {
      void Promise.resolve().then(() => {
        setSelectedPost(targetPost);
        setTargetPostId("");
      });
    }
  }, [posts, targetPostId]);

  const startWriting = () => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    setSelectedPost(null);
    setIsWriting(true);
    setMessage("");
  };

  const addPostImages = async (files: FileList | null) => {
    if (!files) {
      return;
    }

    const remainingSlots = maxCommunityImages - postImages.length;

    if (remainingSlots <= 0) {
      setMessage("이미지는 최대 3장까지 첨부할 수 있습니다.");
      return;
    }

    const nextFiles = Array.from(files).slice(0, remainingSlots);

    try {
      const nextImages = await Promise.all(
        nextFiles.map((file) => readCommunityImageFile(file))
      );

      setPostImages((current) =>
        [...current, ...nextImages].slice(0, maxCommunityImages)
      );
      setMessage(
        files.length > remainingSlots
          ? "이미지는 최대 3장까지 첨부할 수 있습니다."
          : ""
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "이미지를 불러오지 못했습니다."
      );
    }
  };

  const removePostImage = (imageId: string) => {
    setPostImages((current) =>
      current.filter((image) => image.id !== imageId)
    );
    setMessage("");
  };

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      goToLogin();
      return;
    }

    const formData = new FormData(event.currentTarget);
    const title = normalizeField(String(formData.get("title") ?? ""), 80);
    const content = normalizeField(String(formData.get("content") ?? ""), 2000);

    if (title.length < 2 || content.length < 5) {
      setMessage("제목은 2자 이상, 내용은 5자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const nickname = await getAuthorNickname();
      const createdPost = await saveCommunityPost({
        authorId: user.id,
        authorNickname: nickname,
        category: activeCategory,
        content,
        images: postImages,
        title,
      });

      if (!createdPost) {
        setMessage("커뮤니티 글을 저장하지 못했습니다.");
        return;
      }

      setPosts((current) => [createdPost, ...current]);
      setSelectedPost(createdPost);
      setIsWriting(false);
      setPostImages([]);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "커뮤니티 글 저장에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPost) {
      return;
    }

    if (!user) {
      goToLogin();
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const content = normalizeField(String(formData.get("comment") ?? ""), 500);

    if (content.length < 2) {
      setMessage("댓글은 2자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const nickname = await getAuthorNickname();
      const createdComment = await saveCommunityComment({
        authorId: user.id,
        authorNickname: nickname,
        content,
        postId: selectedPost.id,
      });

      if (!createdComment) {
        setMessage("댓글을 저장하지 못했습니다.");
        return;
      }

      setComments((current) => [...current, createdComment]);
      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id
            ? { ...post, commentCount: post.commentCount + 1 }
            : post
        )
      );
      setSelectedPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current
      );
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!selectedPost) {
      return;
    }

    if (!user) {
      goToLogin();
      return;
    }

    try {
      const didLike = await toggleCommunityLike(selectedPost.id, user.id);
      const likeDelta = didLike ? 1 : -1;

      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id
            ? { ...post, likeCount: Math.max(0, post.likeCount + likeDelta) }
            : post
        )
      );
      setSelectedPost((current) =>
        current
          ? { ...current, likeCount: Math.max(0, current.likeCount + likeDelta) }
          : current
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "좋아요 처리에 실패했습니다.");
    }
  };

  const handleReport = async () => {
    if (!selectedPost) {
      return;
    }

    if (!user) {
      goToLogin();
      return;
    }

    try {
      await reportCommunityPost({
        postId: selectedPost.id,
        userId: user.id,
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id
            ? { ...post, reportCount: post.reportCount + 1 }
            : post
        )
      );
      setSelectedPost((current) =>
        current ? { ...current, reportCount: current.reportCount + 1 } : current
      );
      setMessage("신고가 접수되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "신고 처리에 실패했습니다.");
    }
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-red-300">CARFACT COMMUNITY</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              커뮤니티
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-400">
              자유게시판과 정비후기에서 차량 이야기를 공유하세요.
            </p>
          </div>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={startWriting}
            disabled={!isAuthReady}
          >
            글쓰기
          </button>
        </header>

        <section
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          aria-label="게시판 선택"
        >
          {communityCategories.map((category) => {
            const isActive = category.value === activeCategory;

            return (
              <button
                key={category.value}
                type="button"
                className={cn(
                  "min-h-24 min-w-0 rounded-lg border p-4 text-left transition",
                  isActive
                    ? "border-red-400 bg-red-500/15 text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
                )}
                onClick={() => {
                  setActiveCategory(category.value);
                  setIsWriting(false);
                  setMessage("");
                }}
              >
                <span className="block text-base font-extrabold sm:text-lg">
                  {category.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-400 sm:text-sm">
                  {category.description}
                </span>
              </button>
            );
          })}
        </section>

        {message ? (
          <div
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200"
            role="status"
          >
            {message}
          </div>
        ) : null}

        {isWriting ? (
          <section className={panelClassName} aria-label="커뮤니티 글쓰기">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">
                  {activeCategoryLabel} 글쓰기
                </h2>
                <p className={mutedTextClassName}>
                  작성자명은 내 계정 닉네임으로 표시됩니다.
                </p>
              </div>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => setIsWriting(false)}
              >
                취소
              </button>
            </div>
            <form className="flex flex-col gap-3" onSubmit={submitPost}>
              <input
                className={inputClassName}
                name="title"
                placeholder="제목"
                maxLength={80}
                required
              />
              <textarea
                className={cn(inputClassName, "min-h-40 resize-y")}
                name="content"
                placeholder="내용"
                maxLength={2000}
                required
              />
              <div className="rounded-lg border border-dashed border-zinc-700 bg-black/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">이미지 첨부</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      jpg, png, webp · 최대 3장 · 이미지당 5MB 이하
                    </p>
                  </div>
                  <label className={cn(secondaryButtonClassName, "cursor-pointer")}>
                    이미지 선택
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => {
                        void addPostImages(event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {postImages.length > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {postImages.map((image) => (
                      <div
                        key={image.id}
                        className="relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                      >
                        {image.url ? (
                          <Image
                            src={image.url}
                            alt={image.name}
                            fill
                            unoptimized
                            sizes="120px"
                            className="object-cover"
                          />
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white"
                          onClick={() => removePostImage(image.id)}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                className={primaryButtonClassName}
                disabled={isSubmitting}
              >
                등록
              </button>
            </form>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className={panelClassName}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold">{activeCategoryLabel}</h2>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => void loadPosts(activeCategory)}
              >
                새로고침
              </button>
            </div>

            {isLoadingPosts ? (
              <p className={mutedTextClassName}>글 목록을 불러오는 중입니다.</p>
            ) : posts.length === 0 ? (
              <p className={mutedTextClassName}>
                아직 등록된 글이 없습니다. 첫 글을 작성해보세요.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {posts.map((post) => {
                  const isSelected = selectedPost?.id === post.id;

                  return (
                    <button
                      key={post.id}
                      type="button"
                      className={cn(
                        "rounded-lg border p-4 text-left transition",
                        isSelected
                          ? "border-red-400 bg-red-500/10"
                          : "border-zinc-800 bg-black hover:border-zinc-600"
                      )}
                      onClick={() => {
                        setSelectedPost(post);
                        setIsWriting(false);
                      }}
                    >
                      <span className="block text-base font-extrabold text-white">
                        {post.title}
                      </span>
                      <span className="mt-2 block max-h-12 overflow-hidden text-sm leading-6 text-zinc-400">
                        {post.content}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500">
                        <span>{post.authorNickname}</span>
                        <span>{post.createdAt}</span>
                        <span>좋아요 {post.likeCount}</span>
                        <span>댓글 {post.commentCount}</span>
                        {post.images.length > 0 ? (
                          <span>이미지 {post.images.length}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <article className={panelClassName}>
            {selectedPost ? (
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
                    <span>{activeCategoryLabel}</span>
                    <span>{selectedPost.authorNickname}</span>
                    <span>{selectedPost.createdAt}</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                    {selectedPost.title}
                  </h2>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-zinc-200">
                    {selectedPost.content}
                  </p>
                  {selectedPost.images.length > 0 ? (
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {selectedPost.images.map((image) => (
                        <a
                          key={image.id}
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className="relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                        >
                          {image.url ? (
                            <Image
                              src={image.url}
                              alt={image.name}
                              fill
                              unoptimized
                              sizes="160px"
                              className="object-cover"
                            />
                          ) : null}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={handleLike}
                    >
                      좋아요 {selectedPost.likeCount}
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={handleReport}
                    >
                      신고 {selectedPost.reportCount}
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-5">
                  <h3 className="text-lg font-extrabold">
                    댓글 {selectedPost.commentCount}
                  </h3>
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
                    {isLoadingComments ? (
                      <p className={mutedTextClassName}>
                        댓글을 불러오는 중입니다.
                      </p>
                    ) : comments.length === 0 ? (
                      <p className={mutedTextClassName}>
                        아직 댓글이 없습니다.
                      </p>
                    ) : (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-lg border border-zinc-800 bg-black p-3"
                        >
                          <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                            <span>{comment.authorNickname}</span>
                            <span>{comment.createdAt}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                            {comment.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center text-center">
                <div>
                  <h2 className="text-xl font-extrabold">글 상세</h2>
                  <p className={cn(mutedTextClassName, "mx-auto mt-2 max-w-xs")}>
                    목록에서 글을 선택하면 상세 내용과 댓글을 확인할 수 있습니다.
                  </p>
                </div>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
