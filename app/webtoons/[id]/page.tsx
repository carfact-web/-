import { PublicWebtoons } from "@/components/webtoons/PublicWebtoons";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PublicWebtoons key={id} workId={id} />; }
