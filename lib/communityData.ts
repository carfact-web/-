import { supabase } from "@/lib/supabase";
import {
  getPersistableCommunityImages,
  uploadCommunityImages,
} from "@/lib/communityImages";
import type {
  CommunityCategory,
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

  return date.toLocaleString();
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

  return (value as unknown[]).filter(isRecord).map((image) => ({
    id: String(image.id ?? image.url ?? image.path ?? Date.now()),
    name: String(image.name ?? "커뮤니티 이미지"),
    path: typeof image.path === "string" ? image.path : undefined,
    size: typeof image.size === "number" ? image.size : 0,
    type:
      image.type === "image/png" || image.type === "image/webp"
        ? image.type
        : "image/jpeg",
    url: typeof image.url === "string" ? image.url : undefined,
  }));
};

const mapCommunityPost = (
  row: CommunityPostRow,
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
  authorNickname: row.author_nickname?.trim() || defaultCommunityNickname,
  images: toCommunityImages(row.images),
  likeCount: counts?.likes?.[row.id] ?? 0,
  commentCount: counts?.comments?.[row.id] ?? 0,
  reportCount: counts?.reports?.[row.id] ?? row.report_count,
  createdAt: toLocaleDateTime(row.created_at),
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

  if (commentsResult.error) {
    throw commentsResult.error;
  }

  if (likesResult.error) {
    throw likesResult.error;
  }

  if (reportsResult.error) {
    throw reportsResult.error;
  }

  return {
    comments: countByPostId(commentsResult.data),
    likes: countByPostId(likesResult.data),
    reports: countByPostId(reportsResult.data),
  };
};

export const fetchCommunityPosts = async (category: CommunityCategory) => {
  if (!supabase) {
    return [] as CommunityPost[];
  }

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const counts = await fetchCommunityPostCounts(postIds);

  return posts.map((post) => mapCommunityPost(post, counts));
};

export const fetchCommunityPostsByAuthor = async (authorId: string) => {
  if (!supabase) {
    return [] as CommunityPost[];
  }

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (posts.length === 0) {
    return [];
  }

  const counts = await fetchCommunityPostCounts(posts.map((post) => post.id));

  return posts.map((post) => mapCommunityPost(post, counts));
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
    throw error;
  }

  return data.map(mapCommunityComment);
};

export const saveCommunityPost = async (input: {
  authorId: string;
  authorNickname: string;
  category: CommunityCategory;
  content: string;
  images?: CommunityImageAttachment[];
  title: string;
}) => {
  if (!supabase) {
    return null;
  }

  const now = new Date().toISOString();
  const postId = createCommunityPostId();
  const uploadedImages = await uploadCommunityImages(input.images ?? [], postId);
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      id: postId,
      author_id: input.authorId,
      author_nickname: input.authorNickname || defaultCommunityNickname,
      category: input.category,
      content: input.content,
      images: getPersistableCommunityImages(uploadedImages) as Json,
      title: input.title,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapCommunityPost(data);
};

export const saveCommunityComment = async (input: {
  authorId: string;
  authorNickname: string;
  content: string;
  postId: string;
}) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      author_id: input.authorId,
      author_nickname: input.authorNickname || defaultCommunityNickname,
      content: input.content,
      post_id: input.postId,
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
    return null;
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
    throw error;
  }

  return data;
};
