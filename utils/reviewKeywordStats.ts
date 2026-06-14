import type { Review } from "@/types/review";

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
  {
    label: "냉간시동 소음",
    aliases: ["냉간시동", "냉간 소음", "냉간소음", "시동소음", "시동 소음"],
  },
  {
    label: "냉각계통 문제",
    aliases: [
      "냉각수",
      "냉각수 감소",
      "냉각수감소",
      "냉각수 누수",
      "냉각수누수",
      "워터펌프",
      "서모스탯",
    ],
  },
  {
    label: "미션 충격",
    aliases: ["미션충격", "미션 충격", "변속충격", "변속 충격", "저속 울컥"],
  },
  {
    label: "하체 소음",
    aliases: ["하체소음", "하체 소음", "하체잡소리", "하체 잡소리", "로어암"],
  },
  {
    label: "배터리 방전",
    aliases: ["배터리방전", "배터리 방전", "AGM", "agm"],
  },
  {
    label: "터보 계통",
    aliases: ["터보", "터보차저", "부스트", "웨이스트게이트"],
  },
  {
    label: "오일 누유",
    aliases: ["오일누유", "오일 누유", "엔진오일 누유", "누유"],
  },
  {
    label: "엔진 떨림",
    aliases: ["엔진떨림", "엔진 떨림", "공회전 떨림", "실화", "부조"],
  },
  {
    label: "에어컨 문제",
    aliases: ["에어컨", "컴프레서", "냉방", "공조"],
  },
  {
    label: "허브베어링 소음",
    aliases: ["허브베어링", "허브 베어링", "웅웅", "주행소음", "주행 소음"],
  },
];

const normalizeKeywordText = (value: string) =>
  value.toLowerCase().replace(/[^0-9a-zㄱ-ㅎ가-힣]+/g, "");

const getReviewSearchText = (review: Review) =>
  [review.title, review.content].filter(Boolean).join(" ");

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
