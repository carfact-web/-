import type { CommunityCategory } from "@/types/community";

export interface CommunityCategoryConfig {
  description: string;
  label: string;
  value: CommunityCategory;
}

export const communityCategories: CommunityCategoryConfig[] = [
  {
    value: "free",
    label: "자유게시판",
    description: "차량, 거래, 일상 이야기를 자유롭게 나눕니다.",
  },
  {
    value: "maintenance",
    label: "정비후기",
    description: "정비 경험과 업체 이용 후기를 공유합니다.",
  },
];

export const getCommunityCategoryLabel = (value: CommunityCategory) =>
  communityCategories.find((category) => category.value === value)?.label ??
  "커뮤니티";

export const isCommunityCategory = (value: string): value is CommunityCategory =>
  communityCategories.some((category) => category.value === value);
