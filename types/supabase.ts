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
      community_posts: {
        Row: {
          id: string;
          category: "free" | "maintenance" | "question" | "news" | "shop_review" | "electric" | "imported" | "domestic";
          title: string;
          content: string;
          user_id: string;
          author_nickname: string | null;
          images: Json;
          is_hidden: boolean;
          report_count: number;
          like_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: "free" | "maintenance" | "question" | "news" | "shop_review" | "electric" | "imported" | "domestic";
          title: string;
          content: string;
          user_id: string;
          author_nickname?: string | null;
          images?: Json;
          is_hidden?: boolean;
          report_count?: number;
          like_count?: number;
          comment_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: "free" | "maintenance" | "question" | "news" | "shop_review" | "electric" | "imported" | "domestic";
          title?: string;
          content?: string;
          user_id?: string;
          author_nickname?: string | null;
          images?: Json;
          is_hidden?: boolean;
          report_count?: number;
          like_count?: number;
          comment_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          author_nickname: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          author_nickname?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          author_nickname?: string | null;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          }
        ];
      };
      community_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          }
        ];
      };
      community_reports: {
        Row: {
          id: string;
          post_id: string;
          user_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          }
        ];
      };
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
          id: string;
          nickname: string | null;
          nickname_changed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname?: string | null;
          nickname_changed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string | null;
          nickname_changed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey";
            columns: ["id"];
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
    Functions: {
      set_review_helpful_count: {
        Args: {
          p_helpful_count: number;
          p_review_id: string;
        };
        Returns: void;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
