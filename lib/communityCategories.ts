import type {
  CommunityCategory,
  CommunityCategoryFilter,
} from "@/types/community";

export interface CommunityCategoryConfig {
  description?: string;
  label: string;
  shortLabel?: string;
  value: CommunityCategoryFilter;
}

export const communityCategories: CommunityCategoryConfig[] = [
  {
    value: "all",
    label: "전체",
  },
  {
    value: "free",
    label: "자유게시판",
    shortLabel: "자유",
  },
  {
    value: "maintenance",
    label: "정비후기",
  },
  {
    value: "question",
    label: "질문",
  },
  {
    value: "news",
    label: "정보&소식",
  },
  {
    value: "shop_review",
    label: "업체후기",
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
];

export const writableCommunityCategories = communityCategories.filter(
  (category): category is CommunityCategoryConfig & { value: CommunityCategory } =>
    category.value !== "all"
);

export const getCommunityCategoryLabel = (value: CommunityCategoryFilter) =>
  communityCategories.find((category) => category.value === value)?.label ??
  "커뮤니티";

export const isCommunityCategory = (
  value: string
): value is CommunityCategoryFilter =>
  communityCategories.some((category) => category.value === value);
