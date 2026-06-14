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
const inspectionGridClassName = cn("mt-4 grid gap-3");
const inspectionItemClassName = cn(
  "rounded-xl border border-zinc-700/70 bg-black/25 p-4",
);
const inspectionMetaClassName = cn(
  "mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400",
);
const conclusionClassName = cn(
  "rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-semibold leading-[1.7] text-red-100",
);

const getImportanceClassName = (importance: "상" | "중" | "하") =>
  cn(
    "rounded-full border px-2.5 py-1 text-xs font-black",
    importance === "상" &&
      "border-red-500/40 bg-red-500/15 text-red-200",
    importance === "중" &&
      "border-amber-400/35 bg-amber-400/10 text-amber-100",
    importance === "하" &&
      "border-zinc-500/40 bg-zinc-700/40 text-zinc-200",
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
            <h3 className={sectionTitleClassName}>현재 주행거리 기준 요약</h3>
            <p className={bodyTextClassName}>{analysis.mileageSummary}</p>
          </section>

          {analysis.inspectionItems.length > 0 && (
            <section className={sectionClassName}>
              <h3 className={sectionTitleClassName}>
                실제 중고차 검수 시 자주 확인되는 항목
              </h3>
              {analysis.inspectionSummary && (
                <p className={bodyTextClassName}>
                  {analysis.inspectionSummary}
                </p>
              )}

              <div className={inspectionGridClassName}>
                {analysis.inspectionItems.map((item) => (
                  <article key={item.title} className={inspectionItemClassName}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="text-sm font-black text-white">
                        {item.title}
                      </h4>
                      <span className={getImportanceClassName(item.importance)}>
                        중요도 {item.importance}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-[1.65] text-zinc-300">
                      {item.aiSummary}
                    </p>

                    <div className={inspectionMetaClassName}>
                      <span>예상 수리비 {item.estimatedRepairCost}</span>
                      <span aria-hidden>·</span>
                      <span>{item.relatedParts.join(", ")}</span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      주요 증상: {item.symptoms.join(" / ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>AI 요약 참고 문구</h3>
            <ul className={bulletListClassName}>
              {analysis.modelIssues.map((issue, index) => (
                <li key={index}>- {issue}</li>
              ))}
            </ul>
          </section>

          <section className={sectionClassName}>
            <h3 className={sectionTitleClassName}>방문 시 확인할 체크포인트</h3>
            <ul className={bulletListClassName}>
              {analysis.checkPoints.map((checkPoint, index) => (
                <li key={index}>- {checkPoint}</li>
              ))}
            </ul>
          </section>

          {(analysis.yearInspectionNotes.length > 0 ||
            analysis.engineInspectionNotes.length > 0) && (
            <section className={sectionClassName}>
              <h3 className={sectionTitleClassName}>연식 및 엔진별 참고</h3>
              <div className="space-y-3">
                {analysis.yearInspectionNotes.map((note) => (
                  <p key={note.label} className={bodyTextClassName}>
                    <span className="font-bold text-zinc-100">
                      {note.label}
                    </span>
                    : {note.summary}
                  </p>
                ))}

                {analysis.engineInspectionNotes.map((note) => (
                  <p key={note.engine} className={bodyTextClassName}>
                    <span className="font-bold text-zinc-100">
                      {note.engine}
                    </span>
                    : {note.summary}
                  </p>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className={sectionTitleClassName}>구매 전 한 줄 결론</h3>
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
