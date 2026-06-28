"use client";

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
const keywordListClassName = cn("grid grid-cols-2 gap-2 sm:grid-cols-3");
const keywordTagClassName = cn(
  "flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm font-black text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
);
const focusReviewCardClassName = cn(
  "my-3 rounded-2xl border border-red-400/25 bg-[linear-gradient(135deg,rgba(127,29,29,0.54),rgba(24,24,27,0.94))] p-4 shadow-[0_18px_42px_rgba(127,29,29,0.26),inset_0_1px_0_rgba(255,255,255,0.08)]",
);
const focusReviewTitleClassName = cn(
  "mb-3 text-[15px] font-black tracking-normal text-white",
);
const focusKeywordListClassName = cn("mb-3 flex flex-wrap gap-2");
const focusKeywordClassName = cn(
  "rounded-full border border-red-200/25 bg-black/28 px-3 py-1.5 text-xs font-black text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:text-sm",
);
const maintenancePillListClassName = cn("flex flex-wrap gap-2");
const maintenancePillClassName = cn(
  "rounded-full border border-white/[0.12] bg-zinc-950 px-3 py-1.5 text-xs font-black text-zinc-200 transition hover:border-red-400/70 hover:bg-red-500/12 hover:text-red-100 sm:text-sm",
);
const maxMaintenancePillCount = 12;

const getKeywordIcon = (label: string) => {
  if (/냉각|워터|서모|써모/.test(label)) {
    return "🔥";
  }

  if (/누유|누수|오일/.test(label)) {
    return "⚠️";
  }

  if (/하체|타이어|쇼바|로어암|부싱|브레이크/.test(label)) {
    return "🛞";
  }

  return "🔧";
};

const getFocusedReviewKeywords = (analysis: StructuredAiSummary) =>
  analysis.reviewKeywords.slice(0, 3).map((keyword) => keyword.label);

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

export function AiSummaryCard({
  analysis,
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

  const focusedReviewKeywords = getFocusedReviewKeywords(analysis);
  const maintenancePillLabels = getMaintenancePillLabels(analysis);

  return (
    <section className={cardClassName} aria-labelledby="ai-summary-title">
      <div className={headerClassName}>
        <div className="min-w-0">
          <h2 id="ai-summary-title" className={titleClassName}>
            {title}
          </h2>
          <p className={metaClassName}>{analysis.reviewAnalysisLabel}</p>
        </div>
      </div>

      <section className={sectionClassName}>
        <div className={overviewClassName}>
          <p>{analysis.overviewSentences[0]}</p>
        </div>
      </section>

      <section className={sectionClassName}>
        <h3 className={sectionTitleClassName}>많이 언급된 키워드</h3>
        {analysis.reviewKeywords.length > 0 ? (
          <ul className={keywordListClassName}>
            {analysis.reviewKeywords.map((keyword) => (
              <li key={keyword.label} className={keywordTagClassName}>
                <span>
                  {getKeywordIcon(keyword.label)} {keyword.label}
                </span>
                <span className="text-xs text-zinc-400">({keyword.count})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            후기가 쌓이면 많이 언급된 항목부터 표시됩니다.
          </p>
        )}
      </section>

      <section className={focusReviewCardClassName}>
        <h3 className={focusReviewTitleClassName}>🔍 조회 차량 후기 기준</h3>
        {focusedReviewKeywords.length > 0 ? (
          <>
            <div className={focusKeywordListClassName}>
              {focusedReviewKeywords.map((keyword) => (
                <span key={keyword} className={focusKeywordClassName}>
                  {keyword}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold leading-6 text-red-50/90">
              이 차량에서는 위 항목과 관련된 후기가 등록되어 있습니다.
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-red-100/70">
              자세한 내용은 아래 실제 후기를 참고하세요.
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold leading-6 text-red-100/75">
            아직 반복적으로 확인된 후기 항목은 없습니다. 아래 실제 후기를 함께 확인해 주세요.
          </p>
        )}
      </section>

      <section className="border-t border-zinc-800/80 pt-3">
        <h3 className={sectionTitleClassName}>자주 발생하는 정비 항목</h3>
        {maintenancePillLabels.length > 0 ? (
          <div className={maintenancePillListClassName}>
            {maintenancePillLabels.map((label) => (
              <span key={label} className={maintenancePillClassName}>
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-zinc-500">
            자주 확인되는 정비 항목이 생기면 해시태그 형태로 표시됩니다.
          </p>
        )}
      </section>
    </section>
  );
}
