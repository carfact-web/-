import { supabase } from "@/lib/supabase";
import { createSupabaseFailureError } from "@/lib/supabaseErrorMessages";
import {
  communityImagesBucketName,
  getPersistableCommunityImages,
  uploadCommunityImages,
} from "@/lib/communityImages";
import type {
  CommunityCategory,
  CommunityCategoryFilter,
  CommunityComment,
  CommunityImageAttachment,
  CommunityCommentRow,
  CommunityPost,
  CommunityPostRow,
} from "@/types/community";
import type { Json } from "@/types/supabase";

const defaultCommunityNickname = "카팩트 사용자";

const toLocaleDateTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join(".");
};

const countByPostId = <T extends { post_id: string }>(rows: T[]) =>
  rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
    return counts;
  }, {});

const createCommunityPostId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return String(Date.now());
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toCommunityImages = (value: Json): CommunityImageAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as unknown[]).filter(isRecord).map((image) => {
    const path = typeof image.path === "string" ? image.path : undefined;
    const publicUrl =
      typeof image.url === "string" && image.url
        ? image.url
        : path && supabase
          ? supabase.storage.from(communityImagesBucketName).getPublicUrl(path)
              .data.publicUrl
          : undefined;

    return {
      id: String(image.id ?? publicUrl ?? path ?? Date.now()),
      name: String(image.name ?? "커뮤니티 이미지"),
      path,
      size: typeof image.size === "number" ? image.size : 0,
      type:
        image.type === "image/png" || image.type === "image/webp"
          ? image.type
          : "image/jpeg",
      url: publicUrl,
    };
  });
};

const isMissingImagesColumnError = (error: unknown) => {
  if (!isRecord(error)) {
    return false;
  }

  const message = String(error.message ?? "");
  const details = String(error.details ?? "");
  const code = String(error.code ?? "");

  return (
    code === "PGRST204" ||
    message.includes("images") ||
    details.includes("images")
  );
};

const isMissingAuthorNicknameColumnError = (error: unknown) => {
  if (!isRecord(error)) {
    return false;
  }

  const message = String(error.message ?? "");
  const details = String(error.details ?? "");
  const code = String(error.code ?? "");

  return (
    code === "PGRST204" &&
    (message.includes("author_nickname") || details.includes("author_nickname"))
  );
};

const isMissingCommunityAuxTableError = (error: unknown) => {
  if (!isRecord(error)) {
    return false;
  }

  const code = String(error.code ?? "");
  const message = String(error.message ?? "");

  return (
    code === "PGRST205" &&
    (message.includes("community_comments") ||
      message.includes("community_likes") ||
      message.includes("community_reports"))
  );
};

const isUniqueViolationError = (error: unknown) =>
  isRecord(error) && String(error.code ?? "") === "23505";

const mapCommunityPost = (
  row: CommunityPostRow,
  authorNicknames?: Record<string, string>,
  counts?: {
    comments?: Record<string, number>;
    likes?: Record<string, number>;
    reports?: Record<string, number>;
  }
): CommunityPost => ({
  id: row.id,
  category: row.category,
  title: row.title,
  content: row.content,
  authorNickname:
    row.author_nickname?.trim() ||
    authorNicknames?.[row.user_id]?.trim() ||
    defaultCommunityNickname,
  images: toCommunityImages(row.images),
  likeCount: counts?.likes?.[row.id] ?? row.like_count,
  commentCount: counts?.comments?.[row.id] ?? row.comment_count,
  reportCount: counts?.reports?.[row.id] ?? row.report_count,
  createdAt: toLocaleDateTime(row.created_at),
  createdAtRaw: row.created_at,
});

const mapCommunityComment = (row: CommunityCommentRow): CommunityComment => ({
  id: row.id,
  postId: row.post_id,
  content: row.content,
  authorNickname: row.author_nickname?.trim() || defaultCommunityNickname,
  createdAt: toLocaleDateTime(row.created_at),
});

const fetchCommunityPostCounts = async (postIds: string[]) => {
  if (!supabase || postIds.length === 0) {
    return {};
  }

  const [commentsResult, likesResult, reportsResult] = await Promise.all([
    supabase.from("community_comments").select("post_id").in("post_id", postIds),
    supabase.from("community_likes").select("post_id").in("post_id", postIds),
    supabase.from("community_reports").select("post_id").in("post_id", postIds),
  ]);

  if (commentsResult.error && !isMissingCommunityAuxTableError(commentsResult.error)) {
    throw commentsResult.error;
  }

  if (likesResult.error && !isMissingCommunityAuxTableError(likesResult.error)) {
    throw likesResult.error;
  }

  if (reportsResult.error && !isMissingCommunityAuxTableError(reportsResult.error)) {
    throw reportsResult.error;
  }

  if (commentsResult.error || likesResult.error || reportsResult.error) {
    console.warn("community-counts-partial-error", {
      commentsError: commentsResult.error ?? null,
      likesError: likesResult.error ?? null,
      reportsError: reportsResult.error ?? null,
    });
  }

  return {
    comments: countByPostId(commentsResult.data ?? []),
    likes: countByPostId(likesResult.data ?? []),
    reports: countByPostId(reportsResult.data ?? []),
  };
};

