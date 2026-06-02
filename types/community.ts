import type { Database } from "@/types/supabase";

export type CommunityCategory =
  | "free"
  | "maintenance"
  | "news"
  | "electric"
  | "imported"
  | "domestic"
  | "partner";

export type CommunityCategoryFilter = "all" | CommunityCategory;

export interface CommunityImageAttachment {
  id: string;
  name: string;
  path?: string;
  size: number;
  type: "image/jpeg" | "image/png" | "image/webp";
  dataUrl?: string;
  url?: string;
}

export interface CommunityPost {
  id: string;
  category: CommunityCategory;
  title: string;
  content: string;
  authorNickname: string;
  userId: string;
  isNotice: boolean;
  isPinned: boolean;
  images: CommunityImageAttachment[];
  imageUploadWarning?: string;
  likedByMe: boolean;
  likeCount: number;
  commentCount: number;
  reportedByMe: boolean;
  reportCount: number;
  createdAt: string;
  createdAtRaw: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  content: string;
  authorNickname: string;
  createdAt: string;
}

export type CommunityPostRow =
  Database["public"]["Tables"]["community_posts"]["Row"];
export type CommunityCommentRow =
  Database["public"]["Tables"]["community_comments"]["Row"];
