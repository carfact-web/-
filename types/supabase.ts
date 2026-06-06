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
          category: "free" | "maintenance" | "news" | "electric" | "imported" | "domestic" | "partner";
          title: string;
          content: string;
          user_id: string;
          author_nickname: string | null;
          images: Json;
          is_hidden: boolean;
          is_notice: boolean;
          is_pinned: boolean;
          report_count: number;
          like_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: "free" | "maintenance" | "news" | "electric" | "imported" | "domestic" | "partner";
          title: string;
          content: string;
          user_id: string;
          author_nickname?: string | null;
          images?: Json;
          is_hidden?: boolean;
          is_notice?: boolean;
          is_pinned?: boolean;
          report_count?: number;
          like_count?: number;
          comment_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: "free" | "maintenance" | "news" | "electric" | "imported" | "domestic" | "partner";
          title?: string;
          content?: string;
          user_id?: string;
          author_nickname?: string | null;
          images?: Json;
          is_hidden?: boolean;
          is_notice?: boolean;
          is_pinned?: boolean;
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
          author_id: string | null;
          author_nickname: string | null;
          content: string;
          tags: string[];
          images: Json;
          vehicle_snapshot: Json;
          helpful_count: number;
          report_count: number;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          author_id?: string | null;
          author_nickname?: string | null;
          content: string;
          tags?: string[];
          images?: Json;
          vehicle_snapshot?: Json;
          helpful_count?: number;
          report_count?: number;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          author_id?: string | null;
          author_nickname?: string | null;
          content?: string;
          tags?: string[];
          images?: Json;
          vehicle_snapshot?: Json;
          helpful_count?: number;
          report_count?: number;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
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
          nickname_change_available: number;
          role: "user" | "admin" | "super_admin";
          is_suspended: boolean;
          is_verified_dealer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname?: string | null;
          nickname_changed?: boolean;
          nickname_change_available?: number;
          role?: "user" | "admin" | "super_admin";
          is_suspended?: boolean;
          is_verified_dealer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string | null;
          nickname_changed?: boolean;
          nickname_change_available?: number;
          role?: "user" | "admin" | "super_admin";
          is_suspended?: boolean;
          is_verified_dealer?: boolean;
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
      popup_notices: {
        Row: {
          id: string;
          title: string;
          content: string;
          link_url: string | null;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          link_url?: string | null;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          link_url?: string | null;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      admin_delete_community_post: {
        Args: {
          target_post_id: string;
        };
        Returns: boolean;
      };
      admin_delete_community_notice: {
        Args: {
          target_post_id: string;
        };
        Returns: boolean;
      };
      admin_delete_popup_notice: {
        Args: {
          target_notice_id: string;
        };
        Returns: boolean;
      };
      admin_delete_review: {
        Args: {
          target_review_id: string;
        };
        Returns: boolean;
      };
      admin_get_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          users_count: number;
          community_posts_count: number;
          reviews_count: number;
          comments_count: number;
          reports_count: number;
        }[];
      };
      admin_list_community_posts: {
        Args: {
          search_text?: string;
        };
        Returns: {
          id: string;
          category: "free" | "maintenance" | "news" | "electric" | "imported" | "domestic" | "partner";
          title: string;
          content: string;
          user_id: string;
          author_nickname: string | null;
          images: Json;
          is_hidden: boolean;
          is_notice: boolean;
          is_pinned: boolean;
          report_count: number;
          like_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
        }[];
      };
      admin_list_reports: {
        Args: {
          search_text?: string;
        };
        Returns: {
          report_type: "게시글" | "후기";
          report_id: string;
          target_id: string;
          reason: string | null;
          reporter_id: string | null;
          created_at: string;
          report_count: number;
          target_title: string | null;
          target_content: string;
          target_author: string | null;
          is_hidden: boolean;
          target_path: string | null;
        }[];
      };
      admin_list_reviews: {
        Args: {
          search_text?: string;
        };
        Returns: {
          id: string;
          vehicle_id: string;
          author_id: string | null;
          author_nickname: string | null;
          content: string;
          tags: string[];
          images: Json;
          vehicle_snapshot: Json;
          helpful_count: number;
          report_count: number;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        }[];
      };
      admin_list_user_profiles: {
        Args: {
          search_text?: string;
        };
        Returns: {
          id: string;
          nickname: string | null;
          nickname_changed: boolean;
          nickname_change_available: number;
          role: "user" | "admin" | "super_admin";
          is_suspended: boolean;
          is_verified_dealer: boolean;
          created_at: string;
          updated_at: string;
        }[];
      };
      admin_list_popup_notices: {
        Args: {
          search_text?: string;
        };
        Returns: {
          id: string;
          title: string;
          content: string;
          link_url: string | null;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      admin_set_community_post_state: {
        Args: {
          target_post_id: string;
          next_is_hidden?: boolean | null;
          next_is_notice?: boolean | null;
          next_is_pinned?: boolean | null;
        };
        Returns: boolean;
      };
      admin_set_review_hidden: {
        Args: {
          target_review_id: string;
          next_is_hidden: boolean;
        };
        Returns: boolean;
      };
      admin_grant_nickname_change_ticket: {
        Args: {
          target_user_id: string;
          grant_amount?: number;
        };
        Returns: number;
      };
      admin_set_user_role: {
        Args: {
          target_user_id: string;
          next_role: "user" | "admin";
        };
        Returns: boolean;
      };
      admin_set_user_suspended: {
        Args: {
          target_user_id: string;
          next_is_suspended: boolean;
        };
        Returns: boolean;
      };
      admin_set_user_verified_dealer: {
        Args: {
          target_user_id: string;
          next_is_verified_dealer: boolean;
        };
        Returns: boolean;
      };
      list_verified_dealer_profiles: {
        Args: {
          target_user_ids: string[];
        };
        Returns: {
          id: string;
          is_verified_dealer: boolean;
        }[];
      };
      admin_upsert_community_notice: {
        Args: {
          target_post_id?: string | null;
          next_title?: string;
          next_content?: string;
          next_category?: string;
          next_is_pinned?: boolean;
        };
        Returns: string | null;
      };
      admin_upsert_popup_notice: {
        Args: {
          target_notice_id?: string | null;
          next_title?: string;
          next_content?: string;
          next_link_url?: string | null;
          next_is_active?: boolean;
          next_starts_at?: string | null;
          next_ends_at?: string | null;
        };
        Returns: string | null;
      };
      current_user_has_admin_role: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      current_user_has_super_admin_role: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      hide_own_community_post: {
        Args: {
          target_post_id: string;
        };
        Returns: boolean;
      };
      hide_review: {
        Args: {
          target_review_id: string;
        };
        Returns: boolean;
      };
      set_review_helpful_count: {
        Args: {
          p_helpful_count: number;
          p_review_id: string;
        };
        Returns: void;
      };
      update_community_post: {
        Args: {
          target_post_id: string;
          next_category: string;
          next_title: string;
          next_content: string;
          next_images: Json;
          next_is_notice: boolean;
          next_is_pinned: boolean;
        };
        Returns: boolean;
      };
      update_review: {
        Args: {
          target_review_id: string;
          next_content: string;
          next_tags: string[];
          next_images: Json;
        };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
