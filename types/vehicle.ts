import type { Database } from "@/types/supabase";

export interface Vehicle {
  id?: string;
  plateNumber: string;
  brand: string;
  model: string;
  generation: string;
  year: string;
  mileage: string;
  fuelType: string;
  createdAt?: string;
  updatedAt?: string;
}

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
export type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];
