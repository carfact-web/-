import { supabase } from "@/lib/supabase";
import { createSupabaseFailureError } from "@/lib/supabaseErrorMessages";
import {
  communityImagesBucketName,
  getCommunityImagePublicUrl,
  getPersistableCommunityImages,
  uploadCommunityImages,
} from "@/lib/communityImages";
import { fetchVerifiedDealerMap } from "@/lib/verifiedDealers";
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
const activeCommunityCategories: CommunityCategory[] = [
  "free",
  "maintenance",
  "news",
  "electric",
  "imported",
  "domestic",
  "partner",
];

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

const normalizeCommunityCategory = (value: string): CommunityCategory => {
  if (value === "question") {
    return "free";
  }

  if (value === "shop_review") {
    return "partner";
  }

  return activeCommunityCategories.includes(value as CommunityCategory)
    ? (value as CommunityCategory)
    : "free";
};

const parseStoredCommunityImage = (
  value: string
): Record<string, unknown> | null => {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("{")) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);

    return isRecord(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const toCommunityImages = (value: Json): CommunityImageAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const images = (value as unknown[]).map<CommunityImageAttachment | null>(
    (storedImage) => {
      let image = storedImage;

      if (typeof image === "string") {
        const parsedImage = parseStoredCommunityImage(image);

        if (parsedImage) {
          image = parsedImage;
        } else {
          const isPublicUrl = /^https?:\/\//.test(image);
          const path = isPublicUrl ? undefined : image;
          const url = getCommunityImagePublicUrl(image);
          const imageType: CommunityImageAttachment["type"] = image
            .toLowerCase()
            .endsWith(".webp")
            ? "image/webp"
            : image.toLowerCase().endsWith(".png")
              ? "image/png"
              : "image/jpeg";

          return {
            id: image,
            name: "커뮤니티 이미지",
            path,
            size: 0,
            type: imageType,
            url,
          } satisfies CommunityImageAttachment;
        }
      }

      if (!isRecord(image)) {
        return null;
      }

      const rawPath =
        typeof image.path === "string"
          ? image.path
          : typeof image.key === "string"
            ? image.key
            : undefined;
      const path = rawPath?.replace(/^community-images\//, "");
      const publicUrl = path
        ? getCommunityImagePublicUrl(path)
        : typeof image.url === "string" && image.url
          ? image.url
          : typeof image.publicUrl === "string" && image.publicUrl
            ? image.publicUrl
            : undefined;

      const imageType: CommunityImageAttachment["type"] =
        image.type === "image/png" || image.type === "image/webp"
          ? image.type
          : "image/jpeg";

      return {
        id: String(image.id ?? publicUrl ?? path ?? Date.now()),
        name: String(image.name ?? "커뮤니티 이미지"),
        path,
        size: typeof image.size === "number" ? image.size : 0,
        type: imageType,
        url: publicUrl,
      };
    }
  );

  return images.filter((image): image is CommunityImageAttachment =>
    Boolean(image)
  );
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

const isMissingRpcFunctionError = (error: unknown) =>
  isRecord(error) &&
  (String(error.code ?? "") === "PGRST202" ||
    String(error.message ?? "").includes("hide_own_community_post"));

const mapCommunityPost = (
  row: CommunityPostRow,
  authorProfiles?: Record<string, { isVerifiedDealer: boolean; nickname?: string }>,
  counts?: {
    comments?: Record<string, number>;
    likes?: Record<string, number>;
    reports?: Record<string, number>;
  },
  interactions?: {
    likedByMe?: Set<string>;
    reportedByMe?: Set<string>;
  }
): CommunityPost => {
  const images = toCommunityImages(row.images);

  if (Array.isArray(row.images) && row.images.length > 0) {
    console.log("community-post-images-render", {
      postId: row.id,
      rawImages: row.images,
      images,
    });
  }

  return {
    id: row.id,
    category: normalizeCommunityCategory(row.category),
    title: row.title,
    content: row.content,
    authorNickname:
      row.author_nickname?.trim() ||
      authorProfiles?.[row.user_id]?.nickname?.trim() ||
      defaultCommunityNickname,
    authorIsVerifiedDealer:
      authorProfiles?.[row.user_id]?.isVerifiedDealer ?? false,
    userId: row.user_id,
    isNotice: row.is_notice ?? false,
    isPinned: row.is_pinned ?? false,
    images,
    likedByMe: interactions?.likedByMe?.has(row.id) ?? false,
    likeCount: counts?.likes?.[row.id] ?? row.like_count,
    commentCount: counts?.comments?.[row.id] ?? row.comment_count,
    reportedByMe: interactions?.reportedByMe?.has(row.id) ?? false,
    reportCount: counts?.reports?.[row.id] ?? row.report_count,
    createdAt: toLocaleDateTime(row.created_at),
    createdAtRaw: row.created_at,
  };
};

const mapCommunityComment = (
  row: CommunityCommentRow,
  authorProfiles: Record<string, { isVerifiedDealer: boolean; nickname?: string }> = {}
): CommunityComment => ({
  id: row.id,
  postId: row.post_id,
  content: row.content,
  authorNickname: row.author_nickname?.trim() || defaultCommunityNickname,
  authorIsVerifiedDealer: authorProfiles[row.user_id]?.isVerifiedDealer ?? false,
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

const fetchCommunityAuthorProfiles = async (
  userIds: Array<string | null | undefined>,
  missingNicknameUserIds: string[] = []
) => {
  const targetUserIds = Array.from(
    new Set(userIds.filter((userId): userId is string => Boolean(userId)))
  );

  if (!supabase || targetUserIds.length === 0) {
    return {};
  }

  const [verifiedDealers, nicknameResult] = await Promise.all([
    fetchVerifiedDealerMap(targetUserIds),
    missingNicknameUserIds.length > 0
      ? supabase
          .from("user_profiles")
          .select("id,nickname")
          .in("id", missingNicknameUserIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (nicknameResult.error) {
    console.warn("community-author-profile-error", nicknameResult.error);
  }

  return targetUserIds.reduce<
    Record<string, { isVerifiedDealer: boolean; nickname?: string }>
  >((profiles, userId) => {
    const nickname = (nicknameResult.data ?? []).find(
      (profile) => profile.id === userId
    )?.nickname;

    profiles[userId] = {
      isVerifiedDealer: verifiedDealers[userId] ?? false,
      nickname: nickname?.trim() || undefined,
    };

    return profiles;
  }, {});
};

const fetchCommunityInteractionState = async (postIds: string[]) => {
  if (!supabase || postIds.length === 0) {
    return {
      likedByMe: new Set<string>(),
      reportedByMe: new Set<string>(),
    };
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;

  if (sessionError || !userId) {
    console.log("community-interaction-state", {
      userId,
      likedPostIds: [],
      reportedPostIds: [],
    });

    return {
      likedByMe: new Set<string>(),
      reportedByMe: new Set<string>(),
    };
  }

  const [likesResult, reportsResult] = await Promise.all([
    supabase
      .from("community_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    supabase
      .from("community_reports")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
  ]);

  if (likesResult.error && !isMissingCommunityAuxTableError(likesResult.error)) {
    throw likesResult.error;
  }

  if (
    reportsResult.error &&
    !isMissingCommunityAuxTableError(reportsResult.error)
  ) {
    throw reportsResult.error;
  }

  const likedPostIds = (likesResult.data ?? []).map((row) => row.post_id);
  const reportedPostIds = (reportsResult.data ?? []).map((row) => row.post_id);

  console.log("community-interaction-state", {
    userId,
    likedPostIds,
    reportedPostIds,
  });

  return {
    likedByMe: new Set(likedPostIds),
    reportedByMe: new Set(reportedPostIds),
  };
};

export const fetchCommunityPosts = async (category: CommunityCategoryFilter) => {
  if (!supabase) {
    return [] as CommunityPost[];
  }

  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
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
  const missingNicknameUserIds = Array.from(
    new Set(
      posts
        .filter((post) => !post.author_nickname?.trim())
        .map((post) => post.user_id)
        .filter(Boolean)
    )
  );
  const [counts, authorProfiles, interactions] = await Promise.all([
    fetchCommunityPostCounts(postIds),
    fetchCommunityAuthorProfiles(
      posts.map((post) => post.user_id),
      missingNicknameUserIds
    ),
    fetchCommunityInteractionState(postIds),
  ]);

  return posts.map((post) =>
    mapCommunityPost(post, authorProfiles, counts, interactions)
  );
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

  const postIds = posts.map((post) => post.id);
  const missingNicknameUserIds = Array.from(
    new Set(
      posts
        .filter((post) => !post.author_nickname?.trim())
        .map((post) => post.user_id)
        .filter(Boolean)
    )
  );
  const [counts, authorProfiles, interactions] = await Promise.all([
    fetchCommunityPostCounts(postIds),
    fetchCommunityAuthorProfiles(
      posts.map((post) => post.user_id),
      missingNicknameUserIds
    ),
    fetchCommunityInteractionState(postIds),
  ]);

  return posts.map((post) =>
    mapCommunityPost(post, authorProfiles, counts, interactions)
  );
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

  const authorProfiles = await fetchCommunityAuthorProfiles(
    data.map((comment) => comment.user_id)
  );

  return data.map((comment) => mapCommunityComment(comment, authorProfiles));
};

export const saveCommunityPost = async (input: {
  authorNickname: string;
  category: CommunityCategory;
  content: string;
  images?: CommunityImageAttachment[];
  isNotice?: boolean;
  isPinned?: boolean;
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
    is_notice: input.isNotice ?? false,
    is_pinned: input.isPinned ?? false,
    title: input.title,
    created_at: now,
    updated_at: now,
  };
  const legacyBasePayload = {
    id: basePayload.id,
    user_id: basePayload.user_id,
    category: basePayload.category,
    content: basePayload.content,
    is_notice: basePayload.is_notice,
    is_pinned: basePayload.is_pinned,
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
  const persistableImages = getPersistableCommunityImages(uploadResult.images);
  console.log("community-post-images-payload", {
    bucket: communityImagesBucketName,
    images: persistableImages,
  });
  const payloadWithImages = {
    ...basePayload,
    images: persistableImages as Json,
  };
  const legacyPayloadWithImages = {
    ...legacyBasePayload,
    images: persistableImages as Json,
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
        isMissingAuthorNicknameColumnError(error)
          ? (legacyPayloadWithImages as never)
          : basePayload
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

  console.log("community-post-images-db", data.images);

  const verifiedDealers = await fetchVerifiedDealerMap([sessionUserId]);
  const savedPost = mapCommunityPost(data, {
    [sessionUserId]: {
      isVerifiedDealer: verifiedDealers[sessionUserId] ?? false,
      nickname: basePayload.author_nickname,
    },
  });

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

export const updateCommunityPost = async (input: {
  category: CommunityCategory;
  content: string;
  images?: CommunityImageAttachment[];
  isNotice?: boolean;
  isPinned?: boolean;
  postId: string;
  title: string;
}) => {
  if (!supabase) {
    return false;
  }

  const uploadResult = await uploadCommunityImages(
    input.images ?? [],
    input.postId
  );
  const persistableImages = getPersistableCommunityImages(uploadResult.images);
  const { data, error } = await supabase.rpc("update_community_post", {
    target_post_id: input.postId,
    next_category: input.category,
    next_title: input.title,
    next_content: input.content,
    next_images: persistableImages as Json,
    next_is_notice: input.isNotice ?? false,
    next_is_pinned: input.isPinned ?? false,
  });

  if (error) {
    throw error;
  }

  if (uploadResult.failedCount > 0) {
    throw new Error(
      uploadResult.errorMessage ||
        "일부 이미지를 업로드하지 못해 글 수정이 완료되지 않았습니다."
    );
  }

  return Boolean(data);
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

  let { data, error } = await supabase
    .from("community_comments")
    .insert({
      author_nickname: input.authorNickname || defaultCommunityNickname,
      content: input.content,
      post_id: input.postId,
      user_id: input.userId,
    })
    .select("*")
    .single();

  if (
    error &&
    isRecord(error) &&
    String(error.code ?? "") === "42703" &&
    String(error.message ?? "").includes("community_comments.user_id")
  ) {
    const retryResult = await supabase
      .from("community_comments")
      .insert({
        author_id: input.userId,
        author_nickname: input.authorNickname || defaultCommunityNickname,
        content: input.content,
        post_id: input.postId,
      } as never)
      .select("*")
      .single();

    data = retryResult.data;
    error = retryResult.error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("community-comment-empty-response");
  }

  const verifiedDealers = await fetchVerifiedDealerMap([input.userId]);

  return mapCommunityComment(data, {
    [input.userId]: {
      isVerifiedDealer: verifiedDealers[input.userId] ?? false,
      nickname: input.authorNickname || defaultCommunityNickname,
    },
  });
};

export const deleteCommunityPost = async (postId: string) => {
  if (!supabase) {
    return false;
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;

  if (sessionError) {
    throw sessionError;
  }

  if (!userId) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data: didHidePost, error: rpcError } = await supabase.rpc(
    "hide_own_community_post",
    { target_post_id: postId }
  );

  if (!rpcError) {
    if (!didHidePost) {
      throw new Error("삭제 권한이 없거나 이미 삭제된 글입니다.");
    }

    return true;
  }

  if (!isMissingRpcFunctionError(rpcError)) {
    throw rpcError;
  }

  const { count, error } = await supabase
    .from("community_posts")
    .update({
      is_hidden: true,
      updated_at: new Date().toISOString(),
    }, { count: "exact" })
    .eq("id", postId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  if (count === 0) {
    throw new Error("삭제 권한이 없거나 이미 삭제된 글입니다.");
  }

  return true;
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
