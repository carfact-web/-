"use client";

import { useState } from "react";
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
const maxOverviewKeywordCount = 5;
const defaultMaintenanceIssueCount = 3;

const formatAnalysisSubject = (analysis: StructuredAiSummary) => {
  const subject = analysis.vehicle.generation || analysis.vehicle.modelName;

  return subject.replace(/\s+\(/g, "(").trim();
};

const getFocusedReviewKeywordLabels = (keywords: ReviewKeywordStat[]) =>
  keywords.slice(0, 3).map((keyword) => keyword.label);

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

const getOverviewMessage = (subject: string, keywords: ReviewKeywordStat[]) => {
  const keywordLabels = keywords
    .slice(0, maxOverviewKeywordCount)
    .map((keyword) => "#" + keyword.label);

  if (keywordLabels.length === 0) {
    return (
      subject +
      "는 현재 등록된 후기 기준으로 반복적으로 언급되는 주요 이슈가 아직 없습니다."
    );
  }

  return (
    subject +
    "는 " +
    keywordLabels.join(" ") +
    " 키워드가 주로 언급되고 있습니다."
  );
};

export function AiSummaryCard({
  analysis,
  focusedReviewKeywords = [],
  summaries,
  title = "카팩트 AI 분석",
  emptyMessage = "차량 정보를 입력하면 AI 요약이 표시됩니다.",
}: AiSummaryCardProps) {
  const [showAllMaintenanceIssues, setShowAllMaintenanceIssues] =
    useState(false);

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
  const plateNumber = normalizeVehiclePlateNumber(
    analysis.vehicle.vehicleNumber ?? "",
  );
  const analysisSubject = formatAnalysisSubject(analysis);
  const overviewMessage = getOverviewMessage(
    analysisSubject,
    analysis.reviewKeywords,
  );
  const maintenanceIssues = analysis.maintenanceIssues;
  const hiddenMaintenanceIssueCount = Math.max(
    maintenanceIssues.length - defaultMaintenanceIssueCount,
    0,
  );
  const visibleMaintenanceIssues = showAllMaintenanceIssues
    ? maintenanceIssues
    : maintenanceIssues.slice(0, defaultMaintenanceIssueCount);

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
        <h3 className={sectionTitleClassName}>차종 전체 요약</h3>
        <div className={overviewClassName}>
          <p>{overviewMessage}</p>
        </div>
      </section>

      <section className={focusReviewCardClassName}>
        <h3 className={sectionTitleClassName}>조회 차량번호 요약</h3>
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

      {maintenanceIssues.length > 0 ? (
        <section className={sectionClassName}>
          <h3 className={sectionTitleClassName}>자주 발생하는 정비 이슈</h3>
          <div className="grid gap-2.5">
            {visibleMaintenanceIssues.map((issue, index) => (
              <article
                key={issue.title + "-" + index}
                className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-xs font-black text-red-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-black text-zinc-100">
                      {issue.title}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-zinc-400 sm:text-sm">
                      {issue.description}
                    </p>
                    <p className="mt-2 text-xs font-black text-red-200/90">
                      💰 예상수리비 {issue.estimatedRepairCost}
                    </p>
                    <details className="mt-2 group">
                      <summary className="cursor-pointer list-none text-xs font-black text-blue-200 transition group-open:text-blue-100">
                        자세히 보기
                      </summary>
                      <div className="mt-2 grid gap-1.5 text-xs font-semibold leading-5 text-zinc-400">
                        {issue.symptoms.length > 0 ? (
                          <p>주요 증상: {issue.symptoms.join(", ")}</p>
                        ) : null}
                        {issue.causes.length > 0 ? (
                          <p>원인: {issue.causes.join(", ")}</p>
                        ) : null}
                        {issue.replacementParts.length > 0 ? (
                          <p>교체 부품: {issue.replacementParts.join(", ")}</p>
                        ) : null}
                        {issue.additionalDescription ? (
                          <p>{issue.additionalDescription}</p>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {hiddenMaintenanceIssueCount > 0 ? (
            <button
              type="button"
              className="mt-3 min-h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-black text-zinc-200 transition hover:border-white/[0.16] hover:bg-white/[0.07]"
              onClick={() =>
                setShowAllMaintenanceIssues((current) => !current)
              }
            >
              {showAllMaintenanceIssues
                ? "접기"
                : "더보기 (" + hiddenMaintenanceIssueCount + ")"}
            </button>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
