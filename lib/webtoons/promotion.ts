export interface PromotionCard {
 episodeId: string; workId: string; workTitle: string; episodeTitle: string;
 description: string; publishedAt: string; contentType: "images" | "pdf"; coverUrl: string; href: string;
}
export type PromotionSettings = {
 id: number; episode_id: string | null; message: string; starts_at: string | null;
 ends_at: string | null; enabled: boolean; version: number; updated_at: string;
}
export interface PromotionPayload {
 serverNow: string; latest: PromotionCard | null;
 popup: { version: number; message: string; startsAt: string; endsAt: string; card: PromotionCard } | null;
}
export function koreanDay(time: number = Date.now()) {
 return new Date(time + 9 * 3600000).toISOString().slice(0, 10);
}
export function koreanInput(iso: string | null) {
 return iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 16) : "";
}
