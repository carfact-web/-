import type { PromotionSettings } from "@/lib/webtoons/promotion";
export type WebtoonWork = { id: string; title: string; description: string; cover_asset_id: string | null; published: boolean; version: number; created_at: string; updated_at: string; }
export type WebtoonEpisode = { cover_asset_id: string|null; published_at: string | null; content_type: "images" | "pdf"; pdf_asset_id: string | null; id: string; work_id: string; title: string; number: number; published: boolean; version: number; created_at: string; updated_at: string; }
export type WebtoonAsset = { id: string; work_id: string; object_key: string; mime: string; width: number | null; height: number | null; page_count: number | null; page_sizes: { width: number; height: number }[] | null; bytes: number; state: "uploading" | "ready" | "deleting"; created_at: string; }
export type WebtoonPage = { episode_id: string; asset_id: string; position: number; }
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: []; };
export interface WebtoonTables { webtoon_upload_drafts: Table<WebtoonUploadDraft>; webtoon_promotion: Table<PromotionSettings>; webtoon_works: Table<WebtoonWork>; webtoon_episodes: Table<WebtoonEpisode>; webtoon_assets: Table<WebtoonAsset>; webtoon_episode_pages: Table<WebtoonPage>; }
export interface WebtoonFunctions {
 webtoon_start_edit: { Args:{p_id:string;p_owner:string;p_episode:string}; Returns:WebtoonUploadDraft };
 webtoon_commit_edit: { Args:{p_id:string;p_owner:string;p_version:number;p_title:string;p_published:boolean;p_popup:boolean;p_message:string;p_start:string|null;p_end:string|null}; Returns:WebtoonUploadDraft };
 webtoon_cancel_upload: { Args:{p_id:string;p_owner:string}; Returns:WebtoonAsset[] };
 webtoon_start_upload: { Args: {p_id:string;p_owner:string;p_work?:string|null;p_number?:number|null}; Returns:WebtoonUploadDraft };
 webtoon_publish_upload: { Args: {p_id:string;p_owner:string;p_version:number;p_title:string;p_popup:boolean;p_message:string;p_start:string|null;p_end:string|null;p_promotion_version:number}; Returns:WebtoonUploadDraft };
 webtoon_promotion_payload: { Args: Record<string, never>; Returns: import("./supabase").Json };
 webtoon_promotion_card: { Args: { p_id: string }; Returns: import("./supabase").Json };
 webtoon_save_work: { Args: { p_id: string; p_version: number; p_title: string; p_description: string; p_cover: string | null; p_published: boolean }; Returns: WebtoonWork };
 webtoon_save_episode: { Args: { p_id: string; p_version: number; p_title: string; p_number: number; p_published: boolean; p_assets: string[]; p_type?: string; p_pdf?: string | null }; Returns: WebtoonEpisode };
 webtoon_claim_orphans: { Args: { p_work: string }; Returns: WebtoonAsset[] };
}
export type WebtoonEpisodeEditor = WebtoonEpisode & { page_ids: string[] };

export type WebtoonUploadDraft = { mode: "create"|"edit"; baseline: import("./supabase").Json; id: string; owner_id: string; work_id: string; episode_id: string; owns_work: boolean; status: "editing" | "published" | "cancelled"; data: import("./supabase").Json; version: number; created_at: string; updated_at: string; };