const fetchCommunityAuthorNicknames = async (posts: CommunityPostRow[]) => {
  if (!supabase || posts.length === 0) {
    return {};
  }

  const missingNicknameUserIds = Array.from(
    new Set(
      posts
        .filter((post) => !post.author_nickname?.trim())
        .map((post) => post.user_id)
        .filter(Boolean)
    )
  );

  if (missingNicknameUserIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,nickname")
    .in("id", missingNicknameUserIds);

  if (error) {
    console.warn("community-author-profile-error", error);
    return {};
  }

  return data.reduce<Record<string, string>>((nicknames, profile) => {
    if (profile.nickname?.trim()) {
      nicknames[profile.id] = profile.nickname.trim();
    }

    return nicknames;
  }, {});
};

export const fetchCommunityPosts = async (category: CommunityCategoryFilter) => {
  if (!supabase) {
    return [] as CommunityPost[];
  }

  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (category !== "all") {
    query = query.eq("category", category);
  }

  const { data: posts, error } = await query;

  if (error) {
    throw error;
  }

  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const [counts, authorNicknames] = await Promise.all([
    fetchCommunityPostCounts(postIds),
    fetchCommunityAuthorNicknames(posts),
  ]);

  return posts.map((post) => mapCommunityPost(post, authorNicknames, counts));
};

export const fetchCommunityPostsByAuthor = async (authorId: string) => {
  if (!supabase) {
    return [] as CommunityPost[];
  }

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("user_id", authorId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (posts.length === 0) {
    return [];
  }

  const [counts, authorNicknames] = await Promise.all([
    fetchCommunityPostCounts(posts.map((post) => post.id)),
    fetchCommunityAuthorNicknames(posts),
  ]);

  return posts.map((post) => mapCommunityPost(post, authorNicknames, counts));
};

export const fetchCommunityComments = async (postId: string) => {
  if (!supabase) {
    return [] as CommunityComment[];
  }

  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingCommunityAuxTableError(error)) {
      console.warn("community-comments-missing-table", {
        postId,
        error,
      });
      return [] as CommunityComment[];
    }

    throw error;
  }

  return data.map(mapCommunityComment);
};

export const saveCommunityPost = async (input: {
  authorNickname: string;
  category: CommunityCategory;
  content: string;
  images?: CommunityImageAttachment[];
  title: string;
}) => {
  if (!supabase) {
    return null;
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user.id ?? null;

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionUserId) {
    throw new Error("로그인 세션이 없어 커뮤니티 글을 저장하지 않았습니다.");
  }

  const now = new Date().toISOString();
  const postId = createCommunityPostId();
  const basePayload = {
    id: postId,
    user_id: sessionUserId,
    author_nickname: input.authorNickname.trim() || defaultCommunityNickname,
    category: input.category,
    content: input.content,
    title: input.title,
    created_at: now,
    updated_at: now,
  };
  const legacyBasePayload = {
    id: basePayload.id,
    user_id: basePayload.user_id,
    category: basePayload.category,
    content: basePayload.content,
    title: basePayload.title,
    created_at: basePayload.created_at,
    updated_at: basePayload.updated_at,
  };

  console.log("community-post-auth-session", {
    payloadUserId: basePayload.user_id,
    sessionUserId,
    userIdMatches: sessionUserId === basePayload.user_id,
  });

  const uploadResult = await uploadCommunityImages(input.images ?? [], postId);
  const payloadWithImages = {
    ...basePayload,
    images: getPersistableCommunityImages(uploadResult.images) as Json,
  };

  console.log("community-post-insert-payload", payloadWithImages);

  let { data, error } = await supabase
    .from("community_posts")
    .insert(payloadWithImages)
    .select("*")
    .single();

  if (
    error &&
    (isMissingImagesColumnError(error) || isMissingAuthorNicknameColumnError(error))
  ) {
    const retryResult = await supabase
      .from("community_posts")
      .insert(
        isMissingAuthorNicknameColumnError(error) ? legacyBasePayload : basePayload
      )
      .select("*")
      .single();

    data = retryResult.data;
    error = retryResult.error;
  }

  if (error) {
    console.error("community-post-save-error", {
      table: "community_posts",
      error,
    });
    throw createSupabaseFailureError("db-insert", error);
  }

  if (!data) {
    throw new Error("community-post-empty-response");
  }

  const savedPost = mapCommunityPost(data);

  if (uploadResult.failedCount > 0) {
    return {
      ...savedPost,
      imageUploadWarning:
        uploadResult.errorMessage ||
        "일부 이미지를 업로드하지 못해 글만 저장했습니다.",
    };
  }

  return savedPost;
};

export const saveCommunityComment = async (input: {
  authorNickname: string;
  content: string;
  postId: string;
  userId: string;
}) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      author_nickname: input.authorNickname || defaultCommunityNickname,
      content: input.content,
      post_id: input.postId,
      user_id: input.userId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapCommunityComment(data);
};

export const toggleCommunityLike = async (postId: string, userId: string) => {
  if (!supabase) {
    return false;
  }

  const { data: existingLike, error: existingError } = await supabase
    .from("community_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingLike) {
    const { error } = await supabase
      .from("community_likes")
      .delete()
      .eq("id", existingLike.id);

    if (error) {
      throw error;
    }

    return false;
  }

  const { error } = await supabase
    .from("community_likes")
    .insert({ post_id: postId, user_id: userId });

  if (error) {
    if (isUniqueViolationError(error)) {
      return true;
    }

    throw error;
  }

  return true;
};

export const reportCommunityPost = async (input: {
  postId: string;
  reason?: string;
  userId: string;
}) => {
  if (!supabase) {
    return false;
  }

  const { data: existingReport, error: existingError } = await supabase
    .from("community_reports")
    .select("id")
    .eq("post_id", input.postId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingReport) {
    return false;
  }

  const { data, error } = await supabase
    .from("community_reports")
    .insert({
      post_id: input.postId,
      reason: input.reason ?? "community-report",
      user_id: input.userId,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolationError(error)) {
      return false;
    }

    throw error;
  }

  return Boolean(data);
};
