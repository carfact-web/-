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
  "mb-5 rounded-2xl border border-white/[0.09] bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#16181d_0%,#0b0c10_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.07)] transition duration-200 sm:p-5 md:hover:-translate-y-[2px]",
);
const headerClassName = cn("mb-3 flex items-start justify-between gap-3");
const titleClassName = cn("text-lg font-black tracking-normal text-white sm:text-xl");
const metaClassName = cn(
  "mt-1 line-clamp-1 text-xs font-medium text-zinc-500 sm:text-sm",
);
const sourceClassName = cn(
  "shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-black text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
);
const sectionClassName = cn("border-t border-white/[0.07] py-3 first:border-t-0 first:pt-0");
const sectionTitleClassName = cn(
  "mb-2 text-[13px] font-black tracking-[-0.01em] text-zinc-100",
);
const oneLineClassName = cn(
  "rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,59,48,0.14),rgba(255,59,48,0.07))] px-3.5 py-3 text-[15px] font-bold leading-[1.55] text-red-50 shadow-[0_10px_24px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.05)] sm:text-base",
);
const compactListClassName = cn("grid grid-cols-1 gap-1.5 sm:grid-cols-2");
const compactItemClassName = cn(
  "flex min-h-8 items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm font-semibold leading-5 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
);
const issueListClassName = cn("space-y-2");
const issueClassName = cn(
  "rounded-xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(18,20,25,0.86),rgba(5,6,8,0.72))] px-3.5 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 md:hover:-translate-y-0.5 md:hover:border-white/[0.12]",
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
    return "상품 API";
  }

  if (source === "vehicle-number") {
    return "차량번호";
  }

  return "AI";
};

export function AiSummaryCard({
  analysis,
  summaries,
  title = "카팩트 AI 요약",
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
        <h3 className={sectionTitleClassName}>💡 카팩트 한줄평</h3>
        <p className={oneLineClassName}>{analysis.oneLineReview}</p>
      </section>

      <section className={sectionClassName}>
        <h3 className={sectionTitleClassName}>🔥 사람들이 많이 이야기한 내용</h3>
        {analysis.reviewKeywords.length > 0 ? (
          <ul className={compactListClassName}>
            {analysis.reviewKeywords.map((keyword) => (
              <li key={keyword.label} className={compactItemClassName}>
                <span className="text-red-300">•</span>
                <span className="line-clamp-1">{keyword.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            후기 키워드가 쌓이면 많이 언급된 내용부터 자동 정렬됩니다.
          </p>
        )}
      </section>

      <section className="border-t border-zinc-800/80 pt-3">
        <h3 className={sectionTitleClassName}>🚨 자주 발생하는 정비 이슈</h3>
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
                  <p className="mt-1 text-xs font-bold text-red-100">
                    💰 예상수리비 {issue.estimatedRepairCost}
                  </p>
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
