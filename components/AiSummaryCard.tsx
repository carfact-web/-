"use client";

import { cn } from "@/utils/cn";
import type { StructuredAiSummary } from "@/utils/aiSummary";
import type { ReviewKeywordStat } from "@/utils/reviewKeywordStats";
import { normalizeVehiclePlateNumber } from "@/utils/vehiclePlateValidation";

interface AiSummaryCardProps {
  analysis?: StructuredAiSummary;
  focusedReviewCount?: number;
  focusedReviewKeywords?: ReviewKeywordStat[];
  summaries: string[];
  title?: string;
  emptyMessage?: string;
}

const cardClassName = cn(
  "mb-5 rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,#15171c_0%,#090a0d_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5",
);
const headerClassName = cn("mb-4");
const titleClassName = cn("text-lg font-black tracking-normal text-white sm:text-xl");
const metaClassName = cn(
  "mt-1 text-xs font-bold text-red-200/80 sm:text-sm",
);
const sectionClassName = cn("border-t border-white/[0.07] py-3 first:border-t-0 first:pt-0");
const sectionTitleClassName = cn(
  "mb-2 text-[13px] font-black tracking-normal text-zinc-100",
);
const overviewClassName = cn(
  "text-sm font-semibold leading-6 text-zinc-300 sm:text-[15px]",
);
const keywordListClassName = cn("flex flex-wrap gap-2");
const keywordTagClassName = cn(
  "rounded-full border border-[rgba(150,220,255,0.25)] bg-[rgba(150,220,255,0.10)] px-3 py-1.5 text-sm font-black text-[#b9e8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
);
const focusReviewCardClassName = cn(
  "my-3 rounded-2xl border border-blue-400/25 bg-[rgba(45,105,255,0.10)] p-4 text-left shadow-[0_0_18px_rgba(80,140,255,0.10),inset_0_1px_0_rgba(255,255,255,0.07)]",
);
const compactPlateFrameClassName = cn(
  "plate-input-frame w-[170px] max-w-full bg-white sm:w-[220px]",
);
const compactPlateNumberClassName = cn(
  "plate-number-input flex items-center justify-center whitespace-nowrap",
);
const maintenancePillListClassName = cn("flex flex-wrap gap-2");
const maintenancePillClassName = cn(
  "rounded-full border border-white/[0.12] bg-zinc-950 px-3 py-1.5 text-xs font-black text-zinc-200 transition hover:border-red-400/70 hover:bg-red-500/12 hover:text-red-100 sm:text-sm",
);
const maxMaintenancePillCount = 12;

