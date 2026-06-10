import { cn } from "@/utils/cn";
import type { StructuredAiSummary } from "@/utils/aiSummary";

interface AiSummaryCardProps {
  analysis?: StructuredAiSummary;
  summaries: string[];
  title?: string;
  emptyMessage?: string;
}

const cardClassName = cn("mb-6 rounded-xl bg-zinc-800 p-5");
const titleClassName = cn("mb-4 text-2xl font-bold text-red-400");
const sectionClassName = cn("rounded-xl border border-zinc-700/70 bg-zinc-900/45 p-4");
const sectionTitleClassName = cn("mb-2 text-base font-bold text-gray-100");
const bodyTextClassName = cn("text-sm leading-[1.75] text-gray-300");
const bulletListClassName = cn("space-y-2 text-sm leading-[1.65] text-gray-300");
const conclusionClassName = cn(
  "rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-semibold leading-[1.7] text-red-100",
);

export function AiSummaryCard({
  analysis,
  summaries,
  title = "카팩트 AI 분석",
  emptyMessage = "차량 정보를 입력하면 AI 분석이 표시됩니다.",
}: AiSummaryCardProps) {
  return (
    <div className={cardClassName}>
      <h2 className={titleClassName}>{title}</h2>

      {analysis ? (
        <div className="space-y-4">
          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>1. 현재 주행거리 기준 요약</h3>
            <p className={bodyTextClassName}>{analysis.mileageSummary}</p>
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>2. 이 차종 주요 확인 이슈</h3>
            <ul className={bulletListClassName}>
              {analysis.modelIssues.map((issue, index) => (
                <li key={index}>- {issue}</li>
              ))}
            </ul>
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>3. 방문 시 확인할 체크포인트</h3>
            <ul className={bulletListClassName}>
              {analysis.checkPoints.map((checkPoint, index) => (
                <li key={index}>- {checkPoint}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className={sectionTitleClassName}>4. 구매 전 한 줄 결론</h3>
            <p className={conclusionClassName}>{analysis.conclusion}</p>
          </section>
        </div>
      ) : (
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
      )}
    </div>
  );
}
