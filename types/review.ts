import type { Vehicle } from "@/types/vehicle";

export interface ReviewImageAttachment {
  id: string;
  name: string;
  type: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
  size: number;
}

export interface Review {
  id: number;
  authorNickname?: string;
  content: string;
  tags?: string[];
  helpfulCount?: number;
  reportCount?: number;
  images?: ReviewImageAttachment[];
  hasImages?: boolean;
  createdAt: string;
  vehicleSnapshot?: Vehicle;
}
