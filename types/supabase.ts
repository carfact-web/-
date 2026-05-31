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
      user_profiles: {
        Row: {
          user_id: string;
          email: string | null;
          display_name: string | null;
          nickname: string | null;
          nickname_changed: boolean;
          auth_provider: string | null;
          provider_user_id: string | null;
          kakao_provider_id: string | null;
          google_provider_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email?: string | null;
          display_name?: string | null;
          nickname?: string | null;
          nickname_changed?: boolean;
          auth_provider?: string | null;
          provider_user_id?: string | null;
          kakao_provider_id?: string | null;
          google_provider_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string | null;
          display_name?: string | null;
          nickname?: string | null;
          nickname_changed?: boolean;
          auth_provider?: string | null;
          provider_user_id?: string | null;
          kakao_provider_id?: string | null;
          google_provider_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_master: {
        Row: {
          id: string;
          source: string;
          source_maker_no: number | null;
          source_model_no: number | null;
          source_model_detail_no: number | null;
          manufacturer: string;
          model: string;
          model_detail: string;
          aliases: string[];
          search_text: string;
          search_text_normalized: string;
          country: string | null;
          maker_code: string | null;
          model_code: string | null;
          model_detail_code: string | null;
          kind_code: string | null;
          kind_sub_code: string | null;
          sort_order: number | null;
          active_car_count: number | null;
          source_created_at_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source?: string;
          source_maker_no?: number | null;
          source_model_no?: number | null;
          source_model_detail_no?: number | null;
          manufacturer: string;
          model: string;
          model_detail: string;
          aliases?: string[];
          search_text: string;
          search_text_normalized: string;
          country?: string | null;
          maker_code?: string | null;
          model_code?: string | null;
          model_detail_code?: string | null;
          kind_code?: string | null;
          kind_sub_code?: string | null;
          sort_order?: number | null;
          active_car_count?: number | null;
          source_created_at_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: string;
          source_maker_no?: number | null;
          source_model_no?: number | null;
          source_model_detail_no?: number | null;
          manufacturer?: string;
          model?: string;
          model_detail?: string;
          aliases?: string[];
          search_text?: string;
          search_text_normalized?: string;
          country?: string | null;
          maker_code?: string | null;
          model_code?: string | null;
          model_detail_code?: string | null;
          kind_code?: string | null;
          kind_sub_code?: string | null;
          sort_order?: number | null;
          active_car_count?: number | null;
          source_created_at_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
