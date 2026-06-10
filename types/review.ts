import type { Vehicle } from "@/types/vehicle";
import type { Database } from "@/types/supabase";

export interface ReviewImageAttachment {
  id: string;
  name: string;
  type: "image/jpeg" | "image/png" | "image/webp";
  dataUrl?: string;
  url?: string;
  path?: string;
  size: number;
}

export interface Review {
  id: number | string;
  authorId?: string;
  authorNickname?: string;
  authorIsVerifiedDealer?: boolean;
  content: string;
  tags?: string[];
  helpfulCount?: number;
  reportCount?: number;
  viewCount?: number;
  recentViewCount?: number;
  isHidden?: boolean;
  images?: ReviewImageAttachment[];
  hasImages?: boolean;
  createdAt: string;
  vehicleSnapshot?: Vehicle;
}

export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
export type ReviewInsert = Database["public"]["Tables"]["reviews"]["Insert"];
export type ReviewUpdate = Database["public"]["Tables"]["reviews"]["Update"];
export type ReviewReportRow =
  Database["public"]["Tables"]["review_reports"]["Row"];
export type ReviewReportInsert =
  Database["public"]["Tables"]["review_reports"]["Insert"];
export type ReviewReportUpdate =
  Database["public"]["Tables"]["review_reports"]["Update"];
