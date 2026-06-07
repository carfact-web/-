import type {
  CommunityBoardFilter,
  CommunityCategory,
} from "@/types/community";

export interface CommunityCategoryConfig {
  description?: string;
  label: string;
  shortLabel?: string;
  value: CommunityBoardFilter;
}

export const communityCategories: CommunityCategoryConfig[] = [
  {
    value: "notice",
    label: "공지사항",
  },
  {
    value: "all",
    label: "전체",
  },
  {
    value: "free",
    label: "자유",
    shortLabel: "자유",
  },
  {
    value: "news",
    label: "정보&소식",
  },
  {
    value: "maintenance",
    label: "정비관련",
  },
  {
    value: "electric",
    label: "전기차",
  },
  {
    value: "imported",
    label: "수입차",
  },
  {
    value: "domestic",
    label: "국산차",
  },
  {
    value: "partner",
    label: "제휴업체",
  },
];

export const writableCommunityCategories = communityCategories.filter(
  (
    category,
  ): category is CommunityCategoryConfig & { value: CommunityCategory } =>
    category.value !== "all" && category.value !== "notice",
);

export const getCommunityCategoryLabel = (value: CommunityBoardFilter) =>
  communityCategories.find((category) => category.value === value)?.label ??
  "커뮤니티";

export const isCommunityCategory = (
  value: string,
): value is CommunityBoardFilter =>
  communityCategories.some((category) => category.value === value);
