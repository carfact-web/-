export type WebtoonWork = { id: string; title: string; description: string; cover_asset_id: string | null; published: boolean; version: number; created_at: string; updated_at: string; }
export type WebtoonEpisode = { content_type: "images" | "pdf"; pdf_asset_id: string | null; id: string; work_id: string; title: string; number: number; published: boolean; version: number; created_at: string; updated_at: string; }
export type WebtoonAsset = { id: string; work_id: string; object_key: string; mime: string; width: number | null; height: number | null; page_count: number | null; page_sizes: { width: number; height: number }[] | null; bytes: number; state: "uploading" | "ready" | "deleting"; created_at: string; }
export type WebtoonPage = { episode_id: string; asset_id: string; position: number; }
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: []; };
export interface WebtoonTables { webtoon_works: Table<WebtoonWork>; webtoon_episodes: Table<WebtoonEpisode>; webtoon_assets: Table<WebtoonAsset>; webtoon_episode_pages: Table<WebtoonPage>; }
export interface WebtoonFunctions {
 webtoon_save_work: { Args: { p_id: string; p_version: number; p_title: string; p_description: string; p_cover: string | null; p_published: boolean }; Returns: WebtoonWork };
 webtoon_save_episode: { Args: { p_id: string; p_version: number; p_title: string; p_number: number; p_published: boolean; p_assets: string[]; p_type?: string; p_pdf?: string | null }; Returns: WebtoonEpisode };
 webtoon_claim_orphans: { Args: { p_work: string }; Returns: WebtoonAsset[] };
}
export type WebtoonEpisodeEditor = WebtoonEpisode & { page_ids: string[] };
