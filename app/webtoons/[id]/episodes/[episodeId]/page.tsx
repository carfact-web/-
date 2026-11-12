import { PublicWebtoons } from "@/components/webtoons/PublicWebtoons";
export default async function Page({ params }: { params: Promise<{ id: string; episodeId: string }> }) { const { id, episodeId } = await params; return <PublicWebtoons key={episodeId} workId={id} episodeId={episodeId} />; }
