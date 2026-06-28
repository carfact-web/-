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

export const minimumReviewsForKeywordStats = 10;

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
): ReviewKeywordStat[] => {
  if (reviews.length < minimumReviewCount) {
    return [];
  }

  const reviewKeywordLabels = reviews.map((review) =>
    extractVehicleIssueKeywords(getReviewSearchText(review)),
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
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ko"));

  return stats.slice(0, limit);
};
