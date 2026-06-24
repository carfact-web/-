import type { Review } from "@/types/review";
import { vehicleIssueKeywordDefinitions } from "@/utils/vehicleIssueKeywords";

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
  ...vehicleIssueKeywordDefinitions.map((definition) => ({
    label: definition.label,
    aliases: definition.aliases,
  })),
];

const normalizeKeywordText = (value: string) =>
  value.toLowerCase().replace(/[^0-9a-zㄱ-ㅎ가-힣]+/g, "");

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
): ReviewKeywordStat[] => {
  if (reviews.length < minimumReviewsForKeywordStats) {
    return [];
  }

  const stats = reviewKeywordDefinitions
    .map((definition) => {
      const aliases = definition.aliases.map(normalizeKeywordText);
      const count = reviews.reduce((total, review) => {
        const normalizedReview = normalizeKeywordText(getReviewSearchText(review));
        const hasKeyword = aliases.some((alias) =>
          normalizedReview.includes(alias),
        );

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
