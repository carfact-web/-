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
          category:
            | "free"
            | "maintenance"
            | "news"
            | "electric"
            | "imported"
            | "domestic"
            | "partner";
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
          category:
            | "free"
            | "maintenance"
            | "news"
            | "electric"
            | "imported"
            | "domestic"
            | "partner";
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
          category?:
            | "free"
            | "maintenance"
            | "news"
            | "electric"
            | "imported"
            | "domestic"
            | "partner";
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
          },
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
          },
        ];
      };
      review_helpful: {
        Row: {
          id: string;
          review_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
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
          },
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
          },
        ];
      };
      page_views: {
        Row: {
          id: string;
          created_at: string;
          vehicle_id: string | null;
          review_id: string | null;
          user_id: string | null;
          session_id: string;
          ip_hash: string | null;
          user_agent: string | null;
          device_type: "mobile" | "desktop" | "tablet" | "unknown";
          browser: string;
          os: string;
          referrer: string | null;
          referrer_channel: string;
          referrer_keyword: string;
          landing_page: string | null;
          path: string | null;
          event_type: "page_view" | "vehicle_view" | "review_view";
        };
        Insert: {
          id?: string;
          created_at?: string;
          vehicle_id?: string | null;
          review_id?: string | null;
          user_id?: string | null;
          session_id: string;
          ip_hash?: string | null;
          user_agent?: string | null;
          device_type?: "mobile" | "desktop" | "tablet" | "unknown";
          browser?: string;
          os?: string;
          referrer?: string | null;
          referrer_channel?: string;
          referrer_keyword?: string;
          landing_page?: string | null;
          path?: string | null;
          event_type?: "page_view" | "vehicle_view" | "review_view";
        };
        Update: {
          id?: string;
          created_at?: string;
          vehicle_id?: string | null;
          review_id?: string | null;
          user_id?: string | null;
          session_id?: string;
          ip_hash?: string | null;
          user_agent?: string | null;
          device_type?: "mobile" | "desktop" | "tablet" | "unknown";
          browser?: string;
          os?: string;
          referrer?: string | null;
          referrer_channel?: string;
          referrer_keyword?: string;
          landing_page?: string | null;
          path?: string | null;
          event_type?: "page_view" | "vehicle_view" | "review_view";
        };
        Relationships: [
          {
            foreignKeyName: "page_views_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_views_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
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
          },
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
          login_provider: string | null;
          email: string | null;
          provider_profile_name: string | null;
          provider_avatar_url: string | null;
          provider_user_id: string | null;
          last_sign_in_at: string | null;
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
          login_provider?: string | null;
          email?: string | null;
          provider_profile_name?: string | null;
          provider_avatar_url?: string | null;
          provider_user_id?: string | null;
          last_sign_in_at?: string | null;
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
          login_provider?: string | null;
          email?: string | null;
          provider_profile_name?: string | null;
          provider_avatar_url?: string | null;
          provider_user_id?: string | null;
          last_sign_in_at?: string | null;
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
          },
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
      knowledge_terms: {
        Row: {
          id: string;
          category:
            | "증상"
            | "부품"
            | "시스템"
            | "정비용어"
            | "경고등"
            | "보험"
            | "성능기록부"
            | "일반";
          representative_name: string;
          slug: string;
          description: string;
          main_causes: string[];
          main_symptoms: string[];
          maintenance_tips: string[];
          expected_repair_cost: string;
          related_keywords: string[];
          related_models: string[];
          priority: number;
          view_count: number;
          is_visible: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category:
            | "증상"
            | "부품"
            | "시스템"
            | "정비용어"
            | "경고등"
            | "보험"
            | "성능기록부"
            | "일반";
          representative_name: string;
          slug: string;
          description?: string;
          main_causes?: string[];
          main_symptoms?: string[];
          maintenance_tips?: string[];
          expected_repair_cost?: string;
          related_keywords?: string[];
          related_models?: string[];
          priority?: number;
          view_count?: number;
          is_visible?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?:
            | "증상"
            | "부품"
            | "시스템"
            | "정비용어"
            | "경고등"
            | "보험"
            | "성능기록부"
            | "일반";
          representative_name?: string;
          slug?: string;
          description?: string;
          main_causes?: string[];
          main_symptoms?: string[];
          maintenance_tips?: string[];
          expected_repair_cost?: string;
          related_keywords?: string[];
          related_models?: string[];
          priority?: number;
          view_count?: number;
          is_visible?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      external_acquisition_metrics: {
        Row: {
          id: string;
          metric_date: string;
          provider:
            | "manual"
            | "google_search_console"
            | "google_analytics"
            | "microsoft_clarity"
            | "bing_webmaster"
            | "naver_search_advisor"
            | "daum_search"
            | "geo";
          channel: string;
          keyword: string;
          landing_page: string;
          model_name: string | null;
          symptom_keyword: string | null;
          impressions: number;
          clicks: number;
          ctr: number | null;
          average_position: number | null;
          geo_score: number | null;
          clarity_sessions: number;
          source_payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          metric_date: string;
          provider?:
            | "manual"
            | "google_search_console"
            | "google_analytics"
            | "microsoft_clarity"
            | "bing_webmaster"
            | "naver_search_advisor"
            | "daum_search"
            | "geo";
          channel?: string;
          keyword?: string;
          landing_page?: string;
          model_name?: string | null;
          symptom_keyword?: string | null;
          impressions?: number;
          clicks?: number;
          ctr?: number | null;
          average_position?: number | null;
          geo_score?: number | null;
          clarity_sessions?: number;
          source_payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          metric_date?: string;
          provider?:
            | "manual"
            | "google_search_console"
            | "google_analytics"
            | "microsoft_clarity"
            | "bing_webmaster"
            | "naver_search_advisor"
            | "daum_search"
            | "geo";
          channel?: string;
          keyword?: string;
          landing_page?: string;
          model_name?: string | null;
          symptom_keyword?: string | null;
          impressions?: number;
          clicks?: number;
          ctr?: number | null;
          average_position?: number | null;
          geo_score?: number | null;
          clarity_sessions?: number;
          source_payload?: Json;
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
      admin_delete_knowledge_term: {
        Args: {
          target_term_id: string;
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
      admin_get_traffic_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          today_visitors: number;
          seven_day_visitors: number;
          thirty_day_visitors: number;
          total_visitors: number;
          today_reviews_count: number;
          total_reviews_count: number;
          total_users_count: number;
          top_vehicles: Json;
          top_models: Json;
          top_reviews: Json;
          device_breakdown: Json;
          browser_breakdown: Json;
          os_breakdown: Json;
          referrer_top: Json;
          path_top: Json;
          hourly_visitors: Json;
          daily_visitors: Json;
        }[];
      };
      admin_get_operator_dashboard_data: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total_views: number;
          traffic_rows: Json;
          view_rankings: Json;
          keyword_rows: Json;
          acquisition_rows: Json;
          search_console_summary: Json;
          internal_keyword_rows: Json;
          ai_candidates: Json;
        }[];
      };
      admin_set_ai_candidate_status: {
        Args: {
          candidate_key: string;
          candidate_keyword: string;
          candidate_source: string;
          related_models?: string[];
          next_status?: string;
        };
        Returns: Json;
      };
      public_get_home_traffic_rankings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          top_vehicles: Json;
          top_models: Json;
        }[];
      };
      get_vehicle_review_keyword_stats: {
        Args: {
          target_vehicle_id: string;
          minimum_review_count?: number;
        };
        Returns: {
          keyword: string;
          mention_count: number;
          mention_rate: number;
        }[];
      };
      public_get_recent_home_reviews: {
        Args: {
          review_limit?: number;
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
          view_count: number;
          recent_view_count: number;
        }[];
      };
      admin_list_community_posts: {
        Args: {
          search_text?: string;
        };
        Returns: {
          id: string;
          category:
            | "free"
            | "maintenance"
            | "news"
            | "electric"
            | "imported"
            | "domestic"
            | "partner";
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
      admin_list_knowledge_terms: {
        Args: {
          search_text?: string;
          sort_key?: string;
        };
        Returns: {
          id: string;
          category:
            | "증상"
            | "부품"
            | "시스템"
            | "정비용어"
            | "경고등"
            | "보험"
            | "성능기록부"
            | "일반";
          representative_name: string;
          slug: string;
          description: string;
          main_causes: string[];
          main_symptoms: string[];
          maintenance_tips: string[];
          expected_repair_cost: string;
          related_keywords: string[];
          related_models: string[];
          priority: number;
          view_count: number;
          is_visible: boolean;
          created_by: string | null;
          updated_by: string | null;
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
          car_number: string | null;
          author_id: string | null;
          author_nickname: string | null;
          title: string | null;
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
          login_provider: string | null;
          email: string | null;
          provider_profile_name: string | null;
          provider_avatar_url: string | null;
          provider_user_id: string | null;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      sync_current_user_auth_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["user_profiles"]["Row"];
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
      record_page_view: {
        Args: {
          target_vehicle_id?: string | null;
          target_review_id?: string | null;
          view_session_id?: string;
          view_ip_hash?: string | null;
          view_user_agent?: string | null;
          view_device_type?: "mobile" | "desktop" | "tablet" | "unknown";
          view_browser?: string;
          view_os?: string;
          view_referrer?: string | null;
          view_path?: string | null;
          view_event_type?: "page_view" | "vehicle_view" | "review_view";
        };
        Returns: boolean;
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
      admin_upsert_knowledge_term: {
        Args: {
          target_term_id?: string | null;
          next_category?: string;
          next_representative_name?: string;
          next_slug?: string;
          next_description?: string;
          next_main_causes?: string[];
          next_main_symptoms?: string[];
          next_maintenance_tips?: string[];
          next_expected_repair_cost?: string;
          next_related_keywords?: string[];
          next_related_models?: string[];
          next_priority?: number;
          next_is_visible?: boolean;
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
      toggle_review_helpful: {
        Args: {
          target_review_id: string;
        };
        Returns: {
          is_voted: boolean;
          helpful_count: number;
        }[];
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
