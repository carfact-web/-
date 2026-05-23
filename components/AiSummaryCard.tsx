import { cn } from "@/utils/cn";

interface AiSummaryCardProps {
  summaries: string[];
  title?: string;
  emptyMessage?: string;
}

const cardClassName = cn("mb-6 rounded-xl bg-zinc-800 p-5");
const titleClassName = cn("mb-4 text-2xl font-bold text-red-400");

export function AiSummaryCard({
  summaries,
  title = "카팩트 AI 분석",
  emptyMessage = "차량 정보를 입력하면 AI 분석이 표시됩니다.",
}: AiSummaryCardProps) {
  return (
    <div className={cardClassName}>
      <h2 className={titleClassName}>{title}</h2>

      <div className="space-y-2">
        {summaries.length === 0 ? (
          <p className="text-gray-400">{emptyMessage}</p>
        ) : (
          summaries.map((summary, index) => (
            <p key={index} className="text-gray-200">
              • {summary}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
