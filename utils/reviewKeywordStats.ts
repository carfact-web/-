import type { Review } from "@/types/review";
import {
  extractVehicleIssueKeywords,
  getGroupedVehicleIssueKeywordDefinitions,
} from "@/utils/vehicleIssueKeywords";

export interface ReviewKeywordDefinition {
  label: string;
  aliases: string[];
}

export interface ReviewKeywordStat {
  label: string;
  count: number;
  percentage: number;
}

interface ReviewKeywordStatsOptions {
  fuelType?: string;
}

export const minimumReviewsForKeywordStats = 10;

const dieselOnlyKeywordLabels = new Set([
  "DPF",
  "SCR",
  "고압펌프",
  "EGR",
  "매연",
  "촉매",
]);

const dieselKeywordPriority = new Map(
  ["DPF", "EGR", "인젝터", "고압펌프", "매연", "촉매", "SCR"].map(
    (label, index) => [label, index],
  ),
);

const hasDieselFuelType = (fuelType?: string) =>
  /디젤|경유|diesel/i.test(fuelType ?? "");

export const reviewKeywordDefinitions: ReviewKeywordDefinition[] = [
  ...getGroupedVehicleIssueKeywordDefinitions().map((definition) => ({
    label: definition.label,
    aliases: definition.aliases,
  })),
];

const getReviewSearchText = (review: Review) => review.content;

export const getReviewKeywordStatsSummary = (
  modelName: string,
  stats: ReviewKeywordStat[],
) => {
  if (stats.length === 0) {
    return "";
  }

  const visibleLabels = stats.slice(0, 3).map((stat) => stat.label);
  const subject = modelName.trim() || "이 차량";

  return subject + " 후기에서 " + visibleLabels.join(", ") + "이 자주 언급되고 있어요.";
};

export const getReviewKeywordStats = (
  reviews: Review[],
  limit = 5,
  minimumReviewCount = minimumReviewsForKeywordStats,
  options: ReviewKeywordStatsOptions = {},
): ReviewKeywordStat[] => {
  if (reviews.length < minimumReviewCount) {
    return [];
  }

  const isDieselVehicle = hasDieselFuelType(options.fuelType);
  const reviewKeywordLabels = reviews.map((review) =>
    extractVehicleIssueKeywords(getReviewSearchText(review)).filter(
      (keyword) => isDieselVehicle || !dieselOnlyKeywordLabels.has(keyword),
    ),
  );
  const stats = reviewKeywordDefinitions
    .map((definition) => {
      const count = reviewKeywordLabels.reduce((total, keywordLabels) => {
        const hasKeyword = keywordLabels.includes(definition.label);

        return hasKeyword ? total + 1 : total;
      }, 0);

      return {
        label: definition.label,
        count,
        percentage: Math.round((count / reviews.length) * 100),
      };
    })
    .filter((stat) => stat.count > 0)
    .sort((left, right) => {
      const leftDieselPriority = isDieselVehicle
        ? (dieselKeywordPriority.get(left.label) ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
      const rightDieselPriority = isDieselVehicle
        ? (dieselKeywordPriority.get(right.label) ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;

      return (
        right.count - left.count ||
        leftDieselPriority - rightDieselPriority ||
        left.label.localeCompare(right.label, "ko")
      );
    });

  return stats.slice(0, limit);
};
