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
  writableCommunityCategories,
} from "@/lib/communityCategories";
import { supabase } from "@/lib/supabase";
import {
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityPosts,
  reportCommunityPost,
  saveCommunityComment,
  saveCommunityPost,
  toggleCommunityLike,
  updateCommunityPost,
} from "@/lib/communityData";
import type {
  CommunityCategory,
  CommunityCategoryFilter,
  CommunityComment,
  CommunityImageAttachment,
  CommunityPost,
} from "@/types/community";
import { compressImage, isSupportedImageFile } from "@/utils/imageCompression";
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
const sortButtonClassName = cn(
  "rounded-full px-3 py-2 text-sm font-extrabold text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
);
const activeSortButtonClassName = cn("bg-red-500 text-white hover:bg-red-500");
const reportButtonClassName = cn(
  "inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-300 transition",
  "hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 active:scale-[0.98]",
  "disabled:cursor-default disabled:border-zinc-700 disabled:bg-zinc-900/70 disabled:text-gray-500 disabled:hover:text-gray-500"
);
const dangerButtonClassName = cn(
  buttonClassName,
  "border border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20"
);
const reportModalOverlayClassName = cn(
  "fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
);
const reportModalPanelClassName = cn(
  "w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/60"
);
const reportReasonButtonClassName = cn(
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-left text-sm font-semibold text-zinc-200 transition",
  "hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.99]"
);
const activeReportReasonButtonClassName = cn(
  "border-red-500 bg-red-500/15 text-red-100"
);
const reportSubmitButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition",
  "hover:bg-red-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:hover:bg-zinc-700"
);
const reportCancelButtonClassName = cn(
  "mt-2 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-300 transition",
  "hover:bg-zinc-800 active:scale-[0.99]"
);

const normalizeField = (value: string, maxLength: number) =>
  sanitizeUserText(value).replace(/\s+/g, " ").trim().slice(0, maxLength);

const allowedCommunityImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;
const maxCommunityImages = 3;
const maxCommunityOriginalImageBytes = 25 * 1024 * 1024;
const postsPerPage = 5;
type CommunitySortOption = "latest" | "popular" | "weekly";
type CommunityReportReason =
  | "욕설/비방"
  | "허위 정보 의심"
  | "광고/홍보"
  | "개인정보 노출"
  | "기타";

const sortOptions: { label: string; value: CommunitySortOption }[] = [
  { label: "최신", value: "latest" },
  { label: "인기", value: "popular" },
  { label: "주간인기", value: "weekly" },
];
const communityReportReasons: CommunityReportReason[] = [
  "욕설/비방",
  "허위 정보 의심",
  "광고/홍보",
  "개인정보 노출",
  "기타",
];

const isAllowedCommunityImageFile = (file: File) =>
  allowedCommunityImageTypes.includes(
    file.type as (typeof allowedCommunityImageTypes)[number]
  ) || isSupportedImageFile(file);