const formatAnalysisSubject = (analysis: StructuredAiSummary) => {
  const subject = analysis.vehicle.generation || analysis.vehicle.modelName;

  return subject.replace(/\s+\(/g, "(").trim();
};

const getFocusedReviewKeywordLabels = (keywords: ReviewKeywordStat[]) =>
  keywords.slice(0, 3).map((keyword) => keyword.label);

const normalizeMaintenancePillLabel = (label: string) =>
  label.replace(/\s*점검$/, "").trim();

const getMaintenancePillLabels = (analysis: StructuredAiSummary) => {
  const labels = analysis.maintenanceIssues.flatMap((issue) =>
    issue.replacementParts.length > 0
      ? issue.replacementParts
      : [normalizeMaintenancePillLabel(issue.title)],
  );
  const uniqueLabels = Array.from(
    new Set(labels.map(normalizeMaintenancePillLabel).filter(Boolean)),
  );

  return uniqueLabels.slice(0, maxMaintenancePillCount);
};

const getAnalysisLabel = (analysis: StructuredAiSummary) => {
  const analysisSubject = formatAnalysisSubject(analysis);
  const reviewCount = analysis.reviewAnalysisLabel.match(/(\d[\d,]*)건/)?.[1];

  return [
    analysisSubject,
    reviewCount ? "후기 " + reviewCount + "건 분석 결과" : "후기 분석 결과",
  ]
    .filter(Boolean)
    .join(" ");
};

const getFocusedReviewMessage = (keywordLabels: string[]) => {
  if (keywordLabels.length === 0) {
    return "현재 등록된 후기에서는 특별한 문제점이 확인되지 않았습니다. 😊";
  }

  return "이 차량에서는 " + keywordLabels.join(", ") + " 관련 언급이 확인되었습니다.";
};

const getOverviewMessage = (keywords: ReviewKeywordStat[]) => {
  if (keywords.length === 0) {
    return "현재 해당 차종은 반복적으로 언급되는 이슈가 아직 없습니다. 😉";
  }

  const keywordLabels = keywords.map((keyword) => "#" + keyword.label).join(" ");

  return "해당 차종은 " + keywordLabels + " 키워드가 주로 언급되고 있네요 🔎";
};

export function AiSummaryCard({
  analysis,
  focusedReviewKeywords = [],
  summaries,
  title = "카팩트 AI 분석",
  emptyMessage = "차량 정보를 입력하면 AI 요약이 표시됩니다.",
}: AiSummaryCardProps) {
  if (!analysis) {
    return (
      <section className={cardClassName}>
        <h2 className={titleClassName}>{title}</h2>
        <div className="mt-3 space-y-2">
          {summaries.length === 0 ? (
            <p className="text-sm text-zinc-400">{emptyMessage}</p>
          ) : (
            summaries.map((summary, index) => (
              <p key={index} className="text-sm leading-[1.7] text-zinc-200">
                {summary}
              </p>
            ))
          )}
        </div>
      </section>
    );
  }

  const focusedReviewKeywordLabels =
    getFocusedReviewKeywordLabels(focusedReviewKeywords);
  const maintenancePillLabels = getMaintenancePillLabels(analysis);
  const plateNumber = normalizeVehiclePlateNumber(
    analysis.vehicle.vehicleNumber ?? "",
  );
  const overviewMessage = getOverviewMessage(analysis.reviewKeywords);

  return (
    <section className={cardClassName} aria-labelledby="ai-summary-title">
      <div className={headerClassName}>
        <div className="min-w-0">
          <h2 id="ai-summary-title" className={titleClassName}>
            {title}
          </h2>
          <p className={metaClassName}>{getAnalysisLabel(analysis)}</p>
        </div>
      </div>

      <section className={sectionClassName}>
        <div className={overviewClassName}>
          <p>{overviewMessage}</p>
        </div>
      </section>

      {analysis.reviewKeywords.length > 0 ? (
        <section className={sectionClassName}>
          <h3 className={sectionTitleClassName}>많이 언급된 키워드</h3>
          <ul className={keywordListClassName}>
            {analysis.reviewKeywords.map((keyword) => (
              <li key={keyword.label} className={keywordTagClassName}>
                {"#" + keyword.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={focusReviewCardClassName}>
        <div className={compactPlateFrameClassName}>
          <div
            className={compactPlateNumberClassName}
            style={{
              fontSize: "17px",
              height: "40px",
              letterSpacing: "1px",
              padding: "0 28px",
            }}
          >
            {plateNumber || "차량번호"}
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-blue-100/75 sm:text-sm">
          이 차량번호로 등록된 후기를 기준으로 요약했습니다.
        </p>
        {focusedReviewKeywordLabels.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {focusedReviewKeywordLabels.map((keyword) => (
              <span key={keyword} className={keywordTagClassName}>
                {"#" + keyword}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-3 max-w-[360px] text-sm font-semibold leading-6 text-blue-50/90">
          {getFocusedReviewMessage(focusedReviewKeywordLabels)}
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-blue-100/70 sm:text-sm">
          자세한 내용은 아래 실제 후기를 확인해보세요.👇
        </p>
      </section>

      <section className="border-t border-zinc-800/80 pt-3">
        <h3 className={sectionTitleClassName}>
          차종 관련 참고하면 좋은 정비 항목
        </h3>
        {maintenancePillLabels.length > 0 ? (
          <div className={maintenancePillListClassName}>
            {maintenancePillLabels.map((label) => (
              <span key={label} className={maintenancePillClassName}>
                {"#" + label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            자주 확인되는 정비 항목이 아직 없습니다.
          </p>
        )}
      </section>
    </section>
  );
}
