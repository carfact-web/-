import type { Vehicle } from "@/types/vehicle";

export interface Review {
  id: number;
  authorNickname?: string;
  content: string;
  tags?: string[];
  helpfulCount?: number;
  createdAt: string;
  vehicleSnapshot?: Vehicle;
}
