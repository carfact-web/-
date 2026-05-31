import type { Database } from "@/types/supabase";

export type CommunityCategory =
  | "free"
  | "maintenance"
  | "question"
  | "news"
  | "shop_review"
  | "electric"
  | "imported"
  | "domestic";

export type CommunityCategoryFilter = "all" | CommunityCategory;

export interface CommunityImageAttachment {
  id: string;
  name: string;
  path?: string;
  size: number;
  type: "image/jpeg" | "image/png" | "image/webp";
  url?: string;
}

export interface CommunityPost {
  id: string;
  category: CommunityCategory;
  title: string;
  content: string;
  authorNickname: string;
  images: CommunityImageAttachment[];
  imageUploadWarning?: string;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  createdAt: string;
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
