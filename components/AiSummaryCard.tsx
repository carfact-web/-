"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import type { StructuredAiSummary } from "@/utils/aiSummary";

interface AiSummaryCardProps {
  analysis?: StructuredAiSummary;
  summaries: string[];
  title?: string;
  emptyMessage?: string;
}

const cardClassName = cn(
  "mb-5 rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,#15171c_0%,#090a0d_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5",
);
const headerClassName = cn("mb-3 flex items-start justify-between gap-3");
const titleClassName = cn("text-lg font-black tracking-normal text-white sm:text-xl");
const metaClassName = cn(
  "mt-1 line-clamp-1 text-xs font-medium text-zinc-500 sm:text-sm",
);
const sourceClassName = cn(
  "shrink-0 rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
);
const sectionClassName = cn("border-t border-white/[0.07] py-3 first:border-t-0 first:pt-0");
const sectionTitleClassName = cn(
  "mb-2 text-[13px] font-black tracking-normal text-zinc-100",
);
const overviewClassName = cn(
  "space-y-2 text-[15px] font-semibold leading-[1.75] text-zinc-100 sm:text-base",
);
const analysisLabelClassName = cn(
  "mt-2 text-xs font-medium leading-5 text-zinc-500 sm:text-sm",
);
const bulletListClassName = cn("space-y-1.5 text-sm font-semibold leading-6 text-zinc-200");
const keywordListClassName = cn("flex flex-wrap gap-1.5");
const keywordTagClassName = cn(
  "rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:text-sm",
);
const issueListClassName = cn("space-y-2");
const issueClassName = cn(
  "rounded-xl border border-white/[0.07] bg-black/20 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
);
const issueToggleButtonClassName = cn(
  "mt-3 inline-flex w-full items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm font-black text-zinc-200 transition hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.99]",
);
const defaultVisibleMaintenanceIssueCount = 3;

const formatMileage = (mileage?: string) => {
  if (!mileage) {
    return "";
  }

  const mileageNumber = Number(mileage);

  if (!Number.isFinite(mileageNumber)) {
    return mileage;
  }

  return mileageNumber.toLocaleString("ko-KR") + "km";
};

const getSourceLabel = (source: StructuredAiSummary["source"]) => {
  if (source === "product-api") {
    return "차량 DB";
  }

  if (source === "vehicle-number") {
    return "데이터 분석";
  }

  return "DB 기반";
};

const getReviewMentionLabel = (score: number | null) => {
  if (!score) {
    return "데이터 부족";
  }

  return "★".repeat(score) + "☆".repeat(5 - score);
};

export function AiSummaryCard({
  analysis,
  summaries,
  title = "카팩트 AI 개요",
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

  const vehicleMeta = [
    analysis.vehicle.year && analysis.vehicle.year + "년식",
    formatMileage(analysis.vehicle.mileage),
    analysis.vehicle.fuelType,
    analysis.vehicle.grade,
  ].filter(Boolean);
  const vehicleTitle = [
    analysis.vehicle.brand,
    analysis.vehicle.modelName,
    analysis.vehicle.generation,
  ]
    .filter(Boolean)
    .join(" ");
  const hiddenMaintenanceIssueCount = Math.max(
    analysis.maintenanceIssues.length - defaultVisibleMaintenanceIssueCount,
    0,
  );
  const visibleMaintenanceIssues = showAllMaintenanceIssues
    ? analysis.maintenanceIssues
    : analysis.maintenanceIssues.slice(0, defaultVisibleMaintenanceIssueCount);

  return (
    <section className={cardClassName} aria-labelledby="ai-summary-title">
      <div className={headerClassName}>
        <div className="min-w-0">
          <h2 id="ai-summary-title" className={titleClassName}>
            {title}
          </h2>
          <p className={metaClassName}>
            {[vehicleTitle, ...vehicleMeta].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={sourceClassName}>{getSourceLabel(analysis.source)}</span>
      </div>

      <section className={sectionClassName}>
        <div className={overviewClassName}>
          {analysis.overviewSentences.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
        <p className={analysisLabelClassName}>{analysis.reviewAnalysisLabel}</p>
      </section>

      <section className={sectionClassName}>
        <h3 className={sectionTitleClassName}>대표 정비 이슈</h3>
        {analysis.representativeIssues.length > 0 ? (
          <ul className={bulletListClassName}>
            {analysis.representativeIssues.map((issue) => (
              <li key={issue} className="flex gap-2">
                <span className="text-zinc-500">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            현재 세대 기준으로 등록된 대표 정비 이슈가 아직 없습니다.
          </p>
        )}
      </section>

      <section className={sectionClassName}>
        <h3 className={sectionTitleClassName}>사람들이 많이 언급한 키워드</h3>
        {analysis.reviewKeywords.length > 0 ? (
          <ul className={keywordListClassName}>
            {analysis.reviewKeywords.map((keyword) => (
              <li key={keyword.label} className={keywordTagClassName}>
                {keyword.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            후기 키워드가 더 쌓이면 많이 언급된 명사부터 표시됩니다.
          </p>
        )}
      </section>

      <section className="border-t border-zinc-800/80 pt-3">
        <h3 className={sectionTitleClassName}>자주 발생하는 정비 항목</h3>
        {analysis.maintenanceIssues.length > 0 ? (
          <div>
            <div className={issueListClassName}>
              {visibleMaintenanceIssues.map((issue, index) => (
                <article key={issue.title + index} className={issueClassName}>
                  <h4 className="line-clamp-1 text-sm font-black text-white">
                    {issue.title}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-zinc-400">
                    {issue.description}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-bold leading-5">
                    <dt className="text-zinc-500">후기 언급도</dt>
                    <dd className="text-zinc-200">
                      {getReviewMentionLabel(issue.reviewMentionScore)}
                    </dd>
                    <dt className="text-zinc-500">예상수리비</dt>
                    <dd className="text-zinc-200">{issue.estimatedRepairCost}</dd>
                  </dl>
                </article>
              ))}
            </div>
            {hiddenMaintenanceIssueCount > 0 ? (
              <button
                type="button"
                className={issueToggleButtonClassName}
                onClick={() =>
                  setShowAllMaintenanceIssues((currentValue) => !currentValue)
                }
                aria-expanded={showAllMaintenanceIssues}
              >
                {showAllMaintenanceIssues
                  ? "▲ 접기"
                  : "▼ 더보기 (" + hiddenMaintenanceIssueCount + ")"}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            등록된 대표 정비 이슈가 아직 없습니다.
          </p>
        )}
      </section>
    </section>
  );
}