const readCommunityImageFile = async (
  file: File
): Promise<CommunityImageAttachment> => {
  if (!isAllowedCommunityImageFile(file)) {
    throw new Error("jpg, png, webp, heic 이미지만 첨부할 수 있습니다.");
  }

  if (file.size > maxCommunityOriginalImageBytes) {
    throw new Error("이미지는 1장당 25MB 이하만 첨부할 수 있습니다.");
  }

  const compressionResult = await compressImage(file);

  if (!compressionResult.success) {
    throw new Error(compressionResult.message);
  }

  const { blob } = compressionResult;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지를 불러오지 못했습니다."));
        return;
      }

      resolve({
        id: [file.name, blob.size, Date.now()].join("-"),
        name: file.name,
        size: blob.size,
        type: "image/webp",
        dataUrl: reader.result,
        url: reader.result,
      });
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export default function CommunityPage() {
  const router = useRouter();
  const { isAdmin, isAuthenticated, isAuthReady, user } = useAuth();
  const { ensureReviewNickname, reviewNickname } = useUserProfile(user);

  const [activeCategory, setActiveCategory] =
    useState<CommunityCategoryFilter>("all");
  const [writeCategory, setWriteCategory] =
    useState<CommunityCategory>("free");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [postImages, setPostImages] = useState<CommunityImageAttachment[]>([]);
  const [targetPostId, setTargetPostId] = useState("");
  const [sortOption, setSortOption] = useState<CommunitySortOption>("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isWriting, setIsWriting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeIsNotice, setWriteIsNotice] = useState(false);
  const [writeIsPinned, setWriteIsPinned] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportReason, setSelectedReportReason] =
    useState<CommunityReportReason | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [message, setMessage] = useState("");

  const activeCategoryLabel = useMemo(
    () => getCommunityCategoryLabel(activeCategory),
    [activeCategory]
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visiblePosts = useMemo(() => {
    const weekAgo = currentTime - 7 * 24 * 60 * 60 * 1000;
    const sortedPosts = posts.filter((post) => {
      if (!normalizedSearchQuery) {
        return true;
      }

      return [post.title, post.content]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });

    if (sortOption === "popular" || sortOption === "weekly") {
      const targetPosts =
        sortOption === "weekly" && currentTime > 0
          ? sortedPosts.filter((post) => {
              const createdTime = Date.parse(post.createdAtRaw);
              return !Number.isNaN(createdTime) && createdTime >= weekAgo;
            })
          : sortedPosts;

      return targetPosts.sort(
        (left, right) =>
          Number(right.isPinned) - Number(left.isPinned) ||
          right.likeCount +
            right.commentCount -
            (left.likeCount + left.commentCount) ||
          Date.parse(right.createdAtRaw) - Date.parse(left.createdAtRaw)
      );
    }

    return sortedPosts.sort(
      (left, right) =>
        Number(right.isPinned) - Number(left.isPinned) ||
        Date.parse(right.createdAtRaw) - Date.parse(left.createdAtRaw)
    );
  }, [currentTime, normalizedSearchQuery, posts, sortOption]);
  const totalPages = Math.max(1, Math.ceil(visiblePosts.length / postsPerPage));
  const currentPagePosts = useMemo(() => {
    const startIndex = (currentPage - 1) * postsPerPage;

    return visiblePosts.slice(startIndex, startIndex + postsPerPage);
  }, [currentPage, visiblePosts]);
  const canDeleteSelectedPost = Boolean(
    user && selectedPost && (selectedPost.userId === user.id || isAdmin)
  );
  const canEditSelectedPost = canDeleteSelectedPost;

  useEffect(() => {
    void Promise.resolve().then(() => {
      setCurrentTime(Date.now());
    });
  }, []);

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

  const loadPosts = useCallback(async (category: CommunityCategoryFilter) => {
    setIsLoadingPosts(true);
    setMessage("");

    try {
      const nextPosts = await fetchCommunityPosts(category);
      setPosts(nextPosts);
      setSelectedPost((current) => {
        if (!current) {
          return null;
        }

        if (category !== "all" && current.category !== category) {
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

  useEffect(() => {
    void Promise.resolve().then(() => {
      setCurrentPage(1);
    });
  }, [activeCategory, normalizedSearchQuery, sortOption]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
    });
  }, [totalPages]);

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

  useEffect(() => {
    const postsWithImages = posts
      .filter((post) => post.images.length > 0)
      .map((post) => ({
        id: post.id,
        imageCount: post.images.length,
        images: post.images.slice(0, maxCommunityImages),
      }));

    if (postsWithImages.length > 0) {
      console.log("community-post-images-render", {
        surface: "list",
        posts: postsWithImages,
      });
    }
  }, [posts]);

  useEffect(() => {
    if (!selectedPost || selectedPost.images.length === 0) {
      return;
    }

    console.log("community-post-images-render", {
      surface: "detail",
      postId: selectedPost.id,
      images: selectedPost.images.slice(0, maxCommunityImages),
    });
  }, [selectedPost]);

  const startWriting = () => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    setSelectedPost(null);
    setWriteCategory(activeCategory === "all" ? "free" : activeCategory);
    setEditingPostId(null);
    setWriteTitle("");
    setWriteContent("");
    setWriteIsNotice(false);
    setWriteIsPinned(false);
    setPostImages([]);
    setIsWriting(true);
    setMessage("");
  };

  const cancelWriting = () => {
    setIsWriting(false);
    setEditingPostId(null);
    setWriteTitle("");
    setWriteContent("");
    setWriteIsNotice(false);
    setWriteIsPinned(false);
    setPostImages([]);
    setMessage("");
  };

  const startEditingSelectedPost = () => {
    if (!selectedPost || !canEditSelectedPost) {
      return;
    }

    setEditingPostId(selectedPost.id);
    setWriteCategory(selectedPost.category);
    setWriteTitle(selectedPost.title);
    setWriteContent(selectedPost.content);
    setWriteIsNotice(selectedPost.isNotice);
    setWriteIsPinned(selectedPost.isPinned);
    setPostImages(selectedPost.images.slice(0, maxCommunityImages));
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

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(normalizeField(searchInput, 80));
    setCurrentPage(1);
    setSelectedPost(null);
    setMessage("");
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(1);
    setSelectedPost(null);
    setMessage("");
  };

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated || !user) {
      goToLogin();
      return;
    }

    const formData = new FormData(form);
    const title = normalizeField(String(formData.get("title") ?? ""), 80);
    const content = normalizeField(String(formData.get("content") ?? ""), 2000);
    const isNoticePost = isAdmin && formData.get("isNotice") === "on";
    const isPinnedPost = isAdmin && formData.get("isPinned") === "on";

    if (title.length < 2 || content.length < 5) {
      setMessage("제목은 2자 이상, 내용은 5자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      const sessionUserId = sessionData.session?.user.id ?? null;

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionUserId) {
        setIsSubmitting(false);
        goToLogin();
        return;
      }

      const authorNickname = await getAuthorNickname();
      if (editingPostId) {
        const didUpdate = await updateCommunityPost({
          category: writeCategory,
          content,
          images: postImages,
          isNotice: isNoticePost,
          isPinned: isPinnedPost,
          postId: editingPostId,
          title,
        });

        if (!didUpdate) {
          setMessage("수정 권한이 없거나 이미 삭제된 게시글입니다.");
          return;
        }

        setPosts((current) =>
          current.map((post) =>
            post.id === editingPostId
              ? {
                  ...post,
                  category: writeCategory,
                  content,
                  images: postImages,
                  isNotice: isNoticePost,
                  isPinned: isPinnedPost,
                  title,
                }
              : post
          )
        );
        setSelectedPost((current) =>
          current && current.id === editingPostId
            ? {
                ...current,
                category: writeCategory,
                content,
                images: postImages,
                isNotice: isNoticePost,
                isPinned: isPinnedPost,
                title,
              }
            : current
        );
        setIsWriting(false);
        setEditingPostId(null);
        setPostImages([]);
        setMessage("게시글을 수정했습니다.");
        form.reset();
        return;
      }

      const createdPost = await saveCommunityPost({
        authorNickname,
        category: writeCategory,
        content,
        images: postImages,
        isNotice: isNoticePost,
        isPinned: isPinnedPost,
        title,
      });

      if (!createdPost) {
        setMessage("커뮤니티 글을 저장하지 못했습니다.");
        return;
      }

      setPosts((current) => [createdPost, ...current]);
      setSelectedPost(createdPost);
      setIsWriting(false);
      setEditingPostId(null);
      setPostImages([]);
      setWriteTitle("");
      setWriteContent("");
      setWriteIsNotice(false);
      setWriteIsPinned(false);
      setSearchInput("");
      setSearchQuery("");
      setCurrentPage(1);
      setActiveCategory(createdPost.category);
      form.reset();
      if (createdPost.imageUploadWarning) {
        setMessage(createdPost.imageUploadWarning);
      }
    } catch (error) {
      console.error("community-post-save-error", error);
      setMessage(
        error instanceof Error
          ? "커뮤니티 글 저장 실패: " + error.message
          : "커뮤니티 글 저장에 실패했습니다."
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
      const { data: sessionData, error: sessionError } =
        supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      const sessionUserId = sessionData.session?.user.id ?? null;

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionUserId) {
        setIsSubmitting(false);
        goToLogin();
        return;
      }

      const nickname = await getAuthorNickname();
      const createdComment = await saveCommunityComment({
        authorNickname: nickname,
        content,
        postId: selectedPost.id,
        userId: sessionUserId,
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

    if (selectedPost.likedByMe) {
      setMessage("이미 좋아요를 눌렀습니다.");
      return;
    }

    if (!user) {
      goToLogin();
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      const sessionUserId = sessionData.session?.user.id ?? null;

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionUserId) {
        goToLogin();
        return;
      }

      const didLike = await toggleCommunityLike(selectedPost.id, sessionUserId);

      if (!didLike) {
        setPosts((current) =>
          current.map((post) =>
            post.id === selectedPost.id ? { ...post, likedByMe: true } : post
          )
        );
        setSelectedPost((current) =>
          current ? { ...current, likedByMe: true } : current
        );
        setMessage("이미 좋아요를 눌렀습니다.");
        return;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id
            ? { ...post, likedByMe: true, likeCount: post.likeCount + 1 }
            : post
        )
      );
      setSelectedPost((current) =>
        current
          ? { ...current, likedByMe: true, likeCount: current.likeCount + 1 }
          : current
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "좋아요 처리에 실패했습니다.");
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost || !canDeleteSelectedPost || isDeletingPost) {
      return;
    }

    if (!window.confirm("게시글을 삭제하시겠습니까?")) {
      return;
    }

    setIsDeletingPost(true);
    setMessage("");

    try {
      await deleteCommunityPost(selectedPost.id);
      setPosts((current) =>
        current.filter((post) => post.id !== selectedPost.id)
      );
      setSelectedPost(null);
      setComments([]);
      setMessage("게시글을 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "게시글 삭제에 실패했습니다."
      );
    } finally {
      setIsDeletingPost(false);
    }
  };

  const closeReportModal = () => {
    setIsReportModalOpen(false);
    setSelectedReportReason(null);
  };

  const handleReport = () => {
    if (!selectedPost) {
      return;
    }

    if (selectedPost.reportedByMe || reportedPostIds.has(selectedPost.id)) {
      setMessage("이미 신고한 글입니다.");
      return;
    }

    if (!user) {
      goToLogin();
      return;
    }

    setSelectedReportReason(null);
    setIsReportModalOpen(true);
  };

  const submitCommunityReport = async () => {
    if (!selectedPost || !selectedReportReason) {
      return;
    }

    if (!user) {
      goToLogin();
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      const sessionUserId = sessionData.session?.user.id ?? null;

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionUserId) {
        goToLogin();
        return;
      }

      const didReport = await reportCommunityPost({
        postId: selectedPost.id,
        reason: selectedReportReason,
        userId: sessionUserId,
      });

      if (!didReport) {
        setReportedPostIds((current) => new Set(current).add(selectedPost.id));
        setPosts((current) =>
          current.map((post) =>
            post.id === selectedPost.id ? { ...post, reportedByMe: true } : post
          )
        );
        setSelectedPost((current) =>
          current ? { ...current, reportedByMe: true } : current
        );
        closeReportModal();
        setMessage("이미 신고한 글입니다.");
        return;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id
            ? {
                ...post,
                reportedByMe: true,
                reportCount: post.reportCount + 1,
              }
            : post
        )
      );
      setSelectedPost((current) =>
        current
          ? {
              ...current,
              reportedByMe: true,
              reportCount: current.reportCount + 1,
            }
          : current
      );
      setReportedPostIds((current) => new Set(current).add(selectedPost.id));
      closeReportModal();
      setMessage("신고가 접수되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "신고 처리에 실패했습니다.");
    }
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              커뮤니티
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              차량 고민, 정비 경험, 구매 후기를 자유롭게 나눠보세요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="게시글 정렬">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    sortButtonClassName,
                    sortOption === option.value && activeSortButtonClassName
                  )}
                  onClick={() => {
                    setSortOption(option.value);
                    setCurrentPage(1);
                  }}
                  aria-pressed={sortOption === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
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

        <section className={panelClassName} aria-label="커뮤니티 검색">
          <form
            className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
            onSubmit={submitSearch}
          >
            <input
              className={inputClassName}
              value={searchInput}
              onChange={(event) => setSearchInput(event.currentTarget.value)}
              placeholder="제목 또는 내용 검색"
              maxLength={80}
            />
            <button type="submit" className={primaryButtonClassName}>
              검색
            </button>
            {searchQuery ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={clearSearch}
              >
                초기화
              </button>
            ) : null}
          </form>
          {searchQuery ? (
            <p className="mt-3 text-sm font-semibold text-zinc-400">
              “{searchQuery}” 검색 결과 {visiblePosts.length}개
            </p>
          ) : null}
        </section>

        <section className={panelClassName} aria-label="게시판 선택">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold">주제별 게시판</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {communityCategories.map((category) => {
              const isActive = category.value === activeCategory;

              return (
                <button
                  key={category.value}
                  type="button"
                  className={cn(
                    "min-h-12 min-w-0 rounded-lg border px-3 py-2 text-center text-sm font-extrabold transition sm:text-base",
                    isActive
                      ? "border-red-400 bg-red-500 text-white"
                      : "border-zinc-800 bg-black text-zinc-300 hover:border-zinc-600"
                  )}
                  onClick={() => {
                    setActiveCategory(category.value);
                    setCurrentPage(1);
                    setIsWriting(false);
                    setMessage("");
                  }}
                >
                  {category.shortLabel ?? category.label}
                </button>
              );
            })}
          </div>
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
                  {editingPostId ? "게시글 수정" : "글쓰기"}
                </h2>
                <p className={mutedTextClassName}>
                  {editingPostId
                    ? "게시글 내용을 수정합니다."
                    : "작성자명은 내 계정 닉네임으로 표시됩니다."}
                </p>
              </div>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={cancelWriting}
              >
                취소
              </button>
            </div>
            <form className="flex flex-col gap-3" onSubmit={submitPost}>
              <label className="flex flex-col gap-2 text-sm font-bold text-zinc-300">
                게시판
                <select
                  className={inputClassName}
                  value={writeCategory}
                  onChange={(event) =>
                    setWriteCategory(event.currentTarget.value as CommunityCategory)
                  }
                >
                  {writableCommunityCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className={inputClassName}
                name="title"
                placeholder="제목"
                value={writeTitle}
                onChange={(event) => setWriteTitle(event.currentTarget.value)}
                maxLength={80}
                required
              />
              <textarea
                className={cn(inputClassName, "min-h-40 resize-y")}
                name="content"
                placeholder="내용"
                value={writeContent}
                onChange={(event) => setWriteContent(event.currentTarget.value)}
                maxLength={2000}
                required
              />
              <div className="rounded-lg border border-dashed border-zinc-700 bg-black/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">이미지 첨부</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      jpg, png, webp, heic · 최대 3장 · 자동 압축
                    </p>
                  </div>
                  <label className={cn(secondaryButtonClassName, "cursor-pointer")}>
                    이미지 선택
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
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
                            src={image.dataUrl ?? image.url}
                            alt={image.name}
                            fill
                            unoptimized
                            sizes="120px"
                            className="object-cover"
                            onError={() => {
                              console.error("community-image-render-error", {
                                storedImageValue:
                                  image.path ?? image.url ?? image.dataUrl,
                                finalImageUrl: image.dataUrl ?? image.url,
                              });
                            }}
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
              {isAdmin ? (
                <div className="grid gap-2 rounded-lg border border-zinc-800 bg-black/40 p-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      name="isNotice"
                      checked={writeIsNotice}
                      onChange={(event) =>
                        setWriteIsNotice(event.currentTarget.checked)
                      }
                      className="h-4 w-4 accent-red-500"
                    />
                    공지글
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      name="isPinned"
                      checked={writeIsPinned}
                      onChange={(event) =>
                        setWriteIsPinned(event.currentTarget.checked)
                      }
                      className="h-4 w-4 accent-red-500"
                    />
                    상단 고정
                  </label>
                </div>
              ) : null}
              <button
                type="submit"
                className={primaryButtonClassName}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? editingPostId
                    ? "수정 중"
                    : "등록 중"
                  : editingPostId
                    ? "수정"
                    : "등록"}
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
                onClick={() => {
                  setCurrentPage(1);
                  void loadPosts(activeCategory);
                }}
              >
                새로고침
              </button>
            </div>

            {isLoadingPosts ? (
              <p className={mutedTextClassName}>글 목록을 불러오는 중입니다.</p>
            ) : visiblePosts.length === 0 ? (
              <p className={mutedTextClassName}>
                {searchQuery
                  ? "검색 결과가 없습니다."
                  : "아직 등록된 글이 없습니다. 첫 글을 작성해보세요."}
              </p>
            ) : (
              <div>
                <div className="divide-y divide-zinc-800">
                  {currentPagePosts.map((post) => {
                    const isSelected = selectedPost?.id === post.id;
                    const thumbnailImage = post.images[0];
                    const thumbnailImageUrl =
                      thumbnailImage?.url ?? thumbnailImage?.dataUrl;

                    return (
                      <button
                        key={post.id}
                        type="button"
                        className={cn(
                          "block w-full px-1 py-4 text-left transition first:pt-0 last:pb-0",
                          isSelected
                            ? "rounded-lg bg-red-500/10 px-4"
                            : "hover:bg-zinc-900/50"
                        )}
                        onClick={() => {
                          setSelectedPost(post);
                          setIsWriting(false);
                        }}
                      >
                        <span className="mb-2 inline-flex rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-extrabold text-red-200">
                          {getCommunityCategoryLabel(post.category)}
                        </span>
                        {post.isNotice ? (
                          <span className="mb-2 ml-2 inline-flex rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs font-extrabold text-amber-200">
                            공지
                          </span>
                        ) : null}
                        {post.isPinned ? (
                          <span className="mb-2 ml-2 inline-flex rounded-md border border-zinc-500 bg-zinc-800 px-2 py-1 text-xs font-extrabold text-zinc-100">
                            상단고정
                          </span>
                        ) : null}
                        <span className="block text-base font-extrabold text-white sm:text-lg">
                          {post.title}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500">
                          <span>{post.authorNickname}</span>
                          <span>댓글 {post.commentCount}</span>
                          <span>좋아요 {post.likeCount}</span>
                          <span>{post.createdAt}</span>
                          {post.images.length > 0 ? (
                            <span>이미지 {post.images.length}</span>
                          ) : null}
                        </span>
                        {thumbnailImageUrl ? (
                          <span className="mt-3 block">
                            <span className="relative block aspect-[16/9] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                              <Image
                                src={thumbnailImageUrl}
                                alt={thumbnailImage.name}
                                fill
                                unoptimized
                                sizes="360px"
                                className="object-cover"
                                onError={() => {
                                  console.error("community-image-render-error", {
                                    storedImageValue:
                                      thumbnailImage.path ??
                                      thumbnailImage.url ??
                                      thumbnailImage.dataUrl,
                                    finalImageUrl: thumbnailImageUrl,
                                  });
                                }}
                              />
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage <= 1}
                  >
                    이전
                  </button>
                  <span className="text-sm font-bold text-zinc-400">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>

          <article className={panelClassName}>
            {selectedPost ? (
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
                        <span>
                          {getCommunityCategoryLabel(selectedPost.category)}
                        </span>
                        {selectedPost.isNotice ? <span>공지</span> : null}
                        {selectedPost.isPinned ? <span>상단고정</span> : null}
                        <span>{selectedPost.authorNickname}</span>
                        <span>{selectedPost.createdAt}</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                        {selectedPost.title}
                      </h2>
                    </div>
                    {canEditSelectedPost ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={startEditingSelectedPost}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClassName}
                          onClick={handleDeletePost}
                          disabled={isDeletingPost}
                        >
                          {isDeletingPost ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-zinc-200">
                    {selectedPost.content}
                  </p>
                  {selectedPost.images.length > 0 ? (
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {selectedPost.images
                        .slice(0, maxCommunityImages)
                        .map((image) => {
                          const finalImageUrl = image.url ?? image.dataUrl;

                          return (
                            <a
                              key={image.id}
                              href={finalImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                            >
                              {finalImageUrl ? (
                                <Image
                                  src={finalImageUrl}
                                  alt={image.name}
                                  fill
                                  unoptimized
                                  sizes="160px"
                                  className="object-cover"
                                  onError={() => {
                                    console.error(
                                      "community-image-render-error",
                                      {
                                        storedImageValue:
                                          image.path ??
                                          image.url ??
                                          image.dataUrl,
                                        finalImageUrl,
                                      }
                                    );
                                  }}
                                />
                              ) : null}
                            </a>
                          );
                        })}
                    </div>
                  ) : null}
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
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={handleLike}
                      disabled={selectedPost.likedByMe}
                    >
                      {selectedPost.likedByMe
                        ? "좋아요됨 " + selectedPost.likeCount
                        : "좋아요 " + selectedPost.likeCount}
                    </button>
                    <button
                      type="button"
                      className={reportButtonClassName}
                      onClick={handleReport}
                      disabled={
                        selectedPost.reportedByMe ||
                        reportedPostIds.has(selectedPost.id)
                      }
                    >
                      {selectedPost.reportedByMe ||
                      reportedPostIds.has(selectedPost.id)
                        ? "신고됨 " + selectedPost.reportCount
                        : "🚨 신고 " + selectedPost.reportCount}
                    </button>
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

        {isReportModalOpen && selectedPost ? (
          <div
            className={reportModalOverlayClassName}
            onClick={closeReportModal}
            role="dialog"
            aria-modal="true"
            aria-label="게시글 신고"
          >
            <div
              className={reportModalPanelClassName}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">게시글 신고</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    신고 사유를 선택해주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReportModal}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  닫기
                </button>
              </div>

              <div className="space-y-2">
                {communityReportReasons.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReportReason(reason)}
                    aria-pressed={selectedReportReason === reason}
                    className={cn(
                      reportReasonButtonClassName,
                      selectedReportReason === reason &&
                        activeReportReasonButtonClassName
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={submitCommunityReport}
                disabled={!selectedReportReason}
                className={reportSubmitButtonClassName}
              >
                신고하기
              </button>
              <button
                type="button"
                onClick={closeReportModal}
                className={reportCancelButtonClassName}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
