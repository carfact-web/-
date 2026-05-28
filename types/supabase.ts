export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string;
          car_number: string;
          manufacturer: string;
          model: string;
          generation: string | null;
          year: string;
          mileage: string | null;
          fuel_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          car_number: string;
          manufacturer: string;
          model: string;
          generation?: string | null;
          year: string;
          mileage?: string | null;
          fuel_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          car_number?: string;
          manufacturer?: string;
          model?: string;
          generation?: string | null;
          year?: string;
          mileage?: string | null;
          fuel_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          vehicle_id: string;
          author_nickname: string | null;
          content: string;
          tags: string[];
          images: Json;
          vehicle_snapshot: Json;
          report_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          author_nickname?: string | null;
          content: string;
          tags?: string[];
          images?: Json;
          vehicle_snapshot?: Json;
          report_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          author_nickname?: string | null;
          content?: string;
          tags?: string[];
          images?: Json;
          vehicle_snapshot?: Json;
          report_count?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      review_reports: {
        Row: {
          id: string;
          review_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          reason?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
