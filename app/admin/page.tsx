"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArcElement, Chart, DoughnutController, Tooltip } from "chart.js";
import { CommunityPostBody } from "@/components/CommunityPostBody";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import {
  communityCategories,
  getCommunityCategoryLabel,
} from "@/lib/communityCategories";
import { getCommunityImagePublicUrl } from "@/lib/communityImages";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";
import {
  countVehicleIssueKeywordMentions,
  extractVehicleIssueKeywords,
  normalizeVehicleIssueKeyword,
  vehicleIssueKeywordDefinitions,
} from "@/utils/vehicleIssueKeywords";
import type { Json } from "@/types/supabase";
import type {
  CommunityBoardFilter,
  CommunityImageAttachment,
} from "@/types/community";

Chart.register(ArcElement, DoughnutController, Tooltip);

type AdminTab =
  | "dashboard"
  | "reviews"
  | "posts"
  | "users"
  | "ai"
  | "knowledge"
  | "reports"
  | "notices";
type AdminRole = "user" | "admin" | "super_admin";
type KnowledgeCategory =
  | "증상"
  | "부품"
  | "시스템"
  | "정비용어"
  | "경고등"
  | "보험"
  | "성능기록부"
  | "일반";
type KnowledgeSortOption =
  | "updated_desc"
  | "updated_asc"
  | "name_asc"
  | "category_asc"
  | "visible_first";
type DashboardBoardTab =
  | "traffic"
  | "views"
  | "content"
  | "keywords"
  | "internalKeywords"
  | "ai";
type DashboardPeriod = "today" | "7days" | "30days" | "90days" | "all";
type DashboardViewFilter = "vehicle" | "model" | "review";
type AiCandidateStatus = "pending" | "reviewing" | "applied" | "excluded";
type AiCandidateSource = "traffic" | "review" | "keyword" | "mixed";
type AiCandidateArchiveFilter = "today" | "recent3days" | "all";
type AiManagementTab = "keywords" | "maintenance" | "candidates";
type CommunityCategory =
  | "free"
  | "maintenance"
  | "news"
  | "electric"
  | "imported"
  | "domestic"
  | "partner";
type ReviewDateFilter = "all" | "today" | "7days" | "30days";
type ReviewDealerFilter = "all" | "dealer" | "member";
type ReviewReportFilter = "all" | "reported" | "clean";
type ReviewSortOption =
  | "latest"
  | "oldest"
  | "reports"
  | "plate"
  | "model"
  | "author";
type ReviewVisibilityFilter = "all" | "visible" | "hidden";

interface AdminAiKeywordRule {
  id: string;
  label: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  category: string;
  fuelType: string;
  targetModel: string;
  isDefaultMaintenance: boolean;
  isVisible: boolean;
  memo: string;
}

interface AdminAiMaintenanceRule {
  id: string;
  title: string;
  condition: string;
  fuelType: string;
  items: string[];
  isVisible: boolean;
  memo: string;
}

interface AdminAiKeywordRuleFormValues {
  category: string;
  excludeKeywords: string;
  fuelType: string;
  includeKeywords: string;
  isDefaultMaintenance: boolean;
  isVisible: boolean;
  label: string;
  memo: string;
  targetModel: string;
}

interface AdminAiMaintenanceRuleFormValues {
  condition: string;
  fuelType: string;
  isVisible: boolean;
  items: string;
  memo: string;
  mileageCondition: string;
  title: string;
  yearCondition: string;
}

interface AdminNewKeywordCandidateFormValues {
  excludeCandidate: boolean;
  includeKeywords: string;
  isVisible: boolean;
  label: string;
  memo: string;
  registerAsIncludeKeyword: boolean;
  registerAsRepresentative: boolean;
}

interface AdminStats {
  comments: number;
  communityPosts: number;
  reports: number;
  reviews: number;
  users: number;
}

interface AdminTrafficTopVehicle {
  vehicle_id: string;
  view_count: number;
  car_number: string | null;
  manufacturer: string | null;
  model: string | null;
  generation: string | null;
  model_detail: string | null;
  year: string | null;
  fuel_type: string | null;
  mileage: string | null;
}

interface AdminTrafficTopModel {
  model_name: string | null;
  manufacturer: string | null;
  view_count: number;
}

interface AdminTrafficTopReview {
  review_id: string;
  vehicle_id: string | null;
  view_count: number;
  content: string | null;
  author_nickname: string | null;
  car_number: string | null;
  manufacturer: string | null;
  model: string | null;
  generation: string | null;
  year: string | null;
  created_at: string | null;
}

interface AdminTrafficBreakdownItem {
  label: string;
  visitor_count: number;
  percentage?: number;
}

interface AdminTrafficTimeItem {
  label: string;
  visitor_count: number;
}

interface AdminTrafficStats {
  todayVisitors: number;
  sevenDayVisitors: number;
  thirtyDayVisitors: number;
  totalVisitors: number;
  todayReviews: number;
  totalReviews: number;
  totalUsers: number;
  topVehicles: AdminTrafficTopVehicle[];
  topModels: AdminTrafficTopModel[];
  topReviews: AdminTrafficTopReview[];
  deviceBreakdown: AdminTrafficBreakdownItem[];
  browserBreakdown: AdminTrafficBreakdownItem[];
  osBreakdown: AdminTrafficBreakdownItem[];
  referrerTop: AdminTrafficBreakdownItem[];
  pathTop: AdminTrafficBreakdownItem[];
  hourlyVisitors: AdminTrafficTimeItem[];
  dailyVisitors: AdminTrafficTimeItem[];
}

interface AdminDashboardTrafficRow {
  date: string;
  visitors: number;
  views: number;
  topReferrer: string;
  pcVisitors: number;
  mobileVisitors: number;
  browserOsSummary: string;
}

interface AdminDashboardViewRanking {
  type: DashboardViewFilter;
  rank: number;
  targetId: string;
  title: string;
  modelName: string;
  viewCount: number;
  recentViewedAt: string | null;
  href: string | null;
}

interface AdminDashboardKeywordRow {
  keyword: string;
  mentionCount: number;
  relatedModels: string[];
  recentOccurredAt: string | null;
  aiStatus: AiCandidateStatus;
}

interface AdminDashboardAcquisitionKeywordRow {
  keyword: string;
  channel: string;
  visitCount: number;
  landingPage: string;
  recentOccurredAt: string | null;
}

interface AdminDashboardAcquisitionEventRow {
  day: string;
  keyword: string;
  channel: string;
  landingPage: string;
  modelName: string;
  symptomKeyword: string | null;
  visits: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  geoScore: number | null;
}

interface AdminDashboardSearchConsoleSummary {
  impressions: number;
  clicks: number;
  ctr: number | null;
  geoScore: number | null;
  updatedAt: string | null;
}

interface AdminDashboardAiCandidate {
  candidateKey: string;
  exampleSentences?: string[];
  keyword: string;
  mentionCount: number;
  recentMentionCount?: number;
  recommendedCategory?: string;
  relatedModels: string[];
  reason: string;
  source: AiCandidateSource;
  status: AiCandidateStatus;
  suggestedUpdates: string[];
  evidence: {
    keywordMentionCount: number | null;
    recentGrowthRate: number | null;
    reviewCount: number | null;
    viewCount: number | null;
  };
  targetBrand: string;
  targetGeneration: string;
  targetModel: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByNickname: string | null;
}

interface AdminAiCandidateStatusRow {
  candidate_key: string;
  candidate_keyword: string;
  related_models: string[];
  source: AiCandidateSource;
  status: AiCandidateStatus;
  updated_by: string | null;
  updated_by_nickname: string | null;
  updated_at: string;
}

interface AdminOperatorDashboardData {
  totalViews: number;
  trafficRows: AdminDashboardTrafficRow[];
  viewRankings: AdminDashboardViewRanking[];
  keywordRows: AdminDashboardAcquisitionKeywordRow[];
  acquisitionRows: AdminDashboardAcquisitionEventRow[];
  searchConsoleSummary: AdminDashboardSearchConsoleSummary;
  internalKeywordRows: AdminDashboardKeywordRow[];
  aiCandidates: AdminDashboardAiCandidate[];
}

interface TrafficSourceDonutItem {
  color: string;
  label: string;
  value: number;
}

interface AdminCommunityPost {
  id: string;
  category: CommunityCategory;
  title: string;
  content: string;
  user_id: string;
  author_nickname: string | null;
  images: Json;
  is_hidden: boolean;
  is_notice: boolean;
  is_pinned: boolean;
  report_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

interface AdminReview {
  id: string;
  vehicle_id: string;
  car_number: string | null;
  author_id: string | null;
  author_nickname: string | null;
  title: string | null;
  content: string;
  tags: string[];
  images: Json;
  vehicle_snapshot: Json;
  helpful_count: number;
  report_count: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminUserProfile {
  id: string;
  nickname: string | null;
  nickname_changed: boolean;
  nickname_change_available: number;
  role: AdminRole;
  is_suspended: boolean;
  is_verified_dealer: boolean;
  login_provider: string | null;
  email: string | null;
  provider_profile_name: string | null;
  provider_avatar_url: string | null;
  provider_user_id: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminReport {
  report_type: "게시글" | "후기";
  report_id: string;
  target_id: string;
  reason: string | null;
  reporter_id: string | null;
  created_at: string;
  report_count: number;
  target_title: string | null;
  target_content: string;
  target_author: string | null;
  is_hidden: boolean;
  target_path: string | null;
}

interface AdminPopupNotice {
  id: string;
  title: string;
  content: string;
  link_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminKnowledgeTerm {
  id: string;
  category: KnowledgeCategory;
  representative_name: string;
  slug: string;
  description: string;
  main_causes: string[];
  main_symptoms: string[];
  maintenance_tips: string[];
  expected_repair_cost: string;
  related_keywords: string[];
  related_models: string[];
  priority: number;
  view_count: number;
  is_visible: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminKnowledgeTermFormValues {
  category: KnowledgeCategory;
  description: string;
  expectedRepairCost: string;
  isVisible: boolean;
  maintenanceTips: string;
  mainCauses: string;
  mainSymptoms: string;
  priority: number;
  relatedKeywords: string;
  relatedModels: string;
  representativeName: string;
  slug: string;
}

const tabs: { label: string; value: AdminTab }[] = [
  { label: "Dashboard", value: "dashboard" },
  { label: "후기 관리", value: "reviews" },
  { label: "게시글 관리", value: "posts" },
  { label: "회원 관리", value: "users" },
  { label: "AI 관리", value: "ai" },
  { label: "Knowledge Center", value: "knowledge" },
  { label: "신고 관리", value: "reports" },
  { label: "공지 관리", value: "notices" },
];

const emptyStats: AdminStats = {
  comments: 0,
  communityPosts: 0,
  reports: 0,
  reviews: 0,
  users: 0,
};

const emptyTrafficStats: AdminTrafficStats = {
  todayVisitors: 0,
  sevenDayVisitors: 0,
  thirtyDayVisitors: 0,
  totalVisitors: 0,
  todayReviews: 0,
  totalReviews: 0,
  totalUsers: 0,
  topVehicles: [],
  topModels: [],
  topReviews: [],
  deviceBreakdown: [],
  browserBreakdown: [],
  osBreakdown: [],
  referrerTop: [],
  pathTop: [],
  hourlyVisitors: [],
  dailyVisitors: [],
};

const emptyOperatorDashboardData: AdminOperatorDashboardData = {
  totalViews: 0,
  trafficRows: [],
  viewRankings: [],
  keywordRows: [],
  acquisitionRows: [],
  searchConsoleSummary: {
    impressions: 0,
    clicks: 0,
    ctr: null,
    geoScore: null,
    updatedAt: null,
  },
  internalKeywordRows: [],
  aiCandidates: [],
};

const pageClassName = cn(
  "min-h-screen bg-[#f5f6f8] px-3 py-4 pb-28 text-zinc-950 sm:px-5 sm:py-6",
);
const shellClassName = cn("mx-auto flex w-full max-w-[1680px] flex-col gap-4");
const panelClassName = cn(
  "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-200/60 sm:p-5",
);
const mutedTextClassName = cn("text-sm leading-relaxed text-zinc-500");
const tabButtonClassName = cn(
  "rounded-lg px-3 py-2 text-sm font-bold text-zinc-500 transition",
  "hover:bg-zinc-100 hover:text-zinc-950",
);
const activeTabButtonClassName = cn(
  "bg-zinc-950 text-white shadow-sm hover:bg-zinc-950 hover:text-white",
);
const actionButtonClassName = cn(
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 transition",
  "hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50",
);
const adminInputClassName = cn(
  "min-h-9 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 outline-none transition",
  "placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
);
const dangerButtonClassName = cn(
  actionButtonClassName,
  "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800",
);
const tableClassName = cn("min-w-full divide-y divide-zinc-200 text-sm");
const desktopTableClassName = cn(tableClassName, "hidden min-w-[1180px] md:table");
const tableHeadCellClassName = cn(
  "whitespace-nowrap px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.08em] text-zinc-400",
);
const tableCellClassName = cn("px-3 py-3 align-top text-zinc-700");
const tableActionCellClassName = cn(tableCellClassName, "min-w-[24rem] text-right");
const desktopActionGroupClassName = cn("flex flex-nowrap justify-end gap-1.5");
const mobileListClassName = cn("divide-y divide-zinc-100 md:hidden");
const mobileCardClassName = cn(
  "grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 transition hover:bg-zinc-50",
);
const mobileCardTitleClassName = cn(
  "line-clamp-2 break-words text-sm font-black leading-5 text-zinc-950",
);
const mobileCardMetaClassName = cn(
  "mt-1 line-clamp-1 break-words text-xs leading-5 text-zinc-500",
);
const mobileCardSubMetaClassName = cn(
  "mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500",
);
const inputClassName = cn(
  "min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition",
  "placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
);
const checkboxClassName = cn(
  "h-4 w-4 rounded border-zinc-300 bg-white text-blue-600",
  "focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0",
);
const paginationButtonClassName = cn(
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-600 transition",
  "hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40",
);
const activePaginationButtonClassName = cn(
  "border-blue-600 bg-blue-600 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white",
);
const categoryFilterButtonClassName = cn(
  "whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-600 transition",
  "hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950",
);
const activeCategoryFilterButtonClassName = cn(
  "border-blue-600 bg-blue-600 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white",
);
const adminPostCategoryTabs = [
  { label: "전체", value: "all" },
  { label: "공지사항", value: "notice" },
  ...communityCategories.filter(
    (category) => category.value !== "all" && category.value !== "notice",
  ),
] satisfies Array<{ label: string; value: CommunityBoardFilter }>;
const adminPostsPerPage = 10;
const adminReviewsPerPage = 10;

const knowledgeCategories: { label: KnowledgeCategory; value: KnowledgeCategory }[] =
  [
    { label: "증상", value: "증상" },
    { label: "부품", value: "부품" },
    { label: "시스템", value: "시스템" },
    { label: "정비용어", value: "정비용어" },
    { label: "경고등", value: "경고등" },
    { label: "보험", value: "보험" },
    { label: "성능기록부", value: "성능기록부" },
    { label: "일반", value: "일반" },
  ];

const knowledgeSortOptions: { label: string; value: KnowledgeSortOption }[] = [
  { label: "최근 수정순", value: "updated_desc" },
  { label: "오래된 수정순", value: "updated_asc" },
  { label: "대표명순", value: "name_asc" },
  { label: "분류순", value: "category_asc" },
  { label: "노출 우선", value: "visible_first" },
];

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return year + "." + month + "." + day + " " + hours + ":" + minutes;
};

const formatOptionalDate = (value: string | null | undefined) =>
  value ? formatDate(value) : "정보 없음";

const getDisplayValue = (value: string | null | undefined) =>
  value?.trim() ? value : "정보 없음";

const formatCompactId = (value: string | null | undefined, length = 8) =>
  value?.trim() ? value.slice(0, length) : "정보 없음";

const formatProviderLabel = (value: string | null | undefined) =>
  getDisplayValue(value).replace(/^oauth_/, "");

const formatReviewVehicleSummary = (review: AdminReview) => {
  const snapshot = review.vehicle_snapshot;
  const brand = getJsonString(snapshot, "brand");
  const model = getJsonString(snapshot, "model");
  const plateNumber = getReviewPlateNumber(review);
  const year = getJsonString(snapshot, "year");
  const vehicleName = [brand, model].filter(Boolean).join(" ");

  return [vehicleName || review.vehicle_id, plateNumber, year ? year + "년" : ""]
    .filter(Boolean)
    .join(" · ");
};

const getPostCategoryLabel = (post: AdminCommunityPost) =>
  post.is_notice ? "공지사항" : getCommunityCategoryLabel(post.category);

const isCommunityImageRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getCommunityPostImages = (
  value: Json,
): CommunityImageAttachment[] =>
  Array.isArray(value)
    ? (value as unknown[])
        .map<CommunityImageAttachment | null>((storedImage, index) => {
          let image = storedImage;

          if (typeof image === "string") {
            const trimmedImage = image.trim();

            if (trimmedImage.startsWith("{")) {
              try {
                const parsedImage = JSON.parse(trimmedImage);

                if (isCommunityImageRecord(parsedImage)) {
                  image = parsedImage;
                }
              } catch {
                image = storedImage;
              }
            }

            if (typeof image === "string") {
              const imageType: CommunityImageAttachment["type"] = image
                .toLowerCase()
                .endsWith(".webp")
                ? "image/webp"
                : image.toLowerCase().endsWith(".png")
                  ? "image/png"
                  : "image/jpeg";

              return {
                id: image,
                name: "커뮤니티 이미지",
                path: /^https?:\/\//.test(image) ? undefined : image,
                size: 0,
                type: imageType,
                url: getCommunityImagePublicUrl(image),
              };
            }
          }

          if (!isCommunityImageRecord(image)) {
            return null;
          }

          const rawPath =
            typeof image.path === "string"
              ? image.path
              : typeof image.key === "string"
                ? image.key
                : undefined;
          const path = rawPath?.replace(/^community-images\//, "");
          const url =
            path !== undefined
              ? getCommunityImagePublicUrl(path)
              : typeof image.url === "string" && image.url
                ? image.url
                : typeof image.publicUrl === "string" && image.publicUrl
                  ? image.publicUrl
                  : undefined;
          const imageType: CommunityImageAttachment["type"] =
            image.type === "image/png" || image.type === "image/webp"
              ? image.type
              : "image/jpeg";

          return {
            id: String(image.id ?? url ?? path ?? index),
            name: String(image.name ?? "커뮤니티 이미지"),
            path,
            size: typeof image.size === "number" ? image.size : 0,
            type: imageType,
            url,
          };
        })
        .filter((image): image is CommunityImageAttachment => Boolean(image))
    : [];

const getPostAuthorProfile = (
  post: AdminCommunityPost,
  users: AdminUserProfile[],
) => users.find((account) => account.id === post.user_id) ?? null;

const getPostAuthorRoleLabel = (
  post: AdminCommunityPost,
  users: AdminUserProfile[],
) => {
  const author = getPostAuthorProfile(post, users);

  if (author?.role === "super_admin" || author?.role === "admin") {
    return "admin";
  }

  if (author?.is_verified_dealer) {
    return "dealer";
  }

  return null;
};

const getPostAuthorDisplayName = (
  post: AdminCommunityPost,
  users: AdminUserProfile[],
) =>
  post.author_nickname ??
  getPostAuthorProfile(post, users)?.nickname ??
  formatCompactId(post.user_id);

const formatAdminPlateNumber = (plateNumber: string | null | undefined) => {
  const normalizedPlateNumber = plateNumber?.replace(/\s+/g, "").trim() ?? "";

  return normalizedPlateNumber || "차량번호 없음";
};

const getReviewPlateNumber = (review: AdminReview) =>
  review.car_number?.trim() ||
  getJsonString(review.vehicle_snapshot, "plateNumber");

const getReviewVehicleModel = (review: AdminReview) => {
  const snapshot = review.vehicle_snapshot;
  const brand = getJsonString(snapshot, "brand");
  const model = getJsonString(snapshot, "model");
  const generation = getJsonString(snapshot, "generation");

  return [brand, generation || model].filter(Boolean).join(" ") || "차량 정보 없음";
};

const getReviewFuelType = (review: AdminReview) =>
  getJsonString(review.vehicle_snapshot, "fuelType") ||
  getJsonString(review.vehicle_snapshot, "fuel_type") ||
  "";

const getReviewDetailHref = (review: AdminReview) => {
  const plateNumber = getReviewPlateNumber(review);

  return plateNumber ? "/car/" + encodeURIComponent(plateNumber) : null;
};

const getAdminPaginationPages = (totalPages: number, currentPage: number) => {
  const maxVisiblePages = 5;

  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisiblePages / 2);
  const startPage = Math.min(
    Math.max(1, currentPage - halfWindow),
    totalPages - maxVisiblePages + 1,
  );

  return Array.from(
    { length: maxVisiblePages },
    (_, index) => startPage + index,
  );
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const getJsonString = (value: Json, key: string) =>
  isRecord(value) ? toNullableString(value[key]) : null;

const toNumber = (value: unknown) => {
  const numberValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(value ?? 0);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeKnowledgeCategory = (value: unknown): KnowledgeCategory => {
  const category = String(value ?? "").trim();
  const matchedCategory = knowledgeCategories.find((item) => item.value === category);

  return matchedCategory?.value ?? "일반";
};

const normalizeKnowledgeSortOption = (value: unknown): KnowledgeSortOption => {
  const sortOption = String(value ?? "").trim();
  const matchedOption = knowledgeSortOptions.find(
    (item) => item.value === sortOption,
  );

  return matchedOption?.value ?? "updated_desc";
};

const normalizeKnowledgeSlug = (value: string) => value.trim().toLowerCase();

const createKnowledgeSlug = (value: string) =>
  normalizeKnowledgeSlug(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );

const isValidKnowledgeSlug = (value: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const splitAdminListInput = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const formatAdminListInput = (value: string[]) => value.join(", ");

const createKeywordRuleFormValues = (
  rule?: AdminAiKeywordRule,
): AdminAiKeywordRuleFormValues => ({
  category: rule?.category ?? "",
  excludeKeywords: formatAdminListInput(rule?.excludeKeywords ?? []),
  fuelType: rule?.fuelType ?? "",
  includeKeywords: formatAdminListInput(rule?.includeKeywords ?? []),
  isDefaultMaintenance: rule?.isDefaultMaintenance ?? false,
  isVisible: rule?.isVisible ?? true,
  label: rule?.label ?? "",
  memo: rule?.memo ?? "",
  targetModel: rule?.targetModel ?? "",
});

const createMaintenanceRuleFormValues = (
  rule?: AdminAiMaintenanceRule,
): AdminAiMaintenanceRuleFormValues => ({
  condition: rule?.condition ?? "",
  fuelType: rule?.fuelType ?? "",
  isVisible: rule?.isVisible ?? true,
  items: formatAdminListInput(rule?.items ?? []),
  memo: rule?.memo ?? "",
  mileageCondition: "",
  title: rule?.title ?? "",
  yearCondition: "",
});

const createKnowledgeTermFormValues = (
  term?: AdminKnowledgeTerm,
): AdminKnowledgeTermFormValues => ({
  category: term?.category ?? "일반",
  description: term?.description ?? "",
  expectedRepairCost: term?.expected_repair_cost ?? "",
  isVisible: term?.is_visible ?? true,
  maintenanceTips: formatAdminListInput(term?.maintenance_tips ?? []),
  mainCauses: formatAdminListInput(term?.main_causes ?? []),
  mainSymptoms: formatAdminListInput(term?.main_symptoms ?? []),
  priority: term?.priority ?? 0,
  relatedKeywords: formatAdminListInput(term?.related_keywords ?? []),
  relatedModels: formatAdminListInput(term?.related_models ?? []),
  representativeName: term?.representative_name ?? "",
  slug: term?.slug ?? "",
});

const normalizeAdminKnowledgeTerm = (
  term: AdminKnowledgeTerm,
): AdminKnowledgeTerm => ({
  ...term,
  category: normalizeKnowledgeCategory(term.category),
  slug: normalizeKnowledgeSlug(term.slug ?? ""),
  main_causes: Array.isArray(term.main_causes) ? term.main_causes : [],
  main_symptoms: Array.isArray(term.main_symptoms) ? term.main_symptoms : [],
  maintenance_tips: Array.isArray(term.maintenance_tips)
    ? term.maintenance_tips
    : [],
  related_keywords: Array.isArray(term.related_keywords)
    ? term.related_keywords
    : [],
  related_models: Array.isArray(term.related_models) ? term.related_models : [],
  priority: toNumber(term.priority),
  view_count: toNumber(term.view_count),
});

const toTrafficTopVehicles = (value: Json): AdminTrafficTopVehicle[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        vehicle_id: String(item.vehicle_id ?? ""),
        view_count: toNumber(item.view_count),
        car_number: toNullableString(item.car_number),
        manufacturer: toNullableString(item.manufacturer),
        model: toNullableString(item.model),
        generation: toNullableString(item.generation),
        model_detail: toNullableString(item.model_detail),
        year: toNullableString(item.year),
        fuel_type: toNullableString(item.fuel_type),
        mileage: toNullableString(item.mileage),
      }))
    : [];

const toTrafficTopModels = (value: Json): AdminTrafficTopModel[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        model_name: toNullableString(item.model_name),
        manufacturer: toNullableString(item.manufacturer),
        view_count: toNumber(item.view_count),
      }))
    : [];

const toTrafficTopReviews = (value: Json): AdminTrafficTopReview[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        review_id: String(item.review_id ?? ""),
        vehicle_id: toNullableString(item.vehicle_id),
        view_count: toNumber(item.view_count),
        content: toNullableString(item.content),
        author_nickname: toNullableString(item.author_nickname),
        car_number: toNullableString(item.car_number),
        manufacturer: toNullableString(item.manufacturer),
        model: toNullableString(item.model),
        generation: toNullableString(item.generation),
        year: toNullableString(item.year),
        created_at: toNullableString(item.created_at),
      }))
    : [];

const toTrafficBreakdownItems = (value: Json): AdminTrafficBreakdownItem[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        label: String(item.label ?? ""),
        visitor_count: toNumber(item.visitor_count),
        percentage:
          item.percentage === undefined ? undefined : toNumber(item.percentage),
      }))
    : [];

const toTrafficTimeItems = (value: Json): AdminTrafficTimeItem[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        label: String(item.label ?? ""),
        visitor_count: toNumber(item.visitor_count),
      }))
    : [];

const dashboardViewFilters: {
  label: string;
  value: DashboardViewFilter;
}[] = [
  { label: "조회수 TOP 차량", value: "vehicle" },
  { label: "조회수 TOP 모델", value: "model" },
  { label: "조회수 TOP 후기", value: "review" },
];

const dashboardBoardTabs: { label: string; value: DashboardBoardTab }[] = [
  { label: "트래픽", value: "traffic" },
  { label: "조회수", value: "views" },
  { label: "콘텐츠", value: "content" },
  { label: "유입 키워드", value: "keywords" },
  { label: "내부 키워드", value: "internalKeywords" },
  { label: "AI DB 업데이트 추천", value: "ai" },
];

const dashboardPeriods: { label: string; value: DashboardPeriod }[] = [
  { label: "오늘", value: "today" },
  { label: "7일", value: "7days" },
  { label: "30일", value: "30days" },
  { label: "90일", value: "90days" },
  { label: "전체", value: "all" },
];

const trafficSourceConfig = [
  { label: "Google", color: "#2563eb" },
  { label: "Naver", color: "#16a34a" },
  { label: "Daum", color: "#f59e0b" },
  { label: "Bing", color: "#0891b2" },
  { label: "Direct", color: "#111827" },
  { label: "SNS", color: "#e11d48" },
  { label: "기타", color: "#a855f7" },
] satisfies Array<{ label: string; color: string }>;

const normalizeTrafficSourceGroup = (value: string) => {
  const normalizedValue = value.trim().toLowerCase();

  if (
    !normalizedValue ||
    normalizedValue === "direct" ||
    normalizedValue === "(direct)" ||
    normalizedValue === "직접 유입"
  ) {
    return "Direct";
  }

  if (normalizedValue.includes("google")) return "Google";
  if (normalizedValue.includes("naver")) return "Naver";
  if (normalizedValue.includes("daum")) return "Daum";
  if (normalizedValue.includes("bing")) return "Bing";
  if (
    normalizedValue.includes("facebook") ||
    normalizedValue.includes("instagram") ||
    normalizedValue.includes("threads") ||
    normalizedValue.includes("twitter") ||
    normalizedValue.includes("x.com") ||
    normalizedValue.includes("t.co") ||
    normalizedValue.includes("kakao")
  ) {
    return "SNS";
  }

  return "기타";
};

const createTrafficSourceDonutItems = (
  referrerTop: AdminTrafficBreakdownItem[],
): TrafficSourceDonutItem[] => {
  const counts = new Map(
    trafficSourceConfig.map((item) => [item.label, 0]),
  );

  referrerTop.forEach((item) => {
    const source = normalizeTrafficSourceGroup(item.label);
    counts.set(source, (counts.get(source) ?? 0) + item.visitor_count);
  });

  return trafficSourceConfig.map((item) => ({
    ...item,
    value: counts.get(item.label) ?? 0,
  }));
};

const aiCandidateStatuses: {
  label: string;
  value: Exclude<AiCandidateStatus, "pending">;
}[] = [
  { label: "검토중", value: "reviewing" },
  { label: "반영완료 보관함", value: "applied" },
  { label: "제외", value: "excluded" },
];

const aiCandidateActionStatuses: {
  label: string;
  value: Exclude<AiCandidateStatus, "pending">;
}[] = [
  { label: "검토중", value: "reviewing" },
  { label: "반영완료", value: "applied" },
  { label: "제외", value: "excluded" },
];

const aiCandidateArchiveFilters: {
  label: string;
  value: AiCandidateArchiveFilter;
}[] = [
  { label: "오늘", value: "today" },
  { label: "최근 3일", value: "recent3days" },
  { label: "전체 보기", value: "all" },
];
const aiCandidateArchiveReferenceTime = Date.now();

const aiManagementTabs: { label: string; value: AiManagementTab }[] = [
  { label: "키워드 관리", value: "keywords" },
  { label: "정비항목 룰", value: "maintenance" },
  { label: "신규 키워드 자동감지", value: "candidates" },
];

const newKeywordCandidateStatuses: {
  label: string;
  value: Exclude<AiCandidateStatus, "applied">;
}[] = [
  { label: "신규 후보", value: "pending" },
  { label: "보류", value: "reviewing" },
  { label: "제외", value: "excluded" },
];

const ignoredNewKeywordTokens = new Set(
  [
    "가격",
    "가능",
    "거래",
    "검토",
    "결과",
    "관리",
    "구매",
    "그냥",
    "기록",
    "기준",
    "내용",
    "느낌",
    "다시",
    "대비",
    "동안",
    "등록",
    "때문",
    "많이",
    "매우",
    "문제",
    "문의",
    "부분",
    "상태",
    "생각",
    "서비스",
    "수리",
    "실제",
    "아직",
    "약간",
    "없음",
    "여부",
    "오늘",
    "완료",
    "운행",
    "위치",
    "의심",
    "이상",
    "이슈",
    "일반",
    "자주",
    "전체",
    "점검",
    "정도",
    "정비",
    "좋음",
    "주행",
    "주의",
    "차량",
    "처리",
    "체크",
    "추가",
    "추천",
    "출고",
    "크게",
    "필요",
    "확인",
    "후기",
  ].map(normalizeVehicleIssueKeyword),
);

const reviewDateFilters: { label: string; value: ReviewDateFilter }[] = [
  { label: "전체 기간", value: "all" },
  { label: "오늘", value: "today" },
  { label: "최근 7일", value: "7days" },
  { label: "최근 30일", value: "30days" },
];

const reviewVisibilityFilters: {
  label: string;
  value: ReviewVisibilityFilter;
}[] = [
  { label: "전체 상태", value: "all" },
  { label: "노출", value: "visible" },
  { label: "숨김", value: "hidden" },
];

const reviewReportFilters: { label: string; value: ReviewReportFilter }[] = [
  { label: "신고 전체", value: "all" },
  { label: "신고 있음", value: "reported" },
  { label: "신고 없음", value: "clean" },
];

const reviewDealerFilters: { label: string; value: ReviewDealerFilter }[] = [
  { label: "전체 회원", value: "all" },
  { label: "딜러", value: "dealer" },
  { label: "일반 회원", value: "member" },
];

const reviewSortOptions: { label: string; value: ReviewSortOption }[] = [
  { label: "최신순", value: "latest" },
  { label: "오래된순", value: "oldest" },
  { label: "신고 많은순", value: "reports" },
  { label: "차량번호순", value: "plate" },
  { label: "차종명순", value: "model" },
  { label: "작성자순", value: "author" },
];

const aiKeywordStorageKey = "carfact-admin-ai-keyword-rules";
const aiMaintenanceStorageKey = "carfact-admin-ai-maintenance-rules";

const createInitialAiKeywordRules = (): AdminAiKeywordRule[] =>
  vehicleIssueKeywordDefinitions.map((definition, index) => ({
    id: "code-keyword-" + index + "-" + normalizeVehicleIssueKeyword(definition.label),
    label: definition.groupLabel ?? definition.label,
    includeKeywords: Array.from(new Set([definition.label, ...definition.aliases])),
    excludeKeywords: [],
    category: definition.inspectionTitle.replace(/\s*확인$/, ""),
    fuelType: "",
    targetModel: "",
    isDefaultMaintenance: false,
    isVisible: true,
    memo: "코드 사전 기준 초기값",
  }));

const initialAiMaintenanceRules: AdminAiMaintenanceRule[] = [
  {
    id: "diesel-default",
    title: "디젤 기본 참고 항목",
    condition: "유종이 디젤인 차량",
    fuelType: "디젤",
    items: ["DPF", "터보", "인젝터", "촉매"],
    isVisible: true,
    memo: "요소수/SCR은 명시 SCR 데이터가 있을 때만 별도 노출",
  },
  {
    id: "gasoline-lpg-aged",
    title: "가솔린/LPG 연식·주행거리 기본 항목",
    condition: "5년 이상 또는 50,000km 이상",
    fuelType: "가솔린/LPG",
    items: ["점화코일", "점화플러그"],
    isVisible: true,
    memo: "디젤 차량에는 적용하지 않음",
  },
  {
    id: "scr-confirmed",
    title: "SCR 확인 차량",
    condition: "DB에서 hasScr=true 또는 scrType이 확인된 차량",
    fuelType: "디젤",
    items: ["요소수/SCR"],
    isVisible: true,
    memo: "연식만으로 자동 노출 금지",
  },
];

const readStoredAdminRules = <Rule,>(key: string, fallback: Rule[]): Rule[] => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);

    return storedValue ? (JSON.parse(storedValue) as Rule[]) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeAiCandidateStatus = (value: unknown): AiCandidateStatus => {
  if (
    value === "pending" ||
    value === "reviewing" ||
    value === "applied" ||
    value === "excluded"
  ) {
    return value;
  }

  return "pending";
};

const normalizeAiCandidateSource = (value: unknown): AiCandidateSource => {
  if (
    value === "traffic" ||
    value === "review" ||
    value === "keyword" ||
    value === "mixed"
  ) {
    return value;
  }

  return "mixed";
};

const normalizeViewFilter = (value: unknown): DashboardViewFilter => {
  if (value === "vehicle" || value === "model" || value === "review") {
    return value;
  }

  return "vehicle";
};

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .filter(Boolean)
    : [];

const toOperatorTrafficRows = (
  value: Json,
): AdminDashboardTrafficRow[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        date: String(item.date ?? ""),
        visitors: toNumber(item.visitors),
        views: toNumber(item.views),
        topReferrer: String(item.top_referrer ?? "direct"),
        pcVisitors: toNumber(item.pc_visitors),
        mobileVisitors: toNumber(item.mobile_visitors),
        browserOsSummary: String(item.browser_os_summary ?? "기록 없음"),
      }))
    : [];

const toOperatorViewRankings = (
  value: Json,
): AdminDashboardViewRanking[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        type: normalizeViewFilter(item.type),
        rank: toNumber(item.rank),
        targetId: String(item.target_id ?? ""),
        title: String(item.title ?? "정보 없음"),
        modelName: String(item.model_name ?? "정보 없음"),
        viewCount: toNumber(item.view_count),
        recentViewedAt: toNullableString(item.recent_viewed_at),
        href: toNullableString(item.href),
      }))
    : [];

const toOperatorAcquisitionKeywordRows = (
  value: Json,
): AdminDashboardAcquisitionKeywordRow[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        keyword: String(item.keyword ?? "not provided"),
        channel: String(item.channel ?? "Direct"),
        visitCount: toNumber(item.visit_count),
        landingPage: String(item.landing_page ?? "/"),
        recentOccurredAt: toNullableString(item.recent_occurred_at),
      }))
    : [];

const toOperatorAcquisitionEventRows = (
  value: Json,
): AdminDashboardAcquisitionEventRow[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        day: String(item.day ?? ""),
        keyword: String(item.keyword ?? "not provided"),
        channel: String(item.channel ?? "Direct"),
        landingPage: String(item.landing_page ?? "/"),
        modelName: String(item.model_name ?? "차종 확인 불가"),
        symptomKeyword: toNullableString(item.symptom_keyword),
        visits: toNumber(item.visits),
        impressions: toNumber(item.impressions),
        clicks: toNumber(item.clicks),
        ctr:
          item.ctr === null || item.ctr === undefined ? null : toNumber(item.ctr),
        geoScore:
          item.geo_score === null || item.geo_score === undefined
            ? null
            : toNumber(item.geo_score),
      }))
    : [];

const toOperatorSearchConsoleSummary = (
  value: Json,
): AdminDashboardSearchConsoleSummary => {
  const item = isRecord(value) ? value : {};
  const ctr = item.ctr === null || item.ctr === undefined ? null : toNumber(item.ctr);
  const geoScore =
    item.geo_score === null || item.geo_score === undefined
      ? null
      : toNumber(item.geo_score);

  return {
    impressions: toNumber(item.impressions),
    clicks: toNumber(item.clicks),
    ctr,
    geoScore,
    updatedAt: toNullableString(item.updated_at),
  };
};

const toOperatorKeywordRows = (
  value: Json,
): AdminDashboardKeywordRow[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        keyword: String(item.keyword ?? ""),
        mentionCount: toNumber(item.mention_count),
        relatedModels: toStringArray(item.related_models),
        recentOccurredAt: toNullableString(item.recent_occurred_at),
        aiStatus: normalizeAiCandidateStatus(item.ai_status),
      }))
    : [];

const getReviewSnapshotValue = (review: AdminReview, keys: string[]) => {
  for (const key of keys) {
    const value = getJsonString(review.vehicle_snapshot, key);

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
};

const getCandidateStatusMap = (rows: AdminAiCandidateStatusRow[]) =>
  new Map(rows.map((row) => [row.candidate_key, row]));

const getRegisteredKeywordSet = (
  keywordRules: AdminAiKeywordRule[],
  statusRows: AdminAiCandidateStatusRow[],
) => {
  const registeredKeywords = new Set<string>();
  const addKeyword = (value: string | null | undefined) => {
    const normalizedValue = normalizeVehicleIssueKeyword(value ?? "");

    if (normalizedValue) {
      registeredKeywords.add(normalizedValue);
    }
  };

  vehicleIssueKeywordDefinitions.forEach((definition) => {
    addKeyword(definition.label);
    definition.aliases.forEach(addKeyword);
  });
  keywordRules.forEach((rule) => {
    addKeyword(rule.label);
    rule.includeKeywords.forEach(addKeyword);
    rule.excludeKeywords.forEach(addKeyword);
  });
  statusRows
    .filter((row) => row.status === "applied")
    .forEach((row) => addKeyword(row.candidate_keyword));

  return registeredKeywords;
};

const getReviewVehicleKeywordBlocklist = (reviews: AdminReview[]) => {
  const blockedKeywords = new Set<string>();
  const addValue = (value: string | null | undefined) => {
    const normalizedValue = normalizeVehicleIssueKeyword(value ?? "");

    if (normalizedValue) {
      blockedKeywords.add(normalizedValue);
    }

    (value ?? "")
      .split(/[^0-9A-Za-z가-힣]+/)
      .map(normalizeVehicleIssueKeyword)
      .filter((item) => item.length >= 2)
      .forEach((item) => blockedKeywords.add(item));
  };

  reviews.forEach((review) => {
    [
      getJsonString(review.vehicle_snapshot, "brand"),
      getJsonString(review.vehicle_snapshot, "manufacturer"),
      getJsonString(review.vehicle_snapshot, "model"),
      getJsonString(review.vehicle_snapshot, "generation"),
      getJsonString(review.vehicle_snapshot, "modelDetail"),
      getJsonString(review.vehicle_snapshot, "year"),
      review.author_nickname,
      ...(Array.isArray(review.tags) ? review.tags : []),
    ].forEach(addValue);
  });

  return blockedKeywords;
};

const normalizeCandidateToken = (value: string) => {
  const normalizedValue = normalizeVehicleIssueKeyword(value);

  if (/^[가-힣]+$/.test(normalizedValue) && normalizedValue.length > 2) {
    return normalizedValue.replace(
      /(으로|에서|에게|부터|까지|처럼|보다|관련|쪽은|쪽이|쪽을|쪽도|쪽|들은|들을|이나|거나|이고|이며|하고|하면|해서|되어|되는|된|은|는|이|가|을|를|과|와|도|만|로|에)$/u,
      "",
    );
  }

  return normalizedValue;
};

const getReviewContentTokens = (content: string) =>
  Array.from(content.matchAll(/[A-Za-z][A-Za-z0-9+#/-]{1,}|[가-힣A-Za-z0-9]{2,}/g))
    .map((match) => normalizeCandidateToken(match[0]))
    .filter((token) => token.length >= 2);

const getReviewExampleSentences = (content: string, keyword: string) => {
  const normalizedKeyword = normalizeVehicleIssueKeyword(keyword);

  return content
    .split(/[.!?。！？\n]+/)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence.length > 0 &&
        normalizeVehicleIssueKeyword(sentence).includes(normalizedKeyword),
    )
    .map((sentence) =>
      sentence.length > 90 ? sentence.slice(0, 87).trim() + "..." : sentence,
    );
};

const guessNewKeywordCategory = (keyword: string, exampleText: string) => {
  const normalizedText = normalizeVehicleIssueKeyword(keyword + " " + exampleText);

  if (/(엔진|실린더|피스톤|cvvd|밸브|오일|점화)/i.test(normalizedText)) {
    return "엔진/구동계";
  }

  if (/(미션|변속|클러치|dct|토크)/i.test(normalizedText)) {
    return "미션/변속";
  }

  if (/(배터리|전장|센서|경고등|모듈|ecu|전기)/i.test(normalizedText)) {
    return "전장/전자";
  }

  if (/(하체|서스|쇼바|암|부싱|베어링|조향)/i.test(normalizedText)) {
    return "하체/조향";
  }

  if (/(에어컨|히터|공조|냉방|난방)/i.test(normalizedText)) {
    return "공조";
  }

  if (/(도장|외판|부식|녹|누수|유리|트렁크)/i.test(normalizedText)) {
    return "외관/차체";
  }

  return "후기 반복 신규 키워드";
};

const createNewKeywordCandidatesFromReviewContent = (
  reviews: AdminReview[],
  statusRows: AdminAiCandidateStatusRow[],
  keywordRules: AdminAiKeywordRule[],
) => {
  const statusMap = getCandidateStatusMap(statusRows);
  const registeredKeywords = getRegisteredKeywordSet(keywordRules, statusRows);
  const vehicleKeywordBlocklist = getReviewVehicleKeywordBlocklist(reviews);
  const now = Date.now();
  const recentStart = now - 30 * 24 * 60 * 60 * 1000;
  const previousStart = now - 60 * 24 * 60 * 60 * 1000;
  const aggregates = new Map<
    string,
    {
      exampleSentences: string[];
      keyword: string;
      mentionCount: number;
      modelReviewCounts: Map<string, number>;
      previousReviewCount: number;
      recentMentionCount: number;
      recentReviewCount: number;
      relatedModels: Set<string>;
      targetBrand: string;
      targetGeneration: string;
      targetModel: string;
      totalReviewCount: number;
    }
  >();

  reviews
    .filter((review) => !review.is_hidden)
    .forEach((review) => {
      const content = review.content ?? "";
      const targetBrand = getReviewSnapshotValue(review, ["brand", "manufacturer"]);
      const targetModel = getReviewSnapshotValue(review, ["model"]);
      const targetGeneration = getReviewSnapshotValue(review, [
        "generation",
        "modelDetail",
      ]);
      const modelLabel = [targetBrand, targetModel, targetGeneration]
        .filter(Boolean)
        .join(" ")
        .trim();
      const createdAt = Date.parse(review.created_at);
      const isRecent = !Number.isNaN(createdAt) && createdAt >= recentStart;
      const isPrevious =
        !Number.isNaN(createdAt) &&
        createdAt >= previousStart &&
        createdAt < recentStart;
      const reviewTokens = Array.from(new Set(getReviewContentTokens(content)));

      reviewTokens.forEach((token) => {
        if (
          ignoredNewKeywordTokens.has(token) ||
          registeredKeywords.has(token) ||
          vehicleKeywordBlocklist.has(token) ||
          /^\d+$/.test(token) ||
          /^[가-힣]$/.test(token) ||
          /^[a-z]{1,2}$/.test(token) ||
          /^[0-9]+[a-z가-힣]+$/i.test(token)
        ) {
          return;
        }

        const candidateKey = "new-keyword:" + token;
        const aggregate = aggregates.get(candidateKey) ?? {
          exampleSentences: [],
          keyword: /^[a-z0-9+#/-]+$/.test(token) ? token.toUpperCase() : token,
          mentionCount: 0,
          modelReviewCounts: new Map<string, number>(),
          previousReviewCount: 0,
          recentMentionCount: 0,
          recentReviewCount: 0,
          relatedModels: new Set<string>(),
          targetBrand,
          targetGeneration,
          targetModel,
          totalReviewCount: 0,
        };
        const tokenMentionCount = getReviewContentTokens(content).filter(
          (item) => item === token,
        ).length;

        aggregate.mentionCount += tokenMentionCount;
        aggregate.totalReviewCount += 1;
        if (isRecent) {
          aggregate.recentMentionCount += tokenMentionCount;
          aggregate.recentReviewCount += 1;
        }
        if (isPrevious) aggregate.previousReviewCount += 1;
        if (modelLabel) {
          aggregate.relatedModels.add(modelLabel);
          aggregate.modelReviewCounts.set(
            modelLabel,
            (aggregate.modelReviewCounts.get(modelLabel) ?? 0) + 1,
          );
        }
        if (aggregate.exampleSentences.length < 3) {
          aggregate.exampleSentences.push(
            ...getReviewExampleSentences(content, token).slice(
              0,
              3 - aggregate.exampleSentences.length,
            ),
          );
        }
        aggregates.set(candidateKey, aggregate);
      });
    });

  return Array.from(aggregates.entries())
    .map<AdminDashboardAiCandidate | null>(([candidateKey, aggregate]) => {
      const recentGrowthRate =
        aggregate.previousReviewCount > 0
          ? Math.round(
              ((aggregate.recentReviewCount - aggregate.previousReviewCount) /
                aggregate.previousReviewCount) *
                100,
            )
          : aggregate.recentReviewCount > 0
            ? 100
            : null;
      const hasSpecificModelRepeat = Array.from(
        aggregate.modelReviewCounts.values(),
      ).some((count) => count >= 3);
      const isCandidate =
        aggregate.recentReviewCount >= 3 ||
        aggregate.totalReviewCount >= 5 ||
        ((recentGrowthRate ?? 0) >= 100 &&
          aggregate.recentReviewCount >= 2 &&
          aggregate.mentionCount >= 2) ||
        hasSpecificModelRepeat;
      const statusRow = statusMap.get(candidateKey);
      const exampleText = aggregate.exampleSentences.join(" ");
      const recommendedCategory = guessNewKeywordCategory(
        aggregate.keyword,
        exampleText,
      );

      if (!isCandidate && !statusRow) {
        return null;
      }

      return {
        candidateKey,
        exampleSentences: Array.from(new Set(aggregate.exampleSentences)).slice(
          0,
          3,
        ),
        keyword: aggregate.keyword,
        mentionCount: aggregate.mentionCount,
        recentMentionCount: aggregate.recentMentionCount,
        recommendedCategory,
        relatedModels: Array.from(aggregate.relatedModels),
        reason: hasSpecificModelRepeat
          ? "특정 차종 후기 본문에서 반복적으로 등장하고 아직 키워드 사전에 없습니다."
          : "후기 본문에서 반복적으로 등장하지만 아직 키워드 사전에 등록되지 않았습니다.",
        source: "review" as const,
        status: statusRow?.status ?? "pending",
        suggestedUpdates: [],
        evidence: {
          keywordMentionCount: aggregate.mentionCount,
          recentGrowthRate,
          reviewCount: aggregate.totalReviewCount,
          viewCount: null,
        },
        targetBrand: aggregate.targetBrand,
        targetGeneration: aggregate.targetGeneration,
        targetModel: aggregate.targetModel,
        updatedAt: statusRow?.updated_at ?? null,
        updatedBy: statusRow?.updated_by ?? null,
        updatedByNickname: statusRow?.updated_by_nickname ?? null,
      } satisfies AdminDashboardAiCandidate;
    })
    .filter((candidate): candidate is AdminDashboardAiCandidate => candidate !== null)
    .filter((candidate) => candidate.status !== "applied")
    .sort(
      (left, right) =>
        (right.recentMentionCount ?? 0) - (left.recentMentionCount ?? 0) ||
        right.mentionCount - left.mentionCount ||
        left.keyword.localeCompare(right.keyword, "ko"),
    )
    .slice(0, 50);
};

const createAiCandidatesFromReviewContent = (
  reviews: AdminReview[],
  statusRows: AdminAiCandidateStatusRow[],
) => {
  const statusMap = getCandidateStatusMap(statusRows);
  const now = Date.now();
  const recentStart = now - 30 * 24 * 60 * 60 * 1000;
  const previousStart = now - 60 * 24 * 60 * 60 * 1000;
  const aggregates = new Map<
    string,
    {
      keyword: string;
      mentionCount: number;
      previousReviewCount: number;
      recentReviewCount: number;
      relatedModels: Set<string>;
      targetBrand: string;
      targetGeneration: string;
      targetModel: string;
      totalReviewCount: number;
    }
  >();

  reviews
    .filter((review) => !review.is_hidden)
    .forEach((review) => {
      const content = review.content ?? "";
      const keywords = extractVehicleIssueKeywords(content);
      const targetBrand = getReviewSnapshotValue(review, ["brand", "manufacturer"]);
      const targetModel = getReviewSnapshotValue(review, ["model"]);
      const targetGeneration = getReviewSnapshotValue(review, [
        "generation",
        "modelDetail",
      ]);
      const modelLabel = [targetBrand, targetModel, targetGeneration]
        .filter(Boolean)
        .join(" ")
        .trim();
      const createdAt = Date.parse(review.created_at);
      const isRecent = !Number.isNaN(createdAt) && createdAt >= recentStart;
      const isPrevious =
        !Number.isNaN(createdAt) &&
        createdAt >= previousStart &&
        createdAt < recentStart;

      if (!targetBrand || !targetModel) {
        return;
      }

      keywords.forEach((keyword) => {
        const candidateKey = [
          "review",
          normalizeVehicleIssueKeyword(targetBrand),
          normalizeVehicleIssueKeyword(targetModel),
          normalizeVehicleIssueKeyword(keyword),
        ].join(":");
        const aggregate = aggregates.get(candidateKey) ?? {
          keyword,
          mentionCount: 0,
          previousReviewCount: 0,
          recentReviewCount: 0,
          relatedModels: new Set<string>(),
          targetBrand,
          targetGeneration,
          targetModel,
          totalReviewCount: 0,
        };

        aggregate.mentionCount += countVehicleIssueKeywordMentions(content, keyword);
        aggregate.totalReviewCount += 1;
        if (isRecent) aggregate.recentReviewCount += 1;
        if (isPrevious) aggregate.previousReviewCount += 1;
        if (modelLabel) aggregate.relatedModels.add(modelLabel);
        aggregates.set(candidateKey, aggregate);
      });
    });

  return Array.from(aggregates.entries())
    .filter(([, aggregate]) => aggregate.mentionCount >= 1)
    .map(([candidateKey, aggregate]) => {
      const recentGrowthRate =
        aggregate.previousReviewCount > 0
          ? Math.round(
              ((aggregate.recentReviewCount - aggregate.previousReviewCount) /
                aggregate.previousReviewCount) *
                100,
            )
          : aggregate.recentReviewCount > 0
            ? 100
            : null;

      const statusRow = statusMap.get(candidateKey);

      return {
        candidateKey,
        keyword: aggregate.keyword,
        mentionCount: aggregate.mentionCount,
        relatedModels: Array.from(aggregate.relatedModels),
        reason: `후기 본문에서 '${aggregate.keyword}' 관련 표현이 반복되어 차량 DB 업데이트 후보로 분류됐습니다.`,
        source: "review" as const,
        status: statusRow?.status ?? "reviewing",
        suggestedUpdates: [
          `대표 키워드에 '${aggregate.keyword}' 추가 검토`,
          `기본 점검항목에 '${aggregate.keyword}' 관련 확인 항목 추가 검토`,
          `AI 한줄평에 '${aggregate.keyword}' 언급 증가 반영 검토`,
        ],
        evidence: {
          keywordMentionCount: aggregate.mentionCount,
          recentGrowthRate,
          reviewCount:
            aggregate.recentReviewCount > 0
              ? aggregate.recentReviewCount
              : aggregate.totalReviewCount,
          viewCount: null,
        },
        targetBrand: aggregate.targetBrand,
        targetGeneration: aggregate.targetGeneration,
        targetModel: aggregate.targetModel,
        updatedAt: statusRow?.updated_at ?? null,
        updatedBy: statusRow?.updated_by ?? null,
        updatedByNickname: statusRow?.updated_by_nickname ?? null,
      } satisfies AdminDashboardAiCandidate;
    })
    .sort(
      (left, right) =>
        right.mentionCount - left.mentionCount ||
        left.keyword.localeCompare(right.keyword, "ko"),
    )
    .slice(0, 30);
};

export default function AdminPage() {
  const router = useRouter();
  const {
    isAdmin,
    isAuthenticated,
    isAuthReady,
    isProfileReady,
    isSuperAdmin,
    profile,
    session,
    user,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [trafficStats, setTrafficStats] =
    useState<AdminTrafficStats>(emptyTrafficStats);
  const [operatorDashboardData, setOperatorDashboardData] =
    useState<AdminOperatorDashboardData>(emptyOperatorDashboardData);
  const [activeDashboardTab, setActiveDashboardTab] =
    useState<DashboardBoardTab>("traffic");
  const [dashboardPeriod, setDashboardPeriod] =
    useState<DashboardPeriod>("30days");
  const [dashboardViewFilter, setDashboardViewFilter] =
    useState<DashboardViewFilter>("vehicle");
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [notices, setNotices] = useState<AdminCommunityPost[]>([]);
  const [popupNotices, setPopupNotices] = useState<AdminPopupNotice[]>([]);
  const [knowledgeTerms, setKnowledgeTerms] = useState<AdminKnowledgeTerm[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [postSearch, setPostSearch] = useState("");
  const [postCategoryFilter, setPostCategoryFilter] =
    useState<CommunityBoardFilter>("all");
  const [postPage, setPostPage] = useState(1);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [selectedPopupNoticeId, setSelectedPopupNoticeId] = useState<
    string | null
  >(null);
  const [selectedKnowledgeTermId, setSelectedKnowledgeTermId] = useState<
    string | null
  >(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewAuthorFilter, setReviewAuthorFilter] = useState("");
  const [reviewDateFilter, setReviewDateFilter] =
    useState<ReviewDateFilter>("all");
  const [reviewDealerFilter, setReviewDealerFilter] =
    useState<ReviewDealerFilter>("all");
  const [reviewFuelFilter, setReviewFuelFilter] = useState("");
  const [reviewModelFilter, setReviewModelFilter] = useState("");
  const [reviewPlateFilter, setReviewPlateFilter] = useState("");
  const [reviewReportFilter, setReviewReportFilter] =
    useState<ReviewReportFilter>("all");
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>("latest");
  const [reviewVisibilityFilter, setReviewVisibilityFilter] =
    useState<ReviewVisibilityFilter>("all");
  const [reviewPage, setReviewPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [noticeSearch, setNoticeSearch] = useState("");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeSort, setKnowledgeSort] =
    useState<KnowledgeSortOption>("updated_desc");
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isVerifiedDealerFeatureReady, setIsVerifiedDealerFeatureReady] =
    useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<string[]>([]);
  const [selectedPopupNoticeIds, setSelectedPopupNoticeIds] = useState<
    string[]
  >([]);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [activeAiManagementTab, setActiveAiManagementTab] =
    useState<AiManagementTab>("keywords");
  const [aiKeywordRules, setAiKeywordRules] = useState<AdminAiKeywordRule[]>(
    () =>
      readStoredAdminRules(
        aiKeywordStorageKey,
        createInitialAiKeywordRules(),
      ),
  );
  const [aiMaintenanceRules, setAiMaintenanceRules] = useState<
    AdminAiMaintenanceRule[]
  >(() =>
    readStoredAdminRules(aiMaintenanceStorageKey, initialAiMaintenanceRules),
  );
  const [aiCandidateStatusRows, setAiCandidateStatusRows] = useState<
    AdminAiCandidateStatusRow[]
  >([]);

  const hasProfile = Boolean(profile);
  const isCheckingRole =
    isAuthReady && isAuthenticated && (!isProfileReady || !hasProfile);
  const canAccess =
    isAuthReady && isAuthenticated && isProfileReady && hasProfile && isAdmin;
  useEffect(() => {
    window.localStorage.setItem(
      aiKeywordStorageKey,
      JSON.stringify(aiKeywordRules),
    );
  }, [aiKeywordRules]);
  useEffect(() => {
    window.localStorage.setItem(
      aiMaintenanceStorageKey,
      JSON.stringify(aiMaintenanceRules),
    );
  }, [aiMaintenanceRules]);
  const selectedPosts = useMemo(
    () => posts.filter((post) => selectedPostIds.includes(post.id)),
    [posts, selectedPostIds],
  );
  const visiblePosts = useMemo(
    () =>
      posts
        .filter((post) => {
          if (postCategoryFilter === "all") {
            return true;
          }

          if (postCategoryFilter === "notice") {
            return post.is_notice;
          }

          return !post.is_notice && post.category === postCategoryFilter;
        })
        .sort(
          (left, right) =>
            Date.parse(right.created_at) - Date.parse(left.created_at),
        ),
    [postCategoryFilter, posts],
  );
  const totalPostPages = Math.max(
    1,
    Math.ceil(visiblePosts.length / adminPostsPerPage),
  );
  const currentPostPage = Math.min(postPage, totalPostPages);
  const paginatedPosts = useMemo(
    () =>
      visiblePosts.slice(
        (currentPostPage - 1) * adminPostsPerPage,
        currentPostPage * adminPostsPerPage,
      ),
    [currentPostPage, visiblePosts],
  );
  const selectedVisiblePosts = useMemo(
    () => paginatedPosts.filter((post) => selectedPostIds.includes(post.id)),
    [paginatedPosts, selectedPostIds],
  );
  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );
  const selectedNotice = useMemo(
    () => notices.find((notice) => notice.id === selectedNoticeId) ?? null,
    [notices, selectedNoticeId],
  );
  const selectedPopupNotice = useMemo(
    () =>
      popupNotices.find((notice) => notice.id === selectedPopupNoticeId) ??
      null,
    [popupNotices, selectedPopupNoticeId],
  );
  const selectedKnowledgeTerm = useMemo(
    () =>
      knowledgeTerms.find((term) => term.id === selectedKnowledgeTermId) ?? null,
    [knowledgeTerms, selectedKnowledgeTermId],
  );
  const selectedReviews = useMemo(
    () => reviews.filter((review) => selectedReviewIds.includes(review.id)),
    [reviews, selectedReviewIds],
  );
  const selectedReview = useMemo(
    () => reviews.find((review) => review.id === selectedReviewId) ?? null,
    [reviews, selectedReviewId],
  );
  const selectedUser = useMemo(
    () => users.find((account) => account.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );
  const selectedReport = useMemo(
    () => reports.find((report) => report.report_id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );
  const userProfileMap = useMemo(
    () => new Map(users.map((account) => [account.id, account])),
    [users],
  );
  const sortedReviews = useMemo(
    () => {
      const searchText = reviewSearch.trim().toLowerCase();
      const authorText = reviewAuthorFilter.trim().toLowerCase();
      const fuelText = reviewFuelFilter.trim().toLowerCase();
      const modelText = reviewModelFilter.trim().toLowerCase();
      const plateText = reviewPlateFilter.replace(/\s+/g, "").toLowerCase();
      const filteredReviews = reviews.filter((review) => {
        const plateNumber = (getReviewPlateNumber(review) ?? "").replace(
          /\s+/g,
          "",
        );
        const vehicleModel = getReviewVehicleModel(review);
        const fuelType = getReviewFuelType(review);
        const authorName =
          review.author_nickname ??
          userProfileMap.get(review.author_id ?? "")?.nickname ??
          "";
        const authorId = review.author_id ?? "";
        const authorProfile = userProfileMap.get(authorId);
        const createdAt = Date.parse(review.created_at);
        const haystack = [
          plateNumber,
          vehicleModel,
          fuelType,
          review.content,
          authorName,
          authorId,
        ]
          .join(" ")
          .toLowerCase();

        if (searchText && !haystack.includes(searchText)) return false;
        if (
          authorText &&
          ![authorName, authorId].join(" ").toLowerCase().includes(authorText)
        ) {
          return false;
        }
        if (plateText && !plateNumber.toLowerCase().includes(plateText)) {
          return false;
        }
        if (modelText && !vehicleModel.toLowerCase().includes(modelText)) {
          return false;
        }
        if (fuelText && !fuelType.toLowerCase().includes(fuelText)) {
          return false;
        }
        if (reviewVisibilityFilter === "visible" && review.is_hidden) {
          return false;
        }
        if (reviewVisibilityFilter === "hidden" && !review.is_hidden) {
          return false;
        }
        if (reviewReportFilter === "reported" && review.report_count <= 0) {
          return false;
        }
        if (reviewReportFilter === "clean" && review.report_count > 0) {
          return false;
        }
        if (
          reviewDealerFilter === "dealer" &&
          !authorProfile?.is_verified_dealer
        ) {
          return false;
        }
        if (
          reviewDealerFilter === "member" &&
          authorProfile?.is_verified_dealer
        ) {
          return false;
        }
        if (reviewDateFilter !== "all") {
          const dayMs = 24 * 60 * 60 * 1000;
          const rangeMs =
            reviewDateFilter === "today"
              ? dayMs
              : reviewDateFilter === "7days"
                ? 7 * dayMs
                : 30 * dayMs;

          if (
            Number.isNaN(createdAt) ||
            aiCandidateArchiveReferenceTime - createdAt > rangeMs
          ) {
            return false;
          }
        }

        return true;
      });

      return filteredReviews.sort((left, right) => {
        if (reviewSort === "oldest") {
          return Date.parse(left.created_at) - Date.parse(right.created_at);
        }

        if (reviewSort === "reports") {
          return (
            right.report_count - left.report_count ||
            Date.parse(right.created_at) - Date.parse(left.created_at)
          );
        }

        if (reviewSort === "plate") {
          return (getReviewPlateNumber(left) ?? "").localeCompare(
            getReviewPlateNumber(right) ?? "",
            "ko",
          );
        }

        if (reviewSort === "model") {
          return getReviewVehicleModel(left).localeCompare(
            getReviewVehicleModel(right),
            "ko",
          );
        }

        if (reviewSort === "author") {
          const leftAuthor = left.author_nickname ?? left.author_id ?? "";
          const rightAuthor = right.author_nickname ?? right.author_id ?? "";

          return leftAuthor.localeCompare(rightAuthor, "ko");
        }

        return Date.parse(right.created_at) - Date.parse(left.created_at);
      });
    },
    [
      reviewAuthorFilter,
      reviewDateFilter,
      reviewDealerFilter,
      reviewFuelFilter,
      reviewModelFilter,
      reviewPlateFilter,
      reviewReportFilter,
      reviewSearch,
      reviewSort,
      reviewVisibilityFilter,
      reviews,
      userProfileMap,
    ],
  );
  const totalReviewPages = Math.max(
    1,
    Math.ceil(sortedReviews.length / adminReviewsPerPage),
  );
  const currentReviewPage = Math.min(reviewPage, totalReviewPages);
  const paginatedReviews = useMemo(
    () =>
      sortedReviews.slice(
        (currentReviewPage - 1) * adminReviewsPerPage,
        currentReviewPage * adminReviewsPerPage,
      ),
    [currentReviewPage, sortedReviews],
  );
  const selectedVisibleReviews = useMemo(
    () =>
      paginatedReviews.filter((review) => selectedReviewIds.includes(review.id)),
    [paginatedReviews, selectedReviewIds],
  );
  const selectedReports = useMemo(
    () =>
      reports.filter((report) => selectedReportIds.includes(report.report_id)),
    [reports, selectedReportIds],
  );
  const allPostsSelected =
    paginatedPosts.length > 0 &&
    selectedVisiblePosts.length === paginatedPosts.length;
  const allNoticesSelected =
    notices.length > 0 &&
    notices.every((notice) => selectedNoticeIds.includes(notice.id));
  const allPopupNoticesSelected =
    popupNotices.length > 0 &&
    popupNotices.every((notice) =>
      selectedPopupNoticeIds.includes(notice.id),
    );
  const allReviewsSelected =
    paginatedReviews.length > 0 &&
    selectedVisibleReviews.length === paginatedReviews.length;
  const allReportsSelected =
    reports.length > 0 && selectedReports.length === reports.length;
  const sessionAccessToken = session?.access_token ?? "";
  const activeSearch = useMemo(() => {
    if (activeTab === "posts") return postSearch;
    if (activeTab === "reviews") return reviewSearch;
    if (activeTab === "users") return userSearch;
    if (activeTab === "ai") return globalSearch;
    if (activeTab === "knowledge") return knowledgeSearch;
    if (activeTab === "reports") return reportSearch;
    if (activeTab === "notices") return noticeSearch;
    return "";
  }, [
    activeTab,
    globalSearch,
    knowledgeSearch,
    noticeSearch,
    postSearch,
    reportSearch,
    reviewSearch,
    userSearch,
  ]);
  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const todayReviews = useMemo(
    () => reviews.filter((review) => Date.parse(review.created_at) >= todayStart),
    [reviews, todayStart],
  );
  const yesterdayReviews = useMemo(
    () =>
      reviews.filter((review) => {
        const createdAt = Date.parse(review.created_at);
        return createdAt >= yesterdayStart && createdAt < todayStart;
      }),
    [reviews, todayStart, yesterdayStart],
  );
  const todayUsers = useMemo(
    () => users.filter((account) => Date.parse(account.created_at) >= todayStart),
    [todayStart, users],
  );
  const todayPosts = useMemo(
    () => posts.filter((post) => Date.parse(post.created_at) >= todayStart),
    [posts, todayStart],
  );
  const todayReports = useMemo(
    () => reports.filter((report) => Date.parse(report.created_at) >= todayStart),
    [reports, todayStart],
  );
  const pendingReports = useMemo(
    () => reports.filter((report) => !report.is_hidden),
    [reports],
  );
  const reviewingAiCandidates = useMemo(
    () =>
      operatorDashboardData.aiCandidates.filter(
        (candidate) => candidate.status === "reviewing",
      ),
    [operatorDashboardData.aiCandidates],
  );
  const newKeywordCandidates = useMemo(
    () =>
      createNewKeywordCandidatesFromReviewContent(
        reviews,
        aiCandidateStatusRows,
        aiKeywordRules,
      ),
    [aiCandidateStatusRows, aiKeywordRules, reviews],
  );
  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const matches = (value: string | null | undefined) =>
      value?.toLowerCase().includes(query) ?? false;
    const reviewResults = reviews
      .filter((review) =>
        [
          getReviewPlateNumber(review),
          getReviewVehicleModel(review),
          review.author_nickname,
          review.content,
        ].some(matches),
      )
      .slice(0, 4)
      .map((review) => ({
        id: review.id,
        label: getReviewPlateNumber(review) ?? "후기",
        meta: "후기 · " + getReviewVehicleModel(review),
        tab: "reviews" as AdminTab,
      }));
    const postResults = posts
      .filter((post) =>
        [post.title, post.content, post.author_nickname].some(matches),
      )
      .slice(0, 4)
      .map((post) => ({
        id: post.id,
        label: post.title,
        meta: "게시글 · " + getPostCategoryLabel(post),
        tab: "posts" as AdminTab,
      }));
    const userResults = users
      .filter((account) =>
        [
          account.nickname,
          account.email,
          account.provider_profile_name,
          account.id,
        ].some(matches),
      )
      .slice(0, 4)
      .map((account) => ({
        id: account.id,
        label: account.nickname ?? formatCompactId(account.id, 8),
        meta: "회원 · " + formatProviderLabel(account.login_provider),
        tab: "users" as AdminTab,
      }));

    return [...reviewResults, ...postResults, ...userResults].slice(0, 8);
  }, [globalSearch, posts, reviews, users]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login?redirect=/admin");
      return;
    }

    if (!isProfileReady || !hasProfile) {
      return;
    }

    if (!isAdmin) {
      void Promise.resolve().then(() => setIsAccessDenied(true));
      const timeoutId = window.setTimeout(() => {
        router.replace("/");
      }, 1600);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [
    hasProfile,
    isAuthReady,
    isAuthenticated,
    isProfileReady,
    isAdmin,
    isSuperAdmin,
    router,
  ]);

  const loadAdminData = useCallback(async () => {
    if (!supabase || !canAccess) {
      return;
    }

    setIsLoading(true);
    setActionMessage("");

    try {
      const accessToken = sessionAccessToken;
      const statusRowsPromise = accessToken
        ? fetch("/api/admin/ai-candidates", {
            headers: {
              Authorization: "Bearer " + accessToken,
            },
          })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) =>
              Array.isArray(payload?.statuses)
                ? (payload.statuses as AdminAiCandidateStatusRow[]).map(
                    (row) => ({
                      ...row,
                      source: normalizeAiCandidateSource(row.source),
                      status: normalizeAiCandidateStatus(row.status),
                      updated_by: toNullableString(row.updated_by),
                      updated_by_nickname: toNullableString(
                        row.updated_by_nickname,
                      ),
                    }),
                  )
                : [],
            )
            .catch(() => [] as AdminAiCandidateStatusRow[])
        : Promise.resolve([] as AdminAiCandidateStatusRow[]);
      const [
        statsResult,
        postsResult,
        reviewsResult,
        usersResult,
        reportsResult,
        noticesResult,
        popupNoticesResult,
        knowledgeTermsResult,
        trafficStatsResult,
        operatorDashboardResult,
        verifiedDealerFeatureResult,
        aiCandidateStatusRows,
      ] = await Promise.all([
        supabase.rpc("admin_get_dashboard_stats"),
        supabase.rpc("admin_list_community_posts", {
          search_text: postSearch.trim(),
        }),
        supabase.rpc("admin_list_reviews", {
          search_text: reviewSearch.trim(),
        }),
        supabase.rpc("admin_list_user_profiles", {
          search_text: userSearch.trim(),
        }),
        supabase.rpc("admin_list_reports", {
          search_text: reportSearch.trim(),
        }),
        supabase.rpc("admin_list_community_posts", {
          search_text: noticeSearch.trim(),
        }),
        supabase.rpc("admin_list_popup_notices", {
          search_text: noticeSearch.trim(),
        }),
        supabase.rpc("admin_list_knowledge_terms", {
          search_text: knowledgeSearch.trim(),
          sort_key: knowledgeSort,
        }),
        supabase.rpc("admin_get_traffic_stats"),
        supabase.rpc("admin_get_operator_dashboard_data"),
        supabase.rpc("list_verified_dealer_profiles", {
          target_user_ids: [],
        }),
        statusRowsPromise,
      ]);

      if (statsResult.error) throw statsResult.error;
      if (postsResult.error) throw postsResult.error;
      if (reviewsResult.error) throw reviewsResult.error;
      if (usersResult.error) throw usersResult.error;
      if (reportsResult.error) throw reportsResult.error;
      if (noticesResult.error) throw noticesResult.error;
      if (popupNoticesResult.error) throw popupNoticesResult.error;
      const isKnowledgeRpcMissing =
        knowledgeTermsResult.error?.message.includes(
          "admin_list_knowledge_terms",
        ) ||
        knowledgeTermsResult.error?.message.includes("knowledge_terms");

      if (knowledgeTermsResult.error && !isKnowledgeRpcMissing) {
        throw knowledgeTermsResult.error;
      }
      if (trafficStatsResult.error) throw trafficStatsResult.error;

      setIsVerifiedDealerFeatureReady(!verifiedDealerFeatureResult.error);

      const nextStats = statsResult.data?.[0];
      const nextTrafficStats = trafficStatsResult.data?.[0];
      const nextOperatorDashboard = operatorDashboardResult.error
        ? null
        : operatorDashboardResult.data?.[0];

      setStats({
        comments: Number(nextStats?.comments_count ?? 0),
        communityPosts: Number(nextStats?.community_posts_count ?? 0),
        reports: Number(nextStats?.reports_count ?? 0),
        reviews: Number(nextStats?.reviews_count ?? 0),
        users: Number(nextStats?.users_count ?? 0),
      });
      setTrafficStats({
        todayVisitors: Number(nextTrafficStats?.today_visitors ?? 0),
        sevenDayVisitors: Number(nextTrafficStats?.seven_day_visitors ?? 0),
        thirtyDayVisitors: Number(nextTrafficStats?.thirty_day_visitors ?? 0),
        totalVisitors: Number(nextTrafficStats?.total_visitors ?? 0),
        todayReviews: Number(nextTrafficStats?.today_reviews_count ?? 0),
        totalReviews: Number(nextTrafficStats?.total_reviews_count ?? 0),
        totalUsers: Number(nextTrafficStats?.total_users_count ?? 0),
        topVehicles: toTrafficTopVehicles(nextTrafficStats?.top_vehicles ?? []),
        topModels: toTrafficTopModels(nextTrafficStats?.top_models ?? []),
        topReviews: toTrafficTopReviews(nextTrafficStats?.top_reviews ?? []),
        deviceBreakdown: toTrafficBreakdownItems(
          nextTrafficStats?.device_breakdown ?? [],
        ),
        browserBreakdown: toTrafficBreakdownItems(
          nextTrafficStats?.browser_breakdown ?? [],
        ),
        osBreakdown: toTrafficBreakdownItems(
          nextTrafficStats?.os_breakdown ?? [],
        ),
        referrerTop: toTrafficBreakdownItems(
          nextTrafficStats?.referrer_top ?? [],
        ),
        pathTop: toTrafficBreakdownItems(nextTrafficStats?.path_top ?? []),
        hourlyVisitors: toTrafficTimeItems(
          nextTrafficStats?.hourly_visitors ?? [],
        ),
        dailyVisitors: toTrafficTimeItems(
          nextTrafficStats?.daily_visitors ?? [],
        ),
      });
      const nextReviews = (reviewsResult.data ?? []) as AdminReview[];
      setAiCandidateStatusRows(aiCandidateStatusRows);
      setOperatorDashboardData({
        totalViews: toNumber(nextOperatorDashboard?.total_views),
        trafficRows: toOperatorTrafficRows(
          nextOperatorDashboard?.traffic_rows ?? [],
        ),
        viewRankings: toOperatorViewRankings(
          nextOperatorDashboard?.view_rankings ?? [],
        ),
        keywordRows: toOperatorAcquisitionKeywordRows(
          nextOperatorDashboard?.keyword_rows ?? [],
        ),
        acquisitionRows: toOperatorAcquisitionEventRows(
          nextOperatorDashboard?.acquisition_rows ?? [],
        ),
        searchConsoleSummary: toOperatorSearchConsoleSummary(
          nextOperatorDashboard?.search_console_summary ?? {},
        ),
        internalKeywordRows: toOperatorKeywordRows(
          nextOperatorDashboard?.internal_keyword_rows ?? [],
        ),
        aiCandidates: createAiCandidatesFromReviewContent(
          nextReviews,
          aiCandidateStatusRows,
        ),
      });
      setPosts((postsResult.data ?? []) as AdminCommunityPost[]);
      setReviews(nextReviews);
      setUsers((usersResult.data ?? []) as AdminUserProfile[]);
      setReports((reportsResult.data ?? []) as AdminReport[]);
      setNotices(
        ((noticesResult.data ?? []) as AdminCommunityPost[]).filter(
          (notice) => notice.is_notice,
        ),
      );
      setPopupNotices((popupNoticesResult.data ?? []) as AdminPopupNotice[]);
      setKnowledgeTerms(
        (knowledgeTermsResult.error
          ? []
          : ((knowledgeTermsResult.data ?? []) as AdminKnowledgeTerm[])).map(
          normalizeAdminKnowledgeTerm,
        ),
      );
      setSelectedPostIds([]);
      setSelectedNoticeIds([]);
      setSelectedPopupNoticeIds([]);
      setSelectedReviewIds([]);
      setSelectedReportIds([]);
    } catch (error) {
      setActionMessage(
        getErrorMessage(error, "관리자 데이터를 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    canAccess,
    knowledgeSearch,
    knowledgeSort,
    noticeSearch,
    postSearch,
    reportSearch,
    reviewSearch,
    sessionAccessToken,
    userSearch,
  ]);

  useEffect(() => {
    if (!canAccess) {
      return;
    }

    void Promise.resolve().then(loadAdminData);
  }, [canAccess, loadAdminData]);

  const refreshCurrentTab = async () => {
    await loadAdminData();
  };

  const updateAiCandidateStatus = async (
    candidate: AdminDashboardAiCandidate,
    nextStatus: AiCandidateStatus,
  ) => {
    const accessToken = sessionAccessToken;

    if (!accessToken) {
      setActionMessage("로그인 세션을 확인하지 못했습니다.");
      return;
    }

    setActionMessage("");
    const updatedAt = new Date().toISOString();
    setOperatorDashboardData((current) => ({
      ...current,
      aiCandidates: current.aiCandidates.map((item) =>
        item.candidateKey === candidate.candidateKey
          ? {
              ...item,
              status: nextStatus,
              updatedAt,
              updatedBy: user?.id ?? null,
              updatedByNickname: profile?.nickname ?? user?.email ?? null,
            }
          : item,
      ),
      internalKeywordRows: current.internalKeywordRows.map((item) =>
        "keyword:" + item.keyword === candidate.candidateKey
          ? { ...item, aiStatus: nextStatus }
          : item,
      ),
    }));
    setAiCandidateStatusRows((current) => {
      const nextRow: AdminAiCandidateStatusRow = {
        candidate_key: candidate.candidateKey,
        candidate_keyword: candidate.keyword,
        related_models: candidate.relatedModels,
        source: candidate.source,
        status: nextStatus,
        updated_at: updatedAt,
        updated_by: user?.id ?? null,
        updated_by_nickname: profile?.nickname ?? user?.email ?? null,
      };

      return current.some((row) => row.candidate_key === candidate.candidateKey)
        ? current.map((row) =>
            row.candidate_key === candidate.candidateKey ? nextRow : row,
          )
        : [nextRow, ...current];
    });

    const response = await fetch("/api/admin/ai-candidates", {
      body: JSON.stringify({
        candidateKey: candidate.candidateKey,
        keyword: candidate.keyword,
        relatedModels: candidate.relatedModels,
        source: candidate.source,
        status: nextStatus,
        targetBrand: candidate.targetBrand,
        targetGeneration: candidate.targetGeneration,
        targetModel: candidate.targetModel,
      }),
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setActionMessage(
        typeof payload?.error === "string"
          ? payload.error
          : "AI 후보 상태를 변경하지 못했습니다.",
      );
      await loadAdminData();
      return;
    }

    setActionMessage(
      nextStatus === "applied"
        ? "키워드 등록 완료 상태로 처리했습니다."
        : "AI 추천 상태를 변경했습니다.",
    );
    await loadAdminData();
  };

  const registerNewKeywordCandidate = async (
    candidate: AdminDashboardAiCandidate,
    values: AdminNewKeywordCandidateFormValues,
  ) => {
    if (values.excludeCandidate) {
      await updateAiCandidateStatus(candidate, "excluded");
      return;
    }

    if (!values.registerAsRepresentative || !values.label.trim()) {
      setActionMessage("대표 키워드를 입력해주세요.");
      return;
    }

    const normalizedLabel = normalizeVehicleIssueKeyword(values.label);
    const nextIncludeKeywords = values.registerAsIncludeKeyword
      ? splitAdminListInput(values.includeKeywords)
      : [];
    const existingRule = aiKeywordRules.find(
      (rule) => normalizeVehicleIssueKeyword(rule.label) === normalizedLabel,
    );

    if (existingRule) {
      setAiKeywordRules((currentRules) =>
        currentRules.map((rule) =>
          rule.id === existingRule.id
            ? {
                ...rule,
                includeKeywords: Array.from(
                  new Set([...rule.includeKeywords, ...nextIncludeKeywords]),
                ),
              }
            : rule,
        ),
      );
    } else {
      const nextRule: AdminAiKeywordRule = {
        category: candidate.recommendedCategory ?? "후기 반복 신규 키워드",
        excludeKeywords: [],
        fuelType: "",
        id: "auto-keyword-" + Date.now(),
        includeKeywords: nextIncludeKeywords.length
          ? nextIncludeKeywords
          : [values.label.trim()],
        isDefaultMaintenance: false,
        isVisible: values.isVisible,
        label: values.label.trim(),
        memo: values.memo.trim() || "신규 키워드 자동감지에서 등록",
        targetModel: "",
      };

      setAiKeywordRules((currentRules) => [nextRule, ...currentRules]);
    }

    await updateAiCandidateStatus(candidate, "applied");
  };

  const upsertKnowledgeTerm = async (
    values: AdminKnowledgeTermFormValues,
    term?: AdminKnowledgeTerm,
  ) => {
    if (!supabase) {
      return;
    }

    if (!values.representativeName.trim()) {
      setActionMessage("대표 키워드를 입력해주세요.");
      return;
    }

    const nextSlug = normalizeKnowledgeSlug(values.slug);

    if (!isValidKnowledgeSlug(nextSlug)) {
      setActionMessage("slug는 소문자 영문, 숫자, 하이픈만 사용할 수 있습니다.");
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_upsert_knowledge_term", {
      next_category: values.category,
      next_description: values.description,
      next_expected_repair_cost: values.expectedRepairCost,
      next_is_visible: values.isVisible,
      next_maintenance_tips: splitAdminListInput(values.maintenanceTips),
      next_main_causes: splitAdminListInput(values.mainCauses),
      next_main_symptoms: splitAdminListInput(values.mainSymptoms),
      next_priority: Math.max(0, Math.floor(Number(values.priority) || 0)),
      next_related_keywords: splitAdminListInput(values.relatedKeywords),
      next_related_models: splitAdminListInput(values.relatedModels),
      next_representative_name: values.representativeName.trim(),
      next_slug: nextSlug,
      target_term_id: term?.id ?? null,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("Knowledge 항목을 저장하지 못했습니다.");
      return;
    }

    setActionMessage(
      term ? "Knowledge 항목을 수정했습니다." : "Knowledge 항목을 추가했습니다.",
    );
    await loadAdminData();
  };

  const toggleKnowledgeTermVisible = async (term: AdminKnowledgeTerm) => {
    if (!supabase) {
      return;
    }

    setActionMessage("");

    const { error } = await supabase.rpc("admin_upsert_knowledge_term", {
      next_category: term.category,
      next_description: term.description,
      next_expected_repair_cost: term.expected_repair_cost,
      next_is_visible: !term.is_visible,
      next_maintenance_tips: term.maintenance_tips,
      next_main_causes: term.main_causes,
      next_main_symptoms: term.main_symptoms,
      next_priority: term.priority,
      next_related_keywords: term.related_keywords,
      next_related_models: term.related_models,
      next_representative_name: term.representative_name,
      next_slug: term.slug,
      target_term_id: term.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    setActionMessage("Knowledge 노출 상태를 변경했습니다.");
    await loadAdminData();
  };

  const deleteKnowledgeTerm = async (term: AdminKnowledgeTerm) => {
    if (!supabase || !window.confirm("Knowledge 항목을 삭제하시겠습니까?")) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_delete_knowledge_term", {
      target_term_id: term.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 Knowledge 항목을 찾지 못했습니다.");
      return;
    }

    setActionMessage("Knowledge 항목을 삭제했습니다.");
    await loadAdminData();
  };

  const updatePostState = async (
    post: AdminCommunityPost,
    patch: {
      next_is_hidden?: boolean;
      next_is_notice?: boolean;
      next_is_pinned?: boolean;
    },
  ) => {
    if (!supabase) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc(
      "admin_set_community_post_state",
      {
        next_is_hidden: patch.next_is_hidden ?? null,
        next_is_notice: patch.next_is_notice ?? null,
        next_is_pinned: patch.next_is_pinned ?? null,
        target_post_id: post.id,
      },
    );

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 게시글을 찾지 못했습니다.");
      return;
    }

    setActionMessage("게시글 상태를 저장했습니다.");
    await loadAdminData();
  };

  const updatePostsHidden = async (
    targetPosts: AdminCommunityPost[],
    nextIsHidden: boolean,
  ) => {
    if (!supabase || targetPosts.length === 0) {
      return;
    }

    const client = supabase;

    setActionMessage("");

    try {
      const results = await Promise.all(
        targetPosts.map((post) =>
          client.rpc("admin_set_community_post_state", {
            next_is_hidden: nextIsHidden,
            next_is_notice: null,
            next_is_pinned: null,
            target_post_id: post.id,
          }),
        ),
      );
      const failedResult = results.find(
        (result) => result.error || !result.data,
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      if (failedResult) {
        throw new Error("일부 게시글을 찾지 못했습니다.");
      }

      setActionMessage(
        nextIsHidden
          ? "선택한 게시글을 숨김 처리했습니다."
          : "선택한 게시글 숨김을 해제했습니다.",
      );
      await loadAdminData();
    } catch (error) {
      setActionMessage(
        getErrorMessage(error, "게시글 상태를 변경하지 못했습니다."),
      );
    }
  };

  const permanentlyDeletePosts = async (targetPosts: AdminCommunityPost[]) => {
    if (!supabase || targetPosts.length === 0 || !isSuperAdmin) {
      return;
    }

    if (
      !window.confirm("영구삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?")
    ) {
      return;
    }

    if (window.prompt("영구삭제하려면 DELETE를 입력하세요.") !== "DELETE") {
      setActionMessage("영구삭제를 취소했습니다.");
      return;
    }

    const client = supabase;

    setActionMessage("");

    try {
      const results = await Promise.all(
        targetPosts.map((post) =>
          client.rpc("admin_delete_community_post", {
            target_post_id: post.id,
          }),
        ),
      );
      const failedResult = results.find(
        (result) => result.error || !result.data,
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      if (failedResult) {
        throw new Error("일부 게시글을 찾지 못했습니다.");
      }

      setActionMessage("선택한 게시글을 영구삭제했습니다.");
      await loadAdminData();
    } catch (error) {
      setActionMessage(
        getErrorMessage(error, "게시글을 영구삭제하지 못했습니다."),
      );
    }
  };

  const deletePost = async (post: AdminCommunityPost) => {
    if (!supabase || !isSuperAdmin) {
      return;
    }

    if (
      !window.confirm("영구삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?")
    ) {
      return;
    }

    if (window.prompt("영구삭제하려면 DELETE를 입력하세요.") !== "DELETE") {
      setActionMessage("영구삭제를 취소했습니다.");
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_delete_community_post", {
      target_post_id: post.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 게시글을 찾지 못했습니다.");
      return;
    }

    setActionMessage("게시글을 영구삭제했습니다.");
    await loadAdminData();
  };

  const updateReviewHidden = async (review: AdminReview) => {
    if (!supabase) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_set_review_hidden", {
      next_is_hidden: !review.is_hidden,
      target_review_id: review.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 후기를 찾지 못했습니다.");
      return;
    }

    setActionMessage("후기 숨김 상태를 저장했습니다.");
    await loadAdminData();
  };

  const updateReviewsHidden = async (
    targetReviews: AdminReview[],
    nextIsHidden: boolean,
  ) => {
    if (!supabase || targetReviews.length === 0) {
      return;
    }

    const client = supabase;

    setActionMessage("");

    try {
      const results = await Promise.all(
        targetReviews.map((review) =>
          client.rpc("admin_set_review_hidden", {
            next_is_hidden: nextIsHidden,
            target_review_id: review.id,
          }),
        ),
      );
      const failedResult = results.find(
        (result) => result.error || !result.data,
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      if (failedResult) {
        throw new Error("일부 후기를 찾지 못했습니다.");
      }

      setActionMessage(
        nextIsHidden
          ? "선택한 후기를 숨김 처리했습니다."
          : "선택한 후기 숨김을 해제했습니다.",
      );
      await loadAdminData();
    } catch (error) {
      setActionMessage(
        getErrorMessage(error, "후기 상태를 변경하지 못했습니다."),
      );
    }
  };

  const permanentlyDeleteReviews = async (targetReviews: AdminReview[]) => {
    if (!supabase || targetReviews.length === 0 || !isSuperAdmin) {
      return;
    }

    if (
      !window.confirm("영구삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?")
    ) {
      return;
    }

    if (window.prompt("영구삭제하려면 DELETE를 입력하세요.") !== "DELETE") {
      setActionMessage("영구삭제를 취소했습니다.");
      return;
    }

    const client = supabase;

    setActionMessage("");

    try {
      const results = await Promise.all(
        targetReviews.map((review) =>
          client.rpc("admin_delete_review", {
            target_review_id: review.id,
          }),
        ),
      );
      const failedResult = results.find(
        (result) => result.error || !result.data,
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      if (failedResult) {
        throw new Error("일부 후기를 찾지 못했습니다.");
      }

      setActionMessage("선택한 후기를 영구삭제했습니다.");
      await loadAdminData();
    } catch (error) {
      setActionMessage(
        getErrorMessage(error, "후기를 영구삭제하지 못했습니다."),
      );
    }
  };

  const deleteReview = async (review: AdminReview) => {
    if (!supabase || !isSuperAdmin) {
      return;
    }

    if (
      !window.confirm("영구삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?")
    ) {
      return;
    }

    if (window.prompt("영구삭제하려면 DELETE를 입력하세요.") !== "DELETE") {
      setActionMessage("영구삭제를 취소했습니다.");
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_delete_review", {
      target_review_id: review.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 후기를 찾지 못했습니다.");
      return;
    }

    setActionMessage("후기를 영구삭제했습니다.");
    await loadAdminData();
  };

  const getUniqueReportTargets = (targetReports: AdminReport[]) => {
    const targetMap = new Map<string, AdminReport>();

    targetReports.forEach((report) => {
      targetMap.set(`${report.report_type}:${report.target_id}`, report);
    });

    return Array.from(targetMap.values());
  };

  const updateReportTargetsHidden = async (
    targetReports: AdminReport[],
    nextIsHidden: boolean,
  ) => {
    if (!supabase || targetReports.length === 0) {
      return;
    }

    const targets = getUniqueReportTargets(targetReports);
    const client = supabase;

    setActionMessage("");

    try {
      const results = await Promise.all(
        targets.map((report) =>
          report.report_type === "게시글"
            ? client.rpc("admin_set_community_post_state", {
                next_is_hidden: nextIsHidden,
                next_is_notice: null,
                next_is_pinned: null,
                target_post_id: report.target_id,
              })
            : client.rpc("admin_set_review_hidden", {
                next_is_hidden: nextIsHidden,
                target_review_id: report.target_id,
              }),
        ),
      );
      const failedResult = results.find(
        (result) => result.error || !result.data,
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      if (failedResult) {
        throw new Error("일부 신고 대상을 찾지 못했습니다.");
      }

      setActionMessage(
        nextIsHidden
          ? "선택한 신고 대상을 숨김 처리했습니다."
          : "선택한 신고 대상 숨김을 해제했습니다.",
      );
      await loadAdminData();
    } catch (error) {
      setActionMessage(
        getErrorMessage(error, "신고 대상 상태를 변경하지 못했습니다."),
      );
    }
  };

  const setUserSuspended = async (account: AdminUserProfile) => {
    if (!supabase) {
      return;
    }

    const nextIsSuspended = !account.is_suspended;
    const label = nextIsSuspended ? "정지" : "해제";

    if (
      !window.confirm(
        `${account.nickname ?? account.id} 계정을 ${label}하시겠습니까?`,
      )
    ) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_set_user_suspended", {
      next_is_suspended: nextIsSuspended,
      target_user_id: account.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 회원을 찾지 못했습니다.");
      return;
    }

    setActionMessage(`회원 계정을 ${label}했습니다.`);
    await loadAdminData();
  };

  const setUserRole = async (
    account: AdminUserProfile,
    nextRole: "user" | "admin",
  ) => {
    if (!supabase) {
      return;
    }

    if (
      !window.confirm(
        `${account.nickname ?? account.id} 계정 role을 ${nextRole}(으)로 변경하시겠습니까?`,
      )
    ) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_set_user_role", {
      next_role: nextRole,
      target_user_id: account.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 회원의 role을 변경하지 못했습니다.");
      return;
    }

    setActionMessage("회원 role을 변경했습니다.");
    await loadAdminData();
  };

  const setVerifiedDealer = async (account: AdminUserProfile) => {
    if (!supabase) {
      return;
    }

    if (!isVerifiedDealerFeatureReady) {
      setActionMessage(
        "인증딜러 기능 DB 마이그레이션이 아직 적용되지 않았습니다.",
      );
      return;
    }

    const nextIsVerifiedDealer = !account.is_verified_dealer;
    const label = nextIsVerifiedDealer ? "ON" : "OFF";

    if (
      !window.confirm(
        (account.nickname ?? account.id) +
          " 인증딜러를 " +
          label +
          " 처리하시겠습니까?",
      )
    ) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc(
      "admin_set_user_verified_dealer",
      {
        next_is_verified_dealer: nextIsVerifiedDealer,
        target_user_id: account.id,
      },
    );

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 회원의 인증딜러 상태를 변경하지 못했습니다.");
      return;
    }

    setActionMessage("인증딜러를 " + label + " 처리했습니다.");
    await loadAdminData();
  };

  const grantNicknameChangeTicket = async (account: AdminUserProfile) => {
    if (!supabase) {
      return;
    }

    if (
      !window.confirm(
        (account.nickname ?? account.id) +
          " 닉네임 변경권을 1회 부여하시겠습니까?",
      )
    ) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc(
      "admin_grant_nickname_change_ticket",
      {
        grant_amount: 1,
        target_user_id: account.id,
      },
    );

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (typeof data !== "number") {
      setActionMessage("닉네임 변경권을 부여하지 못했습니다.");
      return;
    }

    setActionMessage("닉네임 변경권을 1회 부여했습니다. 현재 변경권: " + data);
    await loadAdminData();
  };

  const upsertCommunityNotice = async (notice?: AdminCommunityPost) => {
    if (!supabase) {
      return;
    }

    const nextTitle = window.prompt("공지 제목", notice?.title ?? "");

    if (nextTitle === null) {
      return;
    }

    const nextContent = window.prompt("공지 내용", notice?.content ?? "");

    if (nextContent === null) {
      return;
    }

    const nextPinned = window.confirm("상단고정 공지로 설정하시겠습니까?");

    setActionMessage("");

    const { data, error } = await supabase.rpc(
      "admin_upsert_community_notice",
      {
        next_category: notice?.category ?? "news",
        next_content: nextContent,
        next_is_pinned: nextPinned,
        next_title: nextTitle,
        target_post_id: notice?.id ?? null,
      },
    );

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("공지 저장에 실패했습니다.");
      return;
    }

    setActionMessage(notice ? "공지를 수정했습니다." : "공지를 작성했습니다.");
    await loadAdminData();
  };

  const deleteCommunityNotice = async (notice: AdminCommunityPost) => {
    if (!supabase || !window.confirm("공지를 삭제하시겠습니까?")) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc(
      "admin_delete_community_notice",
      {
        target_post_id: notice.id,
      },
    );

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 공지를 찾지 못했습니다.");
      return;
    }

    setActionMessage("공지를 삭제했습니다.");
    await loadAdminData();
  };

  const upsertPopupNotice = async (notice?: AdminPopupNotice) => {
    if (!supabase) {
      return;
    }

    const nextTitle = window.prompt("팝업공지 제목", notice?.title ?? "");

    if (nextTitle === null) {
      return;
    }

    const nextContent = window.prompt("팝업공지 내용", notice?.content ?? "");

    if (nextContent === null) {
      return;
    }

    const nextLinkUrl = window.prompt("연결 URL", notice?.link_url ?? "");

    if (nextLinkUrl === null) {
      return;
    }

    const nextIsActive = window.confirm("팝업공지를 활성화하시겠습니까?");

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_upsert_popup_notice", {
      next_content: nextContent,
      next_ends_at: notice?.ends_at ?? null,
      next_is_active: nextIsActive,
      next_link_url: nextLinkUrl || null,
      next_starts_at: notice?.starts_at ?? null,
      next_title: nextTitle,
      target_notice_id: notice?.id ?? null,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("팝업공지 저장에 실패했습니다.");
      return;
    }

    setActionMessage(
      notice ? "팝업공지를 수정했습니다." : "팝업공지를 작성했습니다.",
    );
    await loadAdminData();
  };

  const togglePopupNotice = async (notice: AdminPopupNotice) => {
    if (!supabase) {
      return;
    }

    setActionMessage("");

    const { error } = await supabase.rpc("admin_upsert_popup_notice", {
      next_content: notice.content,
      next_ends_at: notice.ends_at,
      next_is_active: !notice.is_active,
      next_link_url: notice.link_url,
      next_starts_at: notice.starts_at,
      next_title: notice.title,
      target_notice_id: notice.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    setActionMessage("팝업공지 상태를 변경했습니다.");
    await loadAdminData();
  };

  const deletePopupNotice = async (notice: AdminPopupNotice) => {
    if (!supabase || !window.confirm("팝업공지를 삭제하시겠습니까?")) {
      return;
    }

    setActionMessage("");

    const { data, error } = await supabase.rpc("admin_delete_popup_notice", {
      target_notice_id: notice.id,
    });

    if (error) {
      setActionMessage(error.message);
      return;
    }

    if (!data) {
      setActionMessage("대상 팝업공지를 찾지 못했습니다.");
      return;
    }

    setActionMessage("팝업공지를 삭제했습니다.");
    await loadAdminData();
  };

  if (!isAuthReady || isCheckingRole) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className={panelClassName}>
            <p className={mutedTextClassName}>
              {isAuthReady
                ? "관리자 권한을 확인하고 있습니다."
                : "로그인 상태를 확인하고 있습니다."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (isAccessDenied) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className={panelClassName}>
            <p className="text-sm font-bold text-red-700">
              관리자 권한이 없습니다.
            </p>
            <p className={cn(mutedTextClassName, "mt-2")}>홈으로 이동합니다.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className={panelClassName}>
            <p className={mutedTextClassName}>
              {isAuthenticated
                ? "홈으로 이동합니다."
                : "로그인 페이지로 이동합니다."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClassName}>
      <div className={cn(shellClassName, "lg:grid lg:grid-cols-[240px_minmax(0,1fr)]")}>
        <aside className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm shadow-zinc-200/60 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="px-2 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
              CARFACT OPS
            </p>
            <h1 className="mt-2 text-xl font-black tracking-tight text-zinc-950">
              Admin
            </h1>
            <p className="mt-1 truncate text-xs font-medium text-zinc-500">
              {profile?.nickname ?? user?.email ?? "관리자"}
            </p>
          </div>
          <nav className="mt-4 grid gap-1">
            {tabs.map((tab) =>
              tab.value === "knowledge" ? (
                <div key={tab.value} className="grid gap-1">
                  <button
                    type="button"
                    className={cn(
                      tabButtonClassName,
                      "justify-start text-left",
                      activeTab === tab.value && "text-zinc-950",
                    )}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setIsNotificationOpen(false);
                    }}
                  >
                    {tab.label}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      tabButtonClassName,
                      "ml-3 justify-start text-left text-xs",
                      activeTab === tab.value && activeTabButtonClassName,
                    )}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setIsNotificationOpen(false);
                    }}
                  >
                    └ 용어/증상 DB
                  </button>
                </div>
              ) : (
                <button
                  key={tab.value}
                  type="button"
                  className={cn(
                    tabButtonClassName,
                    "justify-start text-left",
                    activeTab === tab.value && activeTabButtonClassName,
                  )}
                  onClick={() => {
                    setActiveTab(tab.value);
                    setIsNotificationOpen(false);
                  }}
                >
                  {tab.label}
                </button>
              ),
            )}
          </nav>
          <div className="mt-5 grid gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={() => void refreshCurrentTab()}
            >
              새로고침
            </button>
            <Link
              href="/"
              className={cn(actionButtonClassName, "no-underline")}
            >
              홈으로
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm shadow-zinc-200/60">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black text-zinc-400">
                  {formatDate(new Date().toISOString())}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">
                  운영 Dashboard
                </h2>
              </div>
              <div className="relative flex min-w-0 flex-1 flex-col gap-2 xl:max-w-2xl">
                <input
                  className={cn(inputClassName, "pl-10")}
                  placeholder="회원, 후기, 게시글, 차량번호, 닉네임, 모델명 통합 검색"
                  value={globalSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGlobalSearch(value);
                    setPostPage(1);
                    setReviewPage(1);
                    setPostSearch(value);
                    setReviewSearch(value);
                    setUserSearch(value);
                    setReportSearch(value);
                    setNoticeSearch(value);
                    setKnowledgeSearch(value);
                  }}
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-zinc-400">
                  ⌕
                </span>
                {globalSearchResults.length ? (
                  <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10">
                    {globalSearchResults.map((result) => (
                      <button
                        key={result.tab + result.id}
                        type="button"
                        className="block w-full border-b border-zinc-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-blue-50"
                        onClick={() => {
                          setActiveTab(result.tab);
                          if (result.tab === "posts") setSelectedPostId(result.id);
                          if (result.tab === "reviews") setSelectedReviewId(result.id);
                          if (result.tab === "users") setSelectedUserId(result.id);
                        }}
                      >
                        <span className="block truncate text-sm font-black text-zinc-950">
                          {result.label}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {result.meta}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg transition hover:bg-zinc-50"
                  aria-label="운영 알림"
                  onClick={() => setIsNotificationOpen((current) => !current)}
                >
                  🔔
                  {reviewingAiCandidates.length + pendingReports.length > 0 ? (
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white" />
                  ) : null}
                </button>
                {isNotificationOpen ? (
                  <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15">
                    <NotificationItem
                      tone="red"
                      label="AI 반영 후보"
                      count={reviewingAiCandidates.length}
                      onClick={() => {
                        setActiveTab("ai");
                        setIsNotificationOpen(false);
                      }}
                    />
                    <NotificationItem
                      tone="yellow"
                      label="신규 신고 접수"
                      count={todayReports.length}
                      onClick={() => {
                        setActiveTab("reports");
                        setIsNotificationOpen(false);
                      }}
                    />
                    <NotificationItem
                      tone="orange"
                      label="API 호출 실패"
                      count={0}
                      onClick={() => setIsNotificationOpen(false)}
                    />
                    <NotificationItem
                      tone="green"
                      label="신규 회원 가입"
                      count={todayUsers.length}
                      onClick={() => {
                        setActiveTab("users");
                        setIsNotificationOpen(false);
                      }}
                    />
                    <NotificationItem
                      tone="blue"
                      label="후기 급증 차량"
                      count={trafficStats.topVehicles.length}
                      onClick={() => {
                        setActiveTab("dashboard");
                        setDashboardViewFilter("vehicle");
                        setActiveDashboardTab("views");
                        setIsNotificationOpen(false);
                      }}
                    />
                    <NotificationItem
                      tone="purple"
                      label="오늘 등록 후기"
                      count={todayReviews.length}
                      onClick={() => {
                        setActiveTab("reviews");
                        setIsNotificationOpen(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </header>

        {actionMessage ? (
          <section className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {actionMessage}
          </section>
        ) : null}

        {isLoading ? (
          <section className={panelClassName}>
            <p className={mutedTextClassName}>
              관리자 데이터를 불러오는 중입니다.
            </p>
          </section>
        ) : null}

        {activeTab === "dashboard" ? (
          <DashboardPanel
            activeDashboardTab={activeDashboardTab}
            dashboardViewFilter={dashboardViewFilter}
            onChangeAiCandidateStatus={(candidate, nextStatus) =>
              void updateAiCandidateStatus(candidate, nextStatus)
            }
            onChangeDashboardTab={setActiveDashboardTab}
            onChangePeriod={setDashboardPeriod}
            onChangeViewFilter={setDashboardViewFilter}
            operatorDashboardData={operatorDashboardData}
            onNavigate={setActiveTab}
            period={dashboardPeriod}
            posts={posts}
            reports={reports}
            reviews={reviews}
            stats={stats}
            trafficStats={trafficStats}
            users={users}
          />
        ) : null}

        {activeTab === "ai" ? (
          <AdminTablePanel
            count={
              activeAiManagementTab === "keywords"
                ? aiKeywordRules.length
                : activeAiManagementTab === "maintenance"
                  ? aiMaintenanceRules.length
                  : newKeywordCandidates.length
            }
            title="AI DB 로드맵 / 키워드 관리"
          >
            <AiManagementPanel
              activeTab={activeAiManagementTab}
              candidates={newKeywordCandidates}
              keywordRules={aiKeywordRules}
              maintenanceRules={aiMaintenanceRules}
              onChangeCandidateStatus={(candidate, nextStatus) =>
                void updateAiCandidateStatus(candidate, nextStatus)
              }
              onChangeKeywordRules={setAiKeywordRules}
              onChangeMaintenanceRules={setAiMaintenanceRules}
              onRegisterCandidate={(candidate, values) =>
                void registerNewKeywordCandidate(candidate, values)
              }
              onChangeTab={setActiveAiManagementTab}
              reviews={reviews}
            />
          </AdminTablePanel>
        ) : null}

        {activeTab === "knowledge" ? (
          <AdminTablePanel
            count={knowledgeTerms.length}
            title="Knowledge Center"
          >
            <KnowledgeCenterPanel
              onChangeSearch={setKnowledgeSearch}
              onChangeSort={setKnowledgeSort}
              onDelete={(term) => void deleteKnowledgeTerm(term)}
              onSave={(values, term) => void upsertKnowledgeTerm(values, term)}
              onSelect={setSelectedKnowledgeTermId}
              onToggleVisible={(term) => void toggleKnowledgeTermVisible(term)}
              search={knowledgeSearch}
              selectedTerm={selectedKnowledgeTerm}
              sort={knowledgeSort}
              terms={knowledgeTerms}
            />
          </AdminTablePanel>
        ) : null}

        {activeTab === "posts" ? (
          <AdminTablePanel count={visiblePosts.length} title="게시글 관리">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {adminPostCategoryTabs.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  className={cn(
                    categoryFilterButtonClassName,
                    postCategoryFilter === category.value &&
                      activeCategoryFilterButtonClassName,
                  )}
                  onClick={() => {
                    setPostCategoryFilter(category.value);
                    setPostPage(1);
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <BulkActionBar
              selectedCount={selectedPosts.length}
              hasVisibleSelection={selectedPosts.some(
                (post) => !post.is_hidden,
              )}
              hasHiddenSelection={selectedPosts.some((post) => post.is_hidden)}
              canPermanentDelete={isSuperAdmin}
              onHide={() => void updatePostsHidden(selectedPosts, true)}
              onPermanentDelete={() =>
                void permanentlyDeletePosts(selectedPosts)
              }
              onUnhide={() => void updatePostsHidden(selectedPosts, false)}
            />
            <div className={mobileListClassName}>
              {paginatedPosts.length ? (
                paginatedPosts.map((post) => {
                  const authorRoleLabel = getPostAuthorRoleLabel(post, users);

                  return (
                  <article className={mobileCardClassName} key={post.id}>
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <SelectionCheckbox
                          checked={selectedPostIds.includes(post.id)}
                          label="게시글 선택"
                          onChange={(checked) =>
                            setSelectedPostIds((current) =>
                              checked
                                ? Array.from(new Set([...current, post.id]))
                                : current.filter((id) => id !== post.id),
                            )
                          }
                        />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className={cn(
                              mobileCardTitleClassName,
                              "block text-left hover:text-blue-700",
                            )}
                            onClick={() => setSelectedPostId(post.id)}
                          >
                            {post.title}
                          </button>
                          <p className={mobileCardMetaClassName}>
                            {getPostCategoryLabel(post)} ·{" "}
                            {getPostAuthorDisplayName(post, users)}
                            {authorRoleLabel ? " " + authorRoleLabel : ""} ·{" "}
                            {formatDate(post.created_at)}
                          </p>
                          <p className={mobileCardMetaClassName}>
                            댓글 {post.comment_count.toLocaleString()} · 좋아요{" "}
                            {post.like_count.toLocaleString()} · 신고{" "}
                            {post.report_count.toLocaleString()}
                          </p>
                          <div className={mobileCardSubMetaClassName}>
                            <PostStatusBadges post={post} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <MobileActionDetails>
                      <PostActionButtons
                        isSuperAdmin={isSuperAdmin}
                        post={post}
                        onDelete={(target) => void deletePost(target)}
                        onUpdateState={(target, state) =>
                          void updatePostState(target, state)
                        }
                      />
                    </MobileActionDetails>
                  </article>
                  );
                })
              ) : (
                <EmptyMobileState message="게시글이 없습니다." />
              )}
            </div>
            <table className={desktopTableClassName}>
              <thead>
                <tr>
                  <th className={tableHeadCellClassName}>
                    <SelectionCheckbox
                      checked={allPostsSelected}
                      disabled={!paginatedPosts.length}
                      label="현재 페이지 게시글 전체 선택"
                      onChange={(checked) => {
                        const visiblePostIds = paginatedPosts.map(
                          (post) => post.id,
                        );

                        setSelectedPostIds((current) =>
                          checked
                            ? Array.from(new Set([...current, ...visiblePostIds]))
                            : current.filter(
                                (id) => !visiblePostIds.includes(id),
                              ),
                        );
                      }}
                    />
                  </th>
                  <th className={tableHeadCellClassName}>제목</th>
                  <th className={tableHeadCellClassName}>분류</th>
                  <th className={tableHeadCellClassName}>작성자</th>
                  <th className={tableHeadCellClassName}>상태</th>
                  <th className={tableHeadCellClassName}>신고</th>
                  <th className={tableHeadCellClassName}>댓글</th>
                  <th className={tableHeadCellClassName}>좋아요</th>
                  <th className={tableHeadCellClassName}>작성일</th>
                  <th className={cn(tableHeadCellClassName, "text-right")}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {paginatedPosts.length ? (
                  paginatedPosts.map((post) => {
                    const authorRoleLabel = getPostAuthorRoleLabel(post, users);

                    return (
                    <tr key={post.id}>
                      <td className={tableCellClassName}>
                        <SelectionCheckbox
                          checked={selectedPostIds.includes(post.id)}
                          label="게시글 선택"
                          onChange={(checked) =>
                            setSelectedPostIds((current) =>
                              checked
                                ? Array.from(new Set([...current, post.id]))
                                : current.filter((id) => id !== post.id),
                            )
                          }
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <button
                          type="button"
                          className="block max-w-sm truncate text-left text-sm font-bold text-zinc-950 hover:text-blue-700"
                          onClick={() => setSelectedPostId(post.id)}
                        >
                          {post.title}
                        </button>
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-sm")}>
                        {getPostCategoryLabel(post)}
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex max-w-40 items-center gap-1.5">
                          <VerifiedNickname
                            className="max-w-28"
                            isVerifiedDealer={
                              getPostAuthorProfile(post, users)
                                ?.is_verified_dealer ?? false
                            }
                          >
                            {getPostAuthorDisplayName(post, users)}
                          </VerifiedNickname>
                          {authorRoleLabel ? (
                            <span className="shrink-0 rounded-full border border-zinc-300 px-1.5 py-0.5 text-[10px] font-black text-zinc-400">
                              {authorRoleLabel}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap")}>
                        <PostStatusBadges post={post} />
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-sm font-bold")}>
                        {post.report_count.toLocaleString()}
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-sm font-bold")}>
                        {post.comment_count.toLocaleString()}
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-sm font-bold")}>
                        {post.like_count.toLocaleString()}
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-xs")}>
                        {formatDate(post.created_at)}
                      </td>
                      <td className={tableActionCellClassName}>
                        <div className={desktopActionGroupClassName}>
                          <PostActionButtons
                            isSuperAdmin={isSuperAdmin}
                            post={post}
                            onDelete={(target) => void deletePost(target)}
                            onUpdateState={(target, state) =>
                              void updatePostState(target, state)
                            }
                          />
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <EmptyTableRow colSpan={10} message="게시글이 없습니다." />
                )}
              </tbody>
            </table>
            {totalPostPages > 1 ? (
              <nav
                className="mt-4 flex flex-wrap items-center justify-center gap-2"
                aria-label="게시글 관리 페이지"
              >
                <button
                  type="button"
                  className={paginationButtonClassName}
                  disabled={currentPostPage <= 1}
                  onClick={() => setPostPage(currentPostPage - 1)}
                >
                  ◀
                </button>
                {getAdminPaginationPages(totalPostPages, currentPostPage).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      className={cn(
                        paginationButtonClassName,
                        currentPostPage === page &&
                          activePaginationButtonClassName,
                      )}
                      onClick={() => setPostPage(page)}
                      aria-current={
                        currentPostPage === page ? "page" : undefined
                      }
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className={paginationButtonClassName}
                  disabled={currentPostPage >= totalPostPages}
                  onClick={() => setPostPage(currentPostPage + 1)}
                >
                  ▶
                </button>
              </nav>
            ) : null}
          </AdminTablePanel>
        ) : null}

        {activeTab === "reviews" ? (
          <AdminTablePanel count={sortedReviews.length} title="후기 관리">
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <input
                  className={adminInputClassName}
                  placeholder="차량번호 검색"
                  value={reviewPlateFilter}
                  onChange={(event) => setReviewPlateFilter(event.target.value)}
                />
                <input
                  className={adminInputClassName}
                  placeholder="차종명 검색"
                  value={reviewModelFilter}
                  onChange={(event) => setReviewModelFilter(event.target.value)}
                />
                <input
                  className={adminInputClassName}
                  placeholder="작성자/회원 ID"
                  value={reviewAuthorFilter}
                  onChange={(event) => setReviewAuthorFilter(event.target.value)}
                />
                <input
                  className={adminInputClassName}
                  placeholder="유종"
                  value={reviewFuelFilter}
                  onChange={(event) => setReviewFuelFilter(event.target.value)}
                />
                <select
                  className={adminInputClassName}
                  value={reviewDateFilter}
                  onChange={(event) =>
                    setReviewDateFilter(event.target.value as ReviewDateFilter)
                  }
                >
                  {reviewDateFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <select
                  className={adminInputClassName}
                  value={reviewSort}
                  onChange={(event) =>
                    setReviewSort(event.target.value as ReviewSortOption)
                  }
                >
                  {reviewSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className={adminInputClassName}
                  value={reviewVisibilityFilter}
                  onChange={(event) =>
                    setReviewVisibilityFilter(
                      event.target.value as ReviewVisibilityFilter,
                    )
                  }
                >
                  {reviewVisibilityFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <select
                  className={adminInputClassName}
                  value={reviewReportFilter}
                  onChange={(event) =>
                    setReviewReportFilter(event.target.value as ReviewReportFilter)
                  }
                >
                  {reviewReportFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <select
                  className={adminInputClassName}
                  value={reviewDealerFilter}
                  onChange={(event) =>
                    setReviewDealerFilter(event.target.value as ReviewDealerFilter)
                  }
                >
                  {reviewDealerFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={actionButtonClassName}
                  onClick={() => {
                    setReviewAuthorFilter("");
                    setReviewDateFilter("all");
                    setReviewDealerFilter("all");
                    setReviewFuelFilter("");
                    setReviewModelFilter("");
                    setReviewPlateFilter("");
                    setReviewReportFilter("all");
                    setReviewSearch("");
                    setReviewSort("latest");
                    setReviewVisibilityFilter("all");
                  }}
                >
                  필터 초기화
                </button>
              </div>
              <p className="mt-2 text-xs font-bold text-zinc-500">
                차량번호, 차종, 후기 내용, 작성자 검색은 상단 통합 검색과 함께 적용됩니다.
              </p>
            </div>
            <BulkActionBar
              selectedCount={selectedReviews.length}
              hasVisibleSelection={selectedReviews.some(
                (review) => !review.is_hidden,
              )}
              hasHiddenSelection={selectedReviews.some(
                (review) => review.is_hidden,
              )}
              canPermanentDelete={isSuperAdmin}
              onHide={() => void updateReviewsHidden(selectedReviews, true)}
              onPermanentDelete={() =>
                void permanentlyDeleteReviews(selectedReviews)
              }
              onUnhide={() => void updateReviewsHidden(selectedReviews, false)}
            />
            <div className={mobileListClassName}>
              {paginatedReviews.length ? (
                paginatedReviews.map((review) => {
                  const reviewDetailHref = getReviewDetailHref(review);
                  return (
                  <article className={mobileCardClassName} key={review.id}>
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <SelectionCheckbox
                          checked={selectedReviewIds.includes(review.id)}
                          label="후기 선택"
                          onChange={(checked) =>
                            setSelectedReviewIds((current) =>
                              checked
                                ? Array.from(new Set([...current, review.id]))
                                : current.filter((id) => id !== review.id),
                            )
                          }
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-blue-700">
                            {formatAdminPlateNumber(getReviewPlateNumber(review))}
                          </p>
                          <p className={mobileCardMetaClassName}>
                            {getReviewVehicleModel(review)}
                          </p>
                          {reviewDetailHref ? (
                            <Link
                              href={reviewDetailHref}
                              className={cn(
                                mobileCardTitleClassName,
                                "mt-1 block hover:text-blue-700",
                              )}
                            >
                              {review.content}
                            </Link>
                          ) : (
                            <p className={cn(mobileCardTitleClassName, "mt-1")}>
                              {review.content}
                            </p>
                          )}
                          <p className={mobileCardMetaClassName}>
                            {review.author_nickname ??
                              (review.author_id
                                ? formatCompactId(review.author_id, 6)
                                : "익명 사용자")}{" "}
                            · {formatDate(review.created_at)}
                          </p>
                          <div className={mobileCardSubMetaClassName}>
                            <HiddenStatus isHidden={review.is_hidden} />
                            <span>신고 {review.report_count.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <MobileActionDetails>
                      <ReviewActionButtons
                        isSuperAdmin={isSuperAdmin}
                        review={review}
                        onDelete={(target) => void deleteReview(target)}
                        onToggleHidden={(target) =>
                          void updateReviewHidden(target)
                        }
                      />
                    </MobileActionDetails>
                  </article>
                  );
                })
              ) : (
                <EmptyMobileState message="후기가 없습니다." />
              )}
            </div>
            <table className={desktopTableClassName}>
              <thead>
                <tr>
                  <th className={tableHeadCellClassName}>
                    <SelectionCheckbox
                      checked={allReviewsSelected}
                      disabled={!paginatedReviews.length}
                      label="현재 페이지 후기 전체 선택"
                      onChange={(checked) => {
                        const visibleReviewIds = paginatedReviews.map(
                          (review) => review.id,
                        );

                        setSelectedReviewIds((current) =>
                          checked
                            ? Array.from(
                                new Set([...current, ...visibleReviewIds]),
                              )
                            : current.filter(
                                (id) => !visibleReviewIds.includes(id),
                              ),
                        );
                      }}
                    />
                  </th>
                  <th className={tableHeadCellClassName}>차량번호</th>
                  <th className={tableHeadCellClassName}>차량 모델</th>
                  <th className={tableHeadCellClassName}>후기 내용</th>
                  <th className={tableHeadCellClassName}>작성자</th>
                  <th className={tableHeadCellClassName}>상태</th>
                  <th className={tableHeadCellClassName}>신고</th>
                  <th className={tableHeadCellClassName}>작성일</th>
                  <th className={cn(tableHeadCellClassName, "text-right")}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {paginatedReviews.length ? (
                  paginatedReviews.map((review) => {
                    const reviewDetailHref = getReviewDetailHref(review);
                    return (
                    <tr key={review.id}>
                      <td className={tableCellClassName}>
                        <SelectionCheckbox
                          checked={selectedReviewIds.includes(review.id)}
                          label="후기 선택"
                          onChange={(checked) =>
                            setSelectedReviewIds((current) =>
                              checked
                                ? Array.from(new Set([...current, review.id]))
                                : current.filter((id) => id !== review.id),
                            )
                          }
                        />
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap font-mono text-xs font-bold text-zinc-900")}>
                        {formatAdminPlateNumber(getReviewPlateNumber(review))}
                      </td>
                      <td className={tableCellClassName}>
                        <p className="max-w-52 truncate text-sm font-semibold text-zinc-700">
                          {getReviewVehicleModel(review)}
                        </p>
                      </td>
                      <td className={tableCellClassName}>
                        {reviewDetailHref ? (
                          <Link
                            href={reviewDetailHref}
                            className="block max-w-[30rem] truncate text-sm leading-5 text-zinc-950 hover:text-blue-700"
                          >
                            {review.content}
                          </Link>
                        ) : (
                          <p className="max-w-[30rem] truncate text-sm leading-5 text-zinc-950">
                            {review.content}
                          </p>
                        )}
                      </td>
                      <td className={tableCellClassName}>
                        <span className="block max-w-32 truncate text-sm">
                          {review.author_nickname ??
                            (review.author_id
                              ? formatCompactId(review.author_id, 8)
                              : "익명 사용자")}
                        </span>
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap")}>
                        <HiddenStatus isHidden={review.is_hidden} />
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-sm font-bold")}>
                        {review.report_count.toLocaleString()}
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-xs")}>
                        {formatDate(review.created_at)}
                      </td>
                      <td className={cn(tableCellClassName, "min-w-36 text-right")}>
                        <div className={desktopActionGroupClassName}>
                          <ReviewActionButtons
                            isSuperAdmin={isSuperAdmin}
                            review={review}
                            onDelete={(target) => void deleteReview(target)}
                            onToggleHidden={(target) =>
                              void updateReviewHidden(target)
                            }
                          />
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <EmptyTableRow colSpan={9} message="후기가 없습니다." />
                )}
              </tbody>
            </table>
            {totalReviewPages > 1 ? (
              <nav
                className="mt-4 flex flex-wrap items-center justify-center gap-2"
                aria-label="후기 관리 페이지"
              >
                <button
                  type="button"
                  className={paginationButtonClassName}
                  disabled={currentReviewPage <= 1}
                  onClick={() => setReviewPage(currentReviewPage - 1)}
                >
                  ◀
                </button>
                {getAdminPaginationPages(
                  totalReviewPages,
                  currentReviewPage,
                ).map((page) => {
                  return (
                    <button
                      key={page}
                      type="button"
                      className={cn(
                        paginationButtonClassName,
                        currentReviewPage === page &&
                          activePaginationButtonClassName,
                      )}
                      onClick={() => setReviewPage(page)}
                      aria-current={
                        currentReviewPage === page ? "page" : undefined
                      }
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={paginationButtonClassName}
                  disabled={currentReviewPage >= totalReviewPages}
                  onClick={() => setReviewPage(currentReviewPage + 1)}
                >
                  ▶
                </button>
              </nav>
            ) : null}
          </AdminTablePanel>
        ) : null}

        {activeTab === "users" ? (
          <AdminTablePanel count={users.length} title="회원 관리">
            <div className={mobileListClassName}>
              {users.length ? (
                users.map((account) => (
                  <article className={mobileCardClassName} key={account.id}>
                    <div className="min-w-0">
                      <button
                        type="button"
                        className={cn(mobileCardTitleClassName, "block text-left")}
                        onClick={() => setSelectedUserId(account.id)}
                      >
                        <VerifiedNickname
                          isVerifiedDealer={account.is_verified_dealer}
                        >
                          {(account.nickname ?? "닉네임 없음") +
                            " (" +
                            formatCompactId(account.id, 8) +
                            ")"}
                        </VerifiedNickname>
                      </button>
                      <p className={mobileCardMetaClassName}>
                        {getDisplayValue(account.email)} ·{" "}
                        {formatProviderLabel(account.login_provider)} · 가입{" "}
                        {formatDate(account.created_at)}
                      </p>
                      <p className={mobileCardMetaClassName}>
                        최근 로그인 {formatOptionalDate(account.last_sign_in_at)}
                      </p>
                      <div className={mobileCardSubMetaClassName}>
                        <RoleBadge role={account.role} />
                        <AccountStatusBadge
                          isSuspended={account.is_suspended}
                        />
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-xs font-bold",
                            account.is_verified_dealer
                              ? "border-[#2563EB]/50 bg-[#2563EB]/10 text-[#2563EB]"
                              : "border-zinc-300 bg-zinc-100 text-zinc-400",
                          )}
                        >
                          딜러 {account.is_verified_dealer ? "ON" : "OFF"}
                        </span>
                      </div>
                    </div>
                    <MobileActionDetails>
                      <UserActionButtons
                        account={account}
                        isSuperAdmin={isSuperAdmin}
                        isVerifiedDealerFeatureReady={
                          isVerifiedDealerFeatureReady
                        }
                        onGrantNicknameChangeTicket={(target) =>
                          void grantNicknameChangeTicket(target)
                        }
                        onSetRole={(target, nextRole) =>
                          void setUserRole(target, nextRole)
                        }
                        onSetSuspended={(target) =>
                          void setUserSuspended(target)
                        }
                        onSetVerifiedDealer={(target) =>
                          void setVerifiedDealer(target)
                        }
                      />
                    </MobileActionDetails>
                  </article>
                ))
              ) : (
                <EmptyMobileState message="회원이 없습니다." />
              )}
            </div>
            <table className={desktopTableClassName}>
              <thead>
                <tr>
                  <th className={tableHeadCellClassName}>닉네임</th>
                  <th className={tableHeadCellClassName}>로그인 정보</th>
                  <th className={tableHeadCellClassName}>변경권</th>
                  <th className={tableHeadCellClassName}>Role</th>
                  <th className={tableHeadCellClassName}>인증딜러</th>
                  <th className={cn(tableHeadCellClassName, "min-w-16")}>상태</th>
                  <th className={cn(tableHeadCellClassName, "min-w-36")}>가입일</th>
                  <th className={cn(tableHeadCellClassName, "min-w-36")}>최근 로그인</th>
                  <th className={cn(tableHeadCellClassName, "text-right")}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {users.length ? (
                  users.map((account) => (
                    <tr key={account.id}>
                      <td className={tableCellClassName}>
                        <div className="min-w-32">
                          <button
                            type="button"
                            className="inline-flex max-w-56 items-center gap-1.5 truncate text-left"
                            onClick={() => setSelectedUserId(account.id)}
                          >
                            <VerifiedNickname
                              isVerifiedDealer={account.is_verified_dealer}
                            >
                              {(account.nickname ?? "닉네임 없음") +
                                " (" +
                                formatCompactId(account.id, 8) +
                                ")"}
                            </VerifiedNickname>
                          </button>
                        </div>
                      </td>
                      <td className={tableCellClassName}>
                        <div className="min-w-56 max-w-72">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                              {formatProviderLabel(account.login_provider)}
                            </span>
                            <span className="min-w-0 truncate text-xs text-zinc-500">
                              {getDisplayValue(account.email)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClassName}>
                        <span className="font-mono text-sm font-bold text-zinc-800">
                          {account.nickname_change_available.toLocaleString()}
                        </span>
                      </td>
                      <td className={tableCellClassName}>
                        <RoleBadge role={account.role} />
                      </td>
                      <td className={tableCellClassName}>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                            !isVerifiedDealerFeatureReady
                              ? "border-zinc-300 bg-zinc-100 text-zinc-500"
                              : account.is_verified_dealer
                                ? "border-[#2563EB]/50 bg-[#2563EB]/10 text-[#2563EB]"
                                : "border-zinc-300 bg-zinc-100 text-zinc-400",
                          )}
                        >
                          {!isVerifiedDealerFeatureReady
                            ? "DB 미적용"
                            : account.is_verified_dealer
                              ? "ON"
                              : "OFF"}
                        </span>
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap")}>
                        <AccountStatusBadge
                          isSuspended={account.is_suspended}
                        />
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-xs")}>
                        {formatDate(account.created_at)}
                      </td>
                      <td className={cn(tableCellClassName, "whitespace-nowrap text-xs")}>
                        {formatOptionalDate(account.last_sign_in_at)}
                      </td>
                      <td className={tableActionCellClassName}>
                        <div className={desktopActionGroupClassName}>
                          <UserActionButtons
                            account={account}
                            isSuperAdmin={isSuperAdmin}
                            isVerifiedDealerFeatureReady={
                              isVerifiedDealerFeatureReady
                            }
                            onGrantNicknameChangeTicket={(target) =>
                              void grantNicknameChangeTicket(target)
                            }
                            onSetRole={(target, nextRole) =>
                              void setUserRole(target, nextRole)
                            }
                            onSetSuspended={(target) =>
                              void setUserSuspended(target)
                            }
                            onSetVerifiedDealer={(target) =>
                              void setVerifiedDealer(target)
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyTableRow colSpan={9} message="회원이 없습니다." />
                )}
              </tbody>
            </table>
          </AdminTablePanel>
        ) : null}

        {activeTab === "reports" ? (
          <AdminTablePanel count={reports.length} title="신고 관리">
            <BulkActionBar
              selectedCount={selectedReports.length}
              hasVisibleSelection={selectedReports.some(
                (report) => !report.is_hidden,
              )}
              hasHiddenSelection={selectedReports.some(
                (report) => report.is_hidden,
              )}
              onHide={() =>
                void updateReportTargetsHidden(selectedReports, true)
              }
              onUnhide={() =>
                void updateReportTargetsHidden(selectedReports, false)
              }
            />
            <div className={mobileListClassName}>
              {reports.length ? (
                reports.map((report) => (
                  <article className={mobileCardClassName} key={report.report_id}>
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <SelectionCheckbox
                          checked={selectedReportIds.includes(report.report_id)}
                          label="신고 선택"
                          onChange={(checked) =>
                            setSelectedReportIds((current) =>
                              checked
                                ? Array.from(
                                    new Set([...current, report.report_id]),
                                  )
                                : current.filter(
                                    (id) => id !== report.report_id,
                                  ),
                            )
                          }
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-red-600">
                            {report.report_type}
                          </p>
                          <button
                            type="button"
                            className={cn(mobileCardTitleClassName, "block text-left")}
                            onClick={() => setSelectedReportId(report.report_id)}
                          >
                            {report.target_title ?? report.target_content}
                          </button>
                          <p className={mobileCardMetaClassName}>
                            {report.reason ?? "사유 없음"} ·{" "}
                            {report.target_author ?? "작성자 확인 필요"} ·{" "}
                            {formatDate(report.created_at)}
                          </p>
                          <div className={mobileCardSubMetaClassName}>
                            <HiddenStatus isHidden={report.is_hidden} />
                            <span>누적 {Number(report.report_count).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn(actionButtonClassName, "min-h-8 px-2.5 text-[11px]")}
                      onClick={() => setSelectedReportId(report.report_id)}
                    >
                      보기
                    </button>
                  </article>
                ))
              ) : (
                <EmptyMobileState message="신고 내역이 없습니다." />
              )}
            </div>
            <table className={desktopTableClassName}>
              <thead>
                <tr>
                  <th className={tableHeadCellClassName}>
                    <SelectionCheckbox
                      checked={allReportsSelected}
                      disabled={!reports.length}
                      label="신고 전체 선택"
                      onChange={(checked) =>
                        setSelectedReportIds(
                          checked
                            ? reports.map((report) => report.report_id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th className={tableHeadCellClassName}>대상</th>
                  <th className={tableHeadCellClassName}>사유</th>
                  <th className={tableHeadCellClassName}>누적</th>
                  <th className={tableHeadCellClassName}>상태</th>
                  <th className={tableHeadCellClassName}>신고일</th>
                  <th className={tableHeadCellClassName}>관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {reports.length ? (
                  reports.map((report) => (
                    <tr key={report.report_id}>
                      <td className={tableCellClassName}>
                        <SelectionCheckbox
                          checked={selectedReportIds.includes(report.report_id)}
                          label="신고 선택"
                          onChange={(checked) =>
                            setSelectedReportIds((current) =>
                              checked
                                ? Array.from(
                                    new Set([...current, report.report_id]),
                                  )
                                : current.filter(
                                    (id) => id !== report.report_id,
                                  ),
                            )
                          }
                        />
                      </td>
                      <td className={tableCellClassName}>
                        <p className="text-xs font-bold text-red-600">
                          {report.report_type}
                        </p>
                        <button
                          type="button"
                          className="mt-1 block max-w-sm truncate text-left font-bold leading-[1.7] text-zinc-950 hover:text-blue-700"
                          onClick={() => setSelectedReportId(report.report_id)}
                        >
                          {report.target_title ?? report.target_content}
                        </button>
                        <p className="mt-1 max-w-sm truncate text-xs leading-[1.7] text-zinc-500">
                          {report.target_content}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          작성자: {report.target_author ?? "확인 필요"}
                        </p>
                      </td>
                      <td className={tableCellClassName}>
                        {report.reason ?? "사유 없음"}
                      </td>
                      <td className={tableCellClassName}>
                        {Number(report.report_count).toLocaleString()}
                      </td>
                      <td className={tableCellClassName}>
                        <HiddenStatus isHidden={report.is_hidden} />
                      </td>
                      <td className={tableCellClassName}>
                        {formatDate(report.created_at)}
                      </td>
                      <td className={tableCellClassName}>
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => setSelectedReportId(report.report_id)}
                        >
                          상세
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyTableRow colSpan={7} message="신고 내역이 없습니다." />
                )}
              </tbody>
            </table>
          </AdminTablePanel>
        ) : null}

        {activeTab === "notices" ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <AdminTablePanel count={notices.length} title="공지 관리">
              <div className="border-b border-zinc-200 p-3">
                <button
                  type="button"
                  className={actionButtonClassName}
                  onClick={() => void upsertCommunityNotice()}
                >
                  공지 작성
                </button>
              </div>
              <div className={mobileListClassName}>
                {notices.length ? (
                  notices.map((notice) => (
                    <article className={mobileCardClassName} key={notice.id}>
                      <div className="min-w-0">
                        <button
                          type="button"
                          className={cn(
                            mobileCardTitleClassName,
                            "block text-left hover:text-blue-700",
                          )}
                          onClick={() => setSelectedNoticeId(notice.id)}
                        >
                          {notice.title}
                        </button>
                        <div className={mobileCardSubMetaClassName}>
                          <PostStatusBadges post={notice} />
                          <span>{formatDate(notice.created_at)}</span>
                        </div>
                      </div>
                      <MobileActionDetails>
                        <NoticeActionButtons
                          notice={notice}
                          onDelete={(target) =>
                            void deleteCommunityNotice(target)
                          }
                          onEdit={(target) =>
                            void upsertCommunityNotice(target)
                          }
                        />
                      </MobileActionDetails>
                    </article>
                  ))
                ) : (
                  <EmptyMobileState message="공지 내역이 없습니다." />
                )}
              </div>
              <table className={desktopTableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>
                      <SelectionCheckbox
                        checked={allNoticesSelected}
                        disabled={!notices.length}
                        label="공지 전체 선택"
                        onChange={(checked) =>
                          setSelectedNoticeIds(
                            checked ? notices.map((notice) => notice.id) : [],
                          )
                        }
                      />
                    </th>
                    <th className={tableHeadCellClassName}>공지 제목</th>
                    <th className={tableHeadCellClassName}>상태</th>
                    <th className={tableHeadCellClassName}>작성일</th>
                    <th className={cn(tableHeadCellClassName, "text-right")}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {notices.length ? (
                    notices.map((notice) => (
                      <tr key={notice.id}>
                        <td className={tableCellClassName}>
                          <SelectionCheckbox
                            checked={selectedNoticeIds.includes(notice.id)}
                            label="공지 선택"
                            onChange={(checked) =>
                              setSelectedNoticeIds((current) =>
                                checked
                                  ? Array.from(new Set([...current, notice.id]))
                                  : current.filter((id) => id !== notice.id),
                              )
                            }
                          />
                        </td>
                        <td className={tableCellClassName}>
                          <button
                            type="button"
                            className="block max-w-[34rem] truncate text-left text-sm font-bold text-zinc-950 hover:text-blue-700"
                            onClick={() => setSelectedNoticeId(notice.id)}
                          >
                            {notice.title}
                          </button>
                        </td>
                        <td className={cn(tableCellClassName, "min-w-48 whitespace-nowrap")}>
                          <PostStatusBadges post={notice} />
                        </td>
                        <td className={cn(tableCellClassName, "whitespace-nowrap text-xs")}>
                          {formatDate(notice.created_at)}
                        </td>
                        <td className={cn(tableCellClassName, "min-w-32 text-right")}>
                          <div className={desktopActionGroupClassName}>
                            <NoticeActionButtons
                              notice={notice}
                              onDelete={(target) =>
                                void deleteCommunityNotice(target)
                              }
                              onEdit={(target) =>
                                void upsertCommunityNotice(target)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow
                      colSpan={5}
                      message="공지 내역이 없습니다."
                    />
                  )}
                </tbody>
              </table>
            </AdminTablePanel>

            <AdminTablePanel count={popupNotices.length} title="팝업공지 관리">
              <div className="border-b border-zinc-200 p-3">
                <button
                  type="button"
                  className={actionButtonClassName}
                  onClick={() => void upsertPopupNotice()}
                >
                  팝업공지 작성
                </button>
              </div>
              <div className={mobileListClassName}>
                {popupNotices.length ? (
                  popupNotices.map((notice) => (
                    <article className={mobileCardClassName} key={notice.id}>
                      <div className="min-w-0">
                        <button
                          type="button"
                          className={cn(
                            mobileCardTitleClassName,
                            "block text-left hover:text-blue-700",
                          )}
                          onClick={() => setSelectedPopupNoticeId(notice.id)}
                        >
                          {notice.title}
                        </button>
                        <div className={mobileCardSubMetaClassName}>
                          <ActiveStatusBadge isActive={notice.is_active} />
                          <span>{formatDate(notice.created_at)}</span>
                        </div>
                      </div>
                      <MobileActionDetails>
                        <PopupNoticeActionButtons
                          notice={notice}
                          onDelete={(target) => void deletePopupNotice(target)}
                          onEdit={(target) => void upsertPopupNotice(target)}
                          onToggle={(target) => void togglePopupNotice(target)}
                        />
                      </MobileActionDetails>
                    </article>
                  ))
                ) : (
                  <EmptyMobileState message="팝업공지 내역이 없습니다." />
                )}
              </div>
              <table className={desktopTableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>
                      <SelectionCheckbox
                        checked={allPopupNoticesSelected}
                        disabled={!popupNotices.length}
                        label="팝업공지 전체 선택"
                        onChange={(checked) =>
                          setSelectedPopupNoticeIds(
                            checked
                              ? popupNotices.map((notice) => notice.id)
                              : [],
                          )
                        }
                      />
                    </th>
                    <th className={tableHeadCellClassName}>팝업 제목</th>
                    <th className={tableHeadCellClassName}>상태</th>
                    <th className={tableHeadCellClassName}>작성일</th>
                    <th className={cn(tableHeadCellClassName, "text-right")}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {popupNotices.length ? (
                    popupNotices.map((notice) => (
                      <tr key={notice.id}>
                        <td className={tableCellClassName}>
                          <SelectionCheckbox
                            checked={selectedPopupNoticeIds.includes(notice.id)}
                            label="팝업공지 선택"
                            onChange={(checked) =>
                              setSelectedPopupNoticeIds((current) =>
                                checked
                                  ? Array.from(new Set([...current, notice.id]))
                                  : current.filter((id) => id !== notice.id),
                              )
                            }
                          />
                        </td>
                        <td className={tableCellClassName}>
                          <button
                            type="button"
                            className="block max-w-[34rem] truncate text-left text-sm font-bold text-zinc-950 hover:text-blue-700"
                            onClick={() => setSelectedPopupNoticeId(notice.id)}
                          >
                            {notice.title}
                          </button>
                        </td>
                        <td className={cn(tableCellClassName, "min-w-28 whitespace-nowrap")}>
                          <ActiveStatusBadge isActive={notice.is_active} />
                        </td>
                        <td className={cn(tableCellClassName, "whitespace-nowrap text-xs")}>
                          {formatDate(notice.created_at)}
                        </td>
                        <td className={cn(tableCellClassName, "min-w-48 text-right")}>
                          <div className={desktopActionGroupClassName}>
                            <PopupNoticeActionButtons
                              notice={notice}
                              onDelete={(target) =>
                                void deletePopupNotice(target)
                              }
                              onEdit={(target) =>
                                void upsertPopupNotice(target)
                              }
                              onToggle={(target) =>
                                void togglePopupNotice(target)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyTableRow
                      colSpan={5}
                      message="팝업공지 내역이 없습니다."
                    />
                  )}
                </tbody>
              </table>
            </AdminTablePanel>
          </div>
        ) : null}

        {selectedNotice ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-50/78 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-notice-detail-title"
            onClick={() => setSelectedNoticeId(null)}
          >
            <section
              className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-blue-600">공지</p>
                  <h2
                    id="admin-notice-detail-title"
                    className="mt-1 break-words text-xl font-black text-zinc-950"
                  >
                    {selectedNotice.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-lg font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  onClick={() => setSelectedNoticeId(null)}
                  aria-label="공지 상세 닫기"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-zinc-400">
                  <span>{formatDate(selectedNotice.created_at)}</span>
                  <PostStatusBadges post={selectedNotice} />
                </div>

                <CommunityPostBody
                  content={selectedNotice.content}
                  images={getCommunityPostImages(selectedNotice.images)}
                />

                <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4">
                  <NoticeActionButtons
                    notice={selectedNotice}
                    onDelete={(target) => {
                      setSelectedNoticeId(null);
                      void deleteCommunityNotice(target);
                    }}
                    onEdit={(target) => void upsertCommunityNotice(target)}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {selectedPopupNotice ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-50/78 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-popup-notice-detail-title"
            onClick={() => setSelectedPopupNoticeId(null)}
          >
            <section
              className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-blue-600">팝업공지</p>
                  <h2
                    id="admin-popup-notice-detail-title"
                    className="mt-1 break-words text-xl font-black text-zinc-950"
                  >
                    {selectedPopupNotice.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-lg font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  onClick={() => setSelectedPopupNoticeId(null)}
                  aria-label="팝업공지 상세 닫기"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-zinc-400">
                  <span>{formatDate(selectedPopupNotice.created_at)}</span>
                  <ActiveStatusBadge isActive={selectedPopupNotice.is_active} />
                  {selectedPopupNotice.link_url ? (
                    <a
                      className="break-all text-red-600 hover:text-blue-700"
                      href={selectedPopupNotice.link_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedPopupNotice.link_url}
                    </a>
                  ) : null}
                </div>

                <p className="whitespace-pre-wrap break-words text-base leading-[1.75] text-zinc-700">
                  {selectedPopupNotice.content}
                </p>

                <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4">
                  <PopupNoticeActionButtons
                    notice={selectedPopupNotice}
                    onDelete={(target) => {
                      setSelectedPopupNoticeId(null);
                      void deletePopupNotice(target);
                    }}
                    onEdit={(target) => void upsertPopupNotice(target)}
                    onToggle={(target) => void togglePopupNotice(target)}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {selectedPost ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-50/78 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-post-detail-title"
            onClick={() => setSelectedPostId(null)}
          >
            <section
              className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-red-600">
                    {getPostCategoryLabel(selectedPost)}
                  </p>
                  <h2
                    id="admin-post-detail-title"
                    className="mt-1 break-words text-xl font-black text-zinc-950"
                  >
                    {selectedPost.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-lg font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  onClick={() => setSelectedPostId(null)}
                  aria-label="게시글 상세 닫기"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <VerifiedNickname
                      isVerifiedDealer={
                        getPostAuthorProfile(selectedPost, users)
                          ?.is_verified_dealer ?? false
                      }
                    >
                      {getPostAuthorDisplayName(selectedPost, users)}
                    </VerifiedNickname>
                    {getPostAuthorRoleLabel(selectedPost, users) ? (
                      <span className="rounded-full border border-zinc-300 px-1.5 py-0.5 text-[10px] font-black text-zinc-400">
                        {getPostAuthorRoleLabel(selectedPost, users)}
                      </span>
                    ) : null}
                  </span>
                  <span>{formatDate(selectedPost.created_at)}</span>
                  <span>신고 {selectedPost.report_count.toLocaleString()}</span>
                  <span>댓글 {selectedPost.comment_count.toLocaleString()}</span>
                  <span>좋아요 {selectedPost.like_count.toLocaleString()}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <PostStatusBadges post={selectedPost} />
                </div>

                <CommunityPostBody
                  content={selectedPost.content}
                  images={getCommunityPostImages(selectedPost.images)}
                />

                <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4">
                  <PostActionButtons
                    isSuperAdmin={isSuperAdmin}
                    post={selectedPost}
                    onDelete={(target) => {
                      setSelectedPostId(null);
                      void deletePost(target);
                    }}
                    onUpdateState={(target, state) =>
                      void updatePostState(target, state)
                    }
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {selectedUser ? (
          <AdminDetailModal
            title={
              (selectedUser.nickname ?? "닉네임 없음") +
              " (" +
              formatCompactId(selectedUser.id, 8) +
              ")"
            }
            eyebrow="회원 상세"
            onClose={() => setSelectedUserId(null)}
          >
            <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
              <DetailField label="이메일" value={getDisplayValue(selectedUser.email)} />
              <DetailField
                label="로그인"
                value={formatProviderLabel(selectedUser.login_provider)}
              />
              <DetailField label="가입일" value={formatDate(selectedUser.created_at)} />
              <DetailField
                label="최근 로그인"
                value={formatOptionalDate(selectedUser.last_sign_in_at)}
              />
              <DetailField label="회원 ID" value={selectedUser.id} />
              <div>
                <p className="text-xs font-black text-zinc-400">상태</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <RoleBadge role={selectedUser.role} />
                  <AccountStatusBadge isSuspended={selectedUser.is_suspended} />
                  <span className="inline-flex whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                    딜러 {selectedUser.is_verified_dealer ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end border-t border-zinc-200 pt-4">
              <UserActionButtons
                account={selectedUser}
                isSuperAdmin={isSuperAdmin}
                isVerifiedDealerFeatureReady={isVerifiedDealerFeatureReady}
                onGrantNicknameChangeTicket={(target) =>
                  void grantNicknameChangeTicket(target)
                }
                onSetRole={(target, nextRole) =>
                  void setUserRole(target, nextRole)
                }
                onSetSuspended={(target) => void setUserSuspended(target)}
                onSetVerifiedDealer={(target) => void setVerifiedDealer(target)}
              />
            </div>
          </AdminDetailModal>
        ) : null}

        {selectedReport ? (
          <AdminDetailModal
            title={selectedReport.target_title ?? selectedReport.target_content}
            eyebrow={selectedReport.report_type + " 신고"}
            onClose={() => setSelectedReportId(null)}
          >
            <div className="space-y-3 text-sm text-zinc-700">
              <DetailField label="신고 사유" value={selectedReport.reason ?? "사유 없음"} />
              <DetailField
                label="대상 작성자"
                value={selectedReport.target_author ?? "확인 필요"}
              />
              <DetailField
                label="신고일"
                value={formatDate(selectedReport.created_at)}
              />
              <DetailField
                label="누적 신고"
                value={Number(selectedReport.report_count).toLocaleString() + "건"}
              />
              <div>
                <p className="text-xs font-black text-zinc-400">대상 내용</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 leading-6">
                  {selectedReport.target_content}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <HiddenStatus isHidden={selectedReport.is_hidden} />
                {selectedReport.target_path ? (
                  <Link className={actionButtonClassName} href={selectedReport.target_path}>
                    대상 확인
                  </Link>
                ) : null}
              </div>
            </div>
          </AdminDetailModal>
        ) : null}

        {selectedReview ? (
          <AdminDetailModal
            title={formatAdminPlateNumber(getReviewPlateNumber(selectedReview))}
            eyebrow="후기 상세"
            onClose={() => setSelectedReviewId(null)}
          >
            <div className="space-y-3 text-sm text-zinc-700">
              <DetailField
                label="차량 모델"
                value={getReviewVehicleModel(selectedReview)}
              />
              <DetailField
                label="작성자"
                value={
                  selectedReview.author_nickname ??
                  (selectedReview.author_id
                    ? formatCompactId(selectedReview.author_id, 8)
                    : "익명 사용자")
                }
              />
              <DetailField
                label="작성일"
                value={formatDate(selectedReview.created_at)}
              />
              <div>
                <p className="text-xs font-black text-zinc-400">후기 내용</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 leading-6">
                  {selectedReview.content}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <HiddenStatus isHidden={selectedReview.is_hidden} />
                {getReviewDetailHref(selectedReview) ? (
                  <Link
                    className={actionButtonClassName}
                    href={getReviewDetailHref(selectedReview) ?? "#"}
                  >
                    카팩트 리포트
                  </Link>
                ) : null}
              </div>
            </div>
          </AdminDetailModal>
        ) : null}
        </div>
      </div>
    </main>
  );
}

function SearchBar({
  activeTab,
  setKnowledgeSearch,
  searchValue,
  setNoticeSearch,
  setPostSearch,
  setReportSearch,
  setReviewSearch,
  setUserSearch,
}: {
  activeTab: Exclude<AdminTab, "dashboard">;
  setKnowledgeSearch: (value: string) => void;
  searchValue: string;
  setNoticeSearch: (value: string) => void;
  setPostSearch: (value: string) => void;
  setReportSearch: (value: string) => void;
  setReviewSearch: (value: string) => void;
  setUserSearch: (value: string) => void;
}) {
  const label = {
    posts: "게시글 제목, 내용, 작성자 검색",
    reviews: "후기 내용, 작성자, 차량 정보 검색",
    users: "닉네임, 회원 ID, role 검색",
    ai: "AI 후보, 키워드, 모델명 검색",
    knowledge: "대표명, slug, 설명, 원인, 증상, 키워드, 차종 검색",
    reports: "신고 사유, 대상 내용, 작성자 검색",
    notices: "공지 제목, 내용, 팝업 URL 검색",
  }[activeTab];

  const updateSearch = (value: string) => {
    if (activeTab === "posts") setPostSearch(value);
    if (activeTab === "reviews") setReviewSearch(value);
    if (activeTab === "users") setUserSearch(value);
    if (activeTab === "knowledge") setKnowledgeSearch(value);
    if (activeTab === "reports") setReportSearch(value);
    if (activeTab === "notices") setNoticeSearch(value);
  };

  return (
    <section className={panelClassName}>
      <label
        className="block text-xs font-bold text-zinc-500"
        htmlFor="admin-search"
      >
        검색
      </label>
      <input
        id="admin-search"
        type="search"
        className={cn(inputClassName, "mt-2")}
        placeholder={label}
        value={searchValue}
        onChange={(event) => updateSearch(event.target.value)}
      />
    </section>
  );
}

function AdminDetailModal({
  children,
  eyebrow,
  onClose,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <section
        className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-blue-600">{eyebrow}</p>
            <h2 className="mt-1 break-words text-xl font-black text-zinc-950">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-lg font-black text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950"
            onClick={onClose}
            aria-label="상세 닫기"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </section>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black text-zinc-400">{label}</p>
      <p className="mt-1 break-words font-bold text-zinc-800">{value}</p>
    </div>
  );
}

function NotificationItem({
  count,
  label,
  onClick,
  tone,
}: {
  count: number;
  label: string;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-zinc-50"
      onClick={onClick}
    >
      <span className="text-sm font-black text-zinc-800">
        <ToneDot tone={tone} /> {label}
      </span>
      <span className="text-sm font-black text-zinc-950">
        {count.toLocaleString()}건
      </span>
    </button>
  );
}

function ToneDot({ tone }: { tone: string }) {
  const color =
    tone === "red"
      ? "text-red-500"
      : tone === "yellow"
        ? "text-amber-500"
        : tone === "orange"
          ? "text-orange-500"
          : tone === "green"
            ? "text-emerald-500"
            : tone === "purple"
              ? "text-violet-500"
              : "text-blue-500";

  return <span className={color}>●</span>;
}

function createDashboardChartRows({
  aiCandidates,
  posts,
  reports,
  reviews,
  users,
}: {
  aiCandidates: AdminDashboardAiCandidate[];
  posts: AdminCommunityPost[];
  reports: AdminReport[];
  reviews: AdminReview[];
  users: AdminUserProfile[];
}) {
  const now = new Date();

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (29 - index));
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const start = date.getTime();
    const end = nextDate.getTime();
    const inDay = (value: string | null | undefined) => {
      const time = Date.parse(value ?? "");
      return !Number.isNaN(time) && time >= start && time < end;
    };

    return {
      label: String(date.getMonth() + 1) + "/" + String(date.getDate()),
      ai: aiCandidates.filter((candidate) => inDay(candidate.updatedAt)).length,
      posts: posts.filter((post) => inDay(post.created_at)).length,
      reports: reports.filter((report) => inDay(report.created_at)).length,
      reviews: reviews.filter((review) => inDay(review.created_at)).length,
      users: users.filter((account) => inDay(account.created_at)).length,
    };
  });
}

function DashboardLineChart({
  rows,
}: {
  rows: ReturnType<typeof createDashboardChartRows>;
}) {
  const series = [
    { key: "reviews", label: "후기", color: "#2563eb" },
    { key: "users", label: "회원", color: "#10b981" },
    { key: "posts", label: "게시글", color: "#111827" },
    { key: "ai", label: "AI 반영", color: "#7c3aed" },
    { key: "reports", label: "신고", color: "#ef4444" },
  ] as const;
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => series.map((item) => row[item.key])),
  );
  const width = 900;
  const height = 220;
  const padding = 28;
  const xStep = (width - padding * 2) / Math.max(1, rows.length - 1);
  const getY = (value: number) =>
    height - padding - (value / maxValue) * (height - padding * 2);
  const getPath = (key: (typeof series)[number]["key"]) =>
    rows
      .map((row, index) => {
        const x = padding + index * xStep;
        const y = getY(row[key]);
        return (index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-3 flex flex-wrap gap-3">
        {series.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="overflow-hidden md:overflow-x-auto">
        <svg
          className="h-[180px] w-full min-w-0 md:h-[220px] md:min-w-[760px]"
          viewBox={"0 0 " + width + " " + height}
          role="img"
          aria-label="최근 30일 운영 지표 그래프"
        >
          {[0, 1, 2, 3].map((line) => {
            const y = padding + line * ((height - padding * 2) / 3);
            return (
              <line
                key={line}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            );
          })}
          {series.map((item) => (
            <path
              key={item.key}
              d={getPath(item.key)}
              fill="none"
              stroke={item.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

interface DashboardSeriesRow {
  label: string;
  value: number;
}

interface DashboardBarRow {
  label: string;
  value: number;
  detail?: string;
}

const getDashboardPeriodStartTime = (period: DashboardPeriod) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (period === "all") return null;
  if (period === "today") return todayStart.getTime();

  const days = period === "7days" ? 7 : period === "30days" ? 30 : 90;

  return todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
};

const getPreviousPeriodRange = (period: DashboardPeriod) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTime = todayStart.getTime();

  if (period === "today") {
    return {
      end: todayStartTime,
      start: todayStartTime - 24 * 60 * 60 * 1000,
    };
  }

  const days = period === "7days" ? 7 : period === "30days" ? 30 : 90;
  const currentStart = todayStartTime - (days - 1) * 24 * 60 * 60 * 1000;

  return {
    end: currentStart,
    start: currentStart - days * 24 * 60 * 60 * 1000,
  };
};

const filterAcquisitionRowsByPeriod = (
  rows: AdminDashboardAcquisitionEventRow[],
  period: DashboardPeriod,
) => {
  const startTime = getDashboardPeriodStartTime(period);

  if (startTime === null) {
    return rows;
  }

  return rows.filter((row) => Date.parse(row.day) >= startTime);
};

const sumVisits = (rows: AdminDashboardAcquisitionEventRow[]) =>
  rows.reduce((sum, row) => sum + row.visits, 0);

const calculateGrowthRate = (currentValue: number, previousValue: number) => {
  if (previousValue <= 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

const createSearchTrendRows = (
  rows: AdminDashboardAcquisitionEventRow[],
): DashboardSeriesRow[] => {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    counts.set(row.day, (counts.get(row.day) ?? 0) + row.visits);
  });

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({ label: label.slice(5), value }));
};

const createBarRows = (
  rows: AdminDashboardAcquisitionEventRow[],
  keyGetter: (row: AdminDashboardAcquisitionEventRow) => string,
  detailGetter?: (row: AdminDashboardAcquisitionEventRow) => string,
  limit = 7,
): DashboardBarRow[] => {
  const counts = new Map<string, { detail?: string; value: number }>();

  rows.forEach((row) => {
    const label = keyGetter(row).trim();

    if (!label || label === "not provided" || label === "차종 확인 불가") {
      return;
    }

    const current = counts.get(label) ?? { detail: detailGetter?.(row), value: 0 };
    current.value += row.visits;
    counts.set(label, current);
  });

  return Array.from(counts.entries())
    .map(([label, item]) => ({ label, ...item }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, limit);
};

const createChannelRows = (
  rows: AdminDashboardAcquisitionEventRow[],
): TrafficSourceDonutItem[] => {
  const counts = new Map(trafficSourceConfig.map((item) => [item.label, 0]));

  rows.forEach((row) => {
    const source = normalizeTrafficSourceGroup(row.channel);
    counts.set(source, (counts.get(source) ?? 0) + row.visits);
  });

  return trafficSourceConfig.map((item) => ({
    ...item,
    value: counts.get(item.label) ?? 0,
  }));
};

const formatLandingPageLabel = (path: string) => {
  if (!path || path === "/") return "메인";
  if (path.startsWith("/lookup")) return "차량조회";
  if (path.startsWith("/knowledge")) return "Knowledge";
  if (path.startsWith("/community")) return "커뮤니티";
  if (path.startsWith("/notice") || path.includes("notice")) return "공지";
  if (path.startsWith("/car/")) return "차량상세";

  return path;
};

const formatDashboardPercent = (value: number | null) =>
  value === null ? "연동 대기" : value.toFixed(1) + "%";

function DashboardPanel({
  activeDashboardTab,
  dashboardViewFilter,
  onChangeAiCandidateStatus,
  onChangeDashboardTab,
  onChangePeriod,
  onChangeViewFilter,
  onNavigate,
  operatorDashboardData,
  period,
  posts,
  reports,
  reviews,
  stats,
  trafficStats,
  users,
}: {
  activeDashboardTab: DashboardBoardTab;
  dashboardViewFilter: DashboardViewFilter;
  onChangeAiCandidateStatus: (
    candidate: AdminDashboardAiCandidate,
    nextStatus: AiCandidateStatus,
  ) => void;
  onChangeDashboardTab: (tab: DashboardBoardTab) => void;
  onChangePeriod: (period: DashboardPeriod) => void;
  onChangeViewFilter: (filter: DashboardViewFilter) => void;
  onNavigate: (tab: AdminTab) => void;
  operatorDashboardData: AdminOperatorDashboardData;
  period: DashboardPeriod;
  posts: AdminCommunityPost[];
  reports: AdminReport[];
  reviews: AdminReview[];
  stats: AdminStats;
  trafficStats: AdminTrafficStats;
  users: AdminUserProfile[];
}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTime = todayStart.getTime();
  const yesterdayStartTime = todayStartTime - 24 * 60 * 60 * 1000;
  const todayReviews = reviews.filter(
    (review) => Date.parse(review.created_at) >= todayStartTime,
  );
  const yesterdayReviews = reviews.filter((review) => {
    const createdAt = Date.parse(review.created_at);
    return createdAt >= yesterdayStartTime && createdAt < todayStartTime;
  });
  const todayPosts = posts.filter(
    (post) => Date.parse(post.created_at) >= todayStartTime,
  );
  const todayUsers = users.filter(
    (account) => Date.parse(account.created_at) >= todayStartTime,
  );
  const todayReports = reports.filter(
    (report) => Date.parse(report.created_at) >= todayStartTime,
  );
  const pendingReports = reports.filter((report) => !report.is_hidden);
  const reviewingAiCandidates = operatorDashboardData.aiCandidates.filter(
    (candidate) => candidate.status === "reviewing",
  );
  const appliedAiCandidates = operatorDashboardData.aiCandidates.filter(
    (candidate) => candidate.status === "applied",
  );
  const yesterdayDelta = todayReviews.length - yesterdayReviews.length;
  const summaryItems = [
    {
      label: "오늘 등록 후기",
      value: todayReviews.length || trafficStats.todayReviews,
      detail:
        yesterdayDelta === 0
          ? "어제와 동일"
          : (yesterdayDelta > 0 ? "+" : "") + yesterdayDelta.toLocaleString() + " 어제 대비",
      tab: "reviews" as AdminTab,
    },
    {
      label: "신규 회원",
      value: todayUsers.length,
      detail: "최근 가입 확인",
      tab: "users" as AdminTab,
    },
    {
      label: "신고 접수",
      value: todayReports.length,
      detail: "오늘 접수",
      tab: "reports" as AdminTab,
    },
    {
      label: "AI 반영 후보",
      value: reviewingAiCandidates.length,
      detail: "검토 대기",
      tab: "ai" as AdminTab,
    },
    {
      label: "미처리 신고",
      value: pendingReports.length,
      detail: "운영 처리 필요",
      tab: "reports" as AdminTab,
    },
    {
      label: "오늘 게시글",
      value: todayPosts.length,
      detail: "공지 제외 포함",
      tab: "posts" as AdminTab,
    },
  ];
  const filteredRankings = operatorDashboardData.viewRankings.filter(
    (item) => item.type === dashboardViewFilter,
  );
  const recentReviews = reviews.slice(0, 5);
  const recentPosts = posts.filter((post) => !post.is_notice).slice(0, 5);
  const recentUsers = users.slice(0, 5).map((account) => ({
    id: account.id,
    meta: formatDate(account.created_at),
    title:
      (account.nickname ?? "닉네임 없음") +
      " (" +
      formatCompactId(account.id, 8) +
      ")",
  }));
  const chartRows = createDashboardChartRows({
    aiCandidates: appliedAiCandidates,
    posts,
    reports,
    reviews,
    users,
  });
  const todoItems = [
    { label: "AI 반영 후보", count: reviewingAiCandidates.length, tab: "ai" as AdminTab, tone: "red" },
    { label: "신고 대기", count: pendingReports.length, tab: "reports" as AdminTab, tone: "yellow" },
    { label: "신규 회원", count: todayUsers.length, tab: "users" as AdminTab, tone: "green" },
    { label: "오늘 등록 후기", count: todayReviews.length || trafficStats.todayReviews, tab: "reviews" as AdminTab, tone: "blue" },
  ];
  const trafficSourceItems = createTrafficSourceDonutItems(
    trafficStats.referrerTop,
  );
  const filteredAcquisitionRows = filterAcquisitionRowsByPeriod(
    operatorDashboardData.acquisitionRows,
    period,
  );
  const previousRange = period === "all" ? null : getPreviousPeriodRange(period);
  const previousAcquisitionRows = previousRange
    ? operatorDashboardData.acquisitionRows.filter((row) => {
        const time = Date.parse(row.day);
        return time >= previousRange.start && time < previousRange.end;
      })
    : [];
  const currentSearchVisits = sumVisits(filteredAcquisitionRows);
  const previousSearchVisits = sumVisits(previousAcquisitionRows);
  const periodGrowthRate = calculateGrowthRate(
    currentSearchVisits,
    previousSearchVisits,
  );
  const weekStartRange = getPreviousPeriodRange("7days");
  const thisWeekVisits = sumVisits(
    operatorDashboardData.acquisitionRows.filter(
      (row) => Date.parse(row.day) >= getDashboardPeriodStartTime("7days")!,
    ),
  );
  const previousWeekVisits = sumVisits(
    operatorDashboardData.acquisitionRows.filter((row) => {
      const time = Date.parse(row.day);
      return time >= weekStartRange.start && time < weekStartRange.end;
    }),
  );
  const weekGrowthRate = calculateGrowthRate(thisWeekVisits, previousWeekVisits);
  const searchTrendRows = createSearchTrendRows(filteredAcquisitionRows);
  const searchChannelItems = createChannelRows(filteredAcquisitionRows);
  const topKeywordRows = createBarRows(
    filteredAcquisitionRows,
    (row) => row.keyword,
    (row) => row.channel,
  );
  const topModelRows = createBarRows(
    filteredAcquisitionRows,
    (row) => row.modelName,
    (row) => row.keyword,
  );
  const topLandingRows = createBarRows(
    filteredAcquisitionRows,
    (row) => formatLandingPageLabel(row.landingPage),
    (row) => row.landingPage,
  );
  const topSymptomRows = createBarRows(
    filteredAcquisitionRows,
    (row) => row.symptomKeyword ?? "",
    (row) => row.keyword,
  );
  const searchSummary = operatorDashboardData.searchConsoleSummary;
  const periodImpressions = filteredAcquisitionRows.reduce(
    (sum, row) => sum + row.impressions,
    0,
  );
  const periodClicks = filteredAcquisitionRows.reduce(
    (sum, row) => sum + row.clicks,
    0,
  );
  const periodCtr =
    periodImpressions > 0 ? (periodClicks / periodImpressions) * 100 : null;
  const geoScoreValues = filteredAcquisitionRows
    .map((row) => row.geoScore)
    .filter((value): value is number => value !== null);
  const periodGeoScore = geoScoreValues.length
    ? geoScoreValues.reduce((sum, value) => sum + value, 0) /
      geoScoreValues.length
    : null;
  const periodLabel =
    dashboardPeriods.find((item) => item.value === period)?.label ?? "30일";
  const searchConsoleUpdatedLabel = searchSummary.updatedAt
    ? "최근 갱신 " + formatOptionalDate(searchSummary.updatedAt)
    : "Search Console 연동 대기";

  return (
    <div>
      <div className="space-y-4 md:hidden">
        <section className={panelClassName}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-black text-blue-600">운영 Dashboard</p>
              <h2 className="mt-1 text-lg font-black text-zinc-950">
                사이트 성장 현황
              </h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                {periodLabel} 기준 검색 유입과 AI(GEO) 준비 지표입니다.
              </p>
            </div>
            <DashboardPeriodSelector
              onChange={onChangePeriod}
              value={period}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <GrowthMetricCard
              detail="외부 유입 기준"
              label="검색 유입"
              value={currentSearchVisits.toLocaleString() + "회"}
            />
            <GrowthMetricCard
              detail="선택 기간 직전 대비"
              label="성장률"
              tone={periodGrowthRate >= 0 ? "green" : "zinc"}
              value={(periodGrowthRate >= 0 ? "▲ " : "▼ ") + Math.abs(periodGrowthRate).toFixed(1) + "%"}
            />
            <GrowthMetricCard
              detail="Search Console 연동 대기"
              label="CTR"
              tone="purple"
              value={formatDashboardPercent(periodCtr)}
            />
            <GrowthMetricCard
              detail="AI 검색 대응 지표 준비"
              label="AI(GEO) 점수"
              tone="purple"
              value={
                periodGeoScore === null
                  ? "준비중"
                  : periodGeoScore.toFixed(1)
              }
            />
          </div>
        </section>
        <SearchTrendCard rows={searchTrendRows} title="검색 유입 추이" />
        <TrafficSourceDonutCard
          description="Google, Naver, Daum, Bing, SNS, Direct, 기타 비율입니다."
          items={searchChannelItems}
          title="검색엔진 비율"
        />
        <DashboardBarCard
          emptyMessage="외부 검색 키워드 데이터가 없습니다."
          rows={topKeywordRows}
          title="TOP 검색 키워드"
        />
        <DashboardBarCard
          emptyMessage="유입 차종 데이터가 없습니다."
          rows={topModelRows}
          title="인기 차종 검색"
        />
        <DashboardBarCard
          emptyMessage="랜딩페이지 데이터가 없습니다."
          rows={topLandingRows}
          title="랜딩페이지 TOP"
        />
        <DashboardBarCard
          emptyMessage="인기 증상 키워드 데이터가 없습니다."
          rows={topSymptomRows}
          title="인기 증상 키워드 TOP"
        />
        <section className="grid grid-cols-2 gap-3">
          {summaryItems.slice(0, 4).map((item) => (
            <StatCard
              key={item.label}
              detail={item.detail}
              label={item.label}
              value={item.value}
              onClick={() => onNavigate(item.tab)}
            />
          ))}
        </section>

        <section className={panelClassName}>
          <h2 className="text-base font-black text-zinc-950">오늘 해야 할 일</h2>
          <div className="mt-3 grid gap-2">
            {todoItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex min-h-12 items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left"
                onClick={() => onNavigate(item.tab)}
              >
                <span className="text-sm font-black text-zinc-800">
                  <ToneDot tone={item.tone} /> {item.label}
                </span>
                <span className="text-sm font-black text-zinc-950">
                  {item.count.toLocaleString()}건
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={panelClassName}>
          <h2 className="text-base font-black text-zinc-950">운영 알림</h2>
          <div className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-zinc-50">
            <NotificationItem
              count={pendingReports.length}
              label="미처리 신고"
              tone="red"
              onClick={() => onNavigate("reports")}
            />
            <NotificationItem
              count={reviewingAiCandidates.length}
              label="AI 검토 대기"
              tone="purple"
              onClick={() => onNavigate("ai")}
            />
            <NotificationItem
              count={todayPosts.length}
              label="오늘 게시글"
              tone="blue"
              onClick={() => onNavigate("posts")}
            />
            <NotificationItem
              count={appliedAiCandidates.length}
              label="AI 반영 완료"
              tone="green"
              onClick={() => onNavigate("ai")}
            />
          </div>
        </section>

        <DashboardMobileList
          emptyMessage="최근 후기가 없습니다."
          items={recentReviews.map((review) => ({
            id: review.id,
            meta: formatDate(review.created_at),
            title:
              formatAdminPlateNumber(getReviewPlateNumber(review)) +
              " · " +
              review.content,
          }))}
          title="최근 후기"
        />
        <DashboardMobileList
          emptyMessage="최근 가입 회원이 없습니다."
          items={recentUsers}
          title="최근 회원"
        />
        <DashboardMobileList
          emptyMessage="최근 신고가 없습니다."
          items={reports.slice(0, 5).map((report) => ({
            id: report.report_id,
            meta: report.report_type + " · " + formatDate(report.created_at),
            title: report.target_title ?? report.target_content,
          }))}
          title="최근 신고"
        />

        <section className={panelClassName}>
          <h2 className="text-base font-black text-zinc-950">통계</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            최근 30일 운영 흐름입니다.
          </p>
          <DashboardLineChart rows={chartRows} />
        </section>
      </div>

      <div className="hidden space-y-4 md:block">
      <section className={panelClassName}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black text-blue-600">운영 Dashboard</p>
            <h2 className="mt-1 text-xl font-black text-zinc-950">
              사이트 성장 현황
            </h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              {periodLabel} 기준 검색 유입, Search Console 준비 지표, AI(GEO) 성장 현황입니다.
            </p>
          </div>
          <DashboardPeriodSelector onChange={onChangePeriod} value={period} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <GrowthMetricCard
            detail="외부 유입 기준"
            label="검색 유입"
            value={currentSearchVisits.toLocaleString() + "회"}
          />
          <GrowthMetricCard
            detail="선택 기간 직전 대비"
            label="기간 성장률"
            tone={periodGrowthRate >= 0 ? "green" : "zinc"}
            value={(periodGrowthRate >= 0 ? "▲ " : "▼ ") + Math.abs(periodGrowthRate).toFixed(1) + "%"}
          />
          <GrowthMetricCard
            detail="지난 7일 vs 직전 7일"
            label="지난주 대비"
            tone={weekGrowthRate >= 0 ? "green" : "zinc"}
            value={(weekGrowthRate >= 0 ? "▲ " : "▼ ") + Math.abs(weekGrowthRate).toFixed(1) + "%"}
          />
          <GrowthMetricCard
            detail="AI 검색 대응 지표 구조 준비"
            label="AI(GEO) 점수"
            tone="purple"
            value={
              periodGeoScore === null
                ? "준비중"
                : periodGeoScore.toFixed(1)
            }
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <SearchTrendCard rows={searchTrendRows} title="검색 유입 추이" />
        <TrafficSourceDonutCard
          description="Google, Naver, Daum, Bing, SNS, Direct, 기타 비율입니다."
          items={searchChannelItems}
          title="검색엔진 비율"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <DashboardBarCard
          emptyMessage="외부 검색 키워드 데이터가 없습니다."
          rows={topKeywordRows}
          title="TOP 검색 키워드"
        />
        <DashboardBarCard
          emptyMessage="유입 차종 데이터가 없습니다."
          rows={topModelRows}
          title="인기 차종 검색"
        />
        <DashboardBarCard
          emptyMessage="랜딩페이지 데이터가 없습니다."
          rows={topLandingRows}
          title="랜딩페이지 TOP"
        />
        <DashboardBarCard
          emptyMessage="인기 증상 키워드 데이터가 없습니다."
          rows={topSymptomRows}
          title="인기 증상 키워드 TOP"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <GrowthMetricCard
          detail={searchConsoleUpdatedLabel}
          label="노출수"
          tone="zinc"
          value={periodImpressions.toLocaleString()}
        />
        <GrowthMetricCard
          detail="Search Console/GA 클릭 지표"
          label="클릭수"
          tone="zinc"
          value={periodClicks.toLocaleString()}
        />
        <GrowthMetricCard
          detail="노출수 대비 클릭률"
          label="CTR"
          tone="purple"
          value={formatDashboardPercent(periodCtr)}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryItems.map((item) => (
          <StatCard
            key={item.label}
            detail={item.detail}
            label={item.label}
            value={item.value}
            onClick={() => onNavigate(item.tab)}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.15fr)_minmax(0,0.8fr)]">
        <div className={panelClassName}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-zinc-950">오늘 해야 할 일</h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                처리 우선순위가 높은 항목입니다.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {todoItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                onClick={() => onNavigate(item.tab)}
              >
                <span className="text-sm font-black text-zinc-800">
                  <ToneDot tone={item.tone} /> {item.label}
                </span>
                <span className="text-sm font-black text-zinc-950">
                  {item.count.toLocaleString()}건
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={panelClassName}>
          <h2 className="text-lg font-black text-zinc-950">최근 30일 운영 흐름</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            후기, 회원, 게시글, AI 반영, 신고 추이를 한 화면에서 봅니다.
          </p>
          <DashboardLineChart rows={chartRows} />
        </div>
        <TrafficSourceDonutCard items={trafficSourceItems} />
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <DashboardRecentList
          emptyMessage="최근 후기가 없습니다."
          items={recentReviews.map((review) => ({
            id: review.id,
            meta: formatDate(review.created_at),
            title: formatAdminPlateNumber(getReviewPlateNumber(review)) + " · " + review.content,
          }))}
          title="최근 후기"
        />
        <DashboardRecentList
          emptyMessage="최근 게시글이 없습니다."
          items={recentPosts.map((post) => ({
            id: post.id,
            meta: getPostCategoryLabel(post) + " · " + formatDate(post.created_at),
            title: post.title,
          }))}
          title="최근 게시글"
        />
        <DashboardRecentList
          emptyMessage="최근 가입 회원은 회원 관리에서 확인하세요."
          items={recentUsers}
          title="최근 가입 회원"
        />
        <DashboardRecentList
          emptyMessage="최근 신고가 없습니다."
          items={reports.slice(0, 5).map((report) => ({
            id: report.report_id,
            meta: report.report_type + " · " + formatDate(report.created_at),
            title: report.target_title ?? report.target_content,
          }))}
          title="최근 신고"
        />
      </section>

      <section className={panelClassName}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-zinc-950">운영 분석</h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              트래픽, 조회수, 콘텐츠, 키워드, AI DB 업데이트 추천을 탭으로 확인합니다.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dashboardBoardTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={cn(
                  categoryFilterButtonClassName,
                  activeDashboardTab === tab.value &&
                    activeCategoryFilterButtonClassName,
                )}
                onClick={() => onChangeDashboardTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
          {activeDashboardTab === "traffic" ? (
            <DashboardTrafficTable rows={operatorDashboardData.trafficRows} />
          ) : null}
          {activeDashboardTab === "views" ? (
            <DashboardViewsTable
              filter={dashboardViewFilter}
              onChangeFilter={onChangeViewFilter}
              rows={filteredRankings}
            />
          ) : null}
          {activeDashboardTab === "content" ? (
            <DashboardContentTable
              posts={recentPosts}
              reports={reports}
              reviews={recentReviews}
              stats={stats}
            />
          ) : null}
          {activeDashboardTab === "keywords" ? (
            <DashboardAcquisitionKeywordTable
              rows={operatorDashboardData.keywordRows}
            />
          ) : null}
          {activeDashboardTab === "internalKeywords" ? (
            <DashboardInternalKeywordTable
              rows={operatorDashboardData.internalKeywordRows}
            />
          ) : null}
          {activeDashboardTab === "ai" ? (
            <DashboardAiCandidateTable
              candidates={operatorDashboardData.aiCandidates}
              onChangeStatus={onChangeAiCandidateStatus}
              reviews={reviews}
            />
          ) : null}
        </div>
      </section>
      </div>
    </div>
  );
}

function StatCard({
  detail,
  label,
  onClick,
  value,
}: {
  detail?: string;
  label: string;
  onClick?: () => void;
  value: number;
}) {
  return (
    <button
      type="button"
      className="rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm shadow-zinc-200/60 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-4"
      onClick={onClick}
    >
      <p className="truncate text-xs font-black text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">
        {value.toLocaleString()}
      </p>
      {detail ? (
        <p className="mt-2 truncate text-xs font-bold text-blue-600">{detail}</p>
      ) : null}
    </button>
  );
}

function DashboardPeriodSelector({
  onChange,
  value,
}: {
  onChange: (period: DashboardPeriod) => void;
  value: DashboardPeriod;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {dashboardPeriods.map((item) => (
        <button
          key={item.value}
          type="button"
          className={cn(
            categoryFilterButtonClassName,
            value === item.value && activeCategoryFilterButtonClassName,
          )}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function GrowthMetricCard({
  detail,
  label,
  tone = "blue",
  value,
}: {
  detail: string;
  label: string;
  tone?: "blue" | "green" | "purple" | "zinc";
  value: string;
}) {
  const toneClassName =
    tone === "green"
      ? "text-emerald-600"
      : tone === "purple"
        ? "text-purple-600"
        : tone === "zinc"
          ? "text-zinc-600"
          : "text-blue-600";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-200/60">
      <p className="text-xs font-black text-zinc-500">{label}</p>
      <p className={cn("mt-2 text-2xl font-black tracking-tight", toneClassName)}>
        {value}
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function SearchTrendCard({
  rows,
  title,
}: {
  rows: DashboardSeriesRow[];
  title: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  const width = 760;
  const height = 220;
  const padding = 28;
  const xStep = (width - padding * 2) / Math.max(1, rows.length - 1);
  const path = rows
    .map((row, index) => {
      const x = padding + index * xStep;
      const y =
        height - padding - (row.value / maxValue) * (height - padding * 2);

      return (index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    })
    .join(" ");

  return (
    <section className={panelClassName}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-zinc-950">{title}</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            외부 유입 기준 일별 추이입니다.
          </p>
        </div>
        <p className="text-xs font-black text-zinc-400">
          {rows.reduce((sum, row) => sum + row.value, 0).toLocaleString()}회
        </p>
      </div>
      <div className="mt-4 overflow-hidden md:overflow-x-auto">
        {rows.length ? (
          <svg
            className="h-[190px] w-full min-w-0 md:min-w-[620px]"
            viewBox={"0 0 " + width + " " + height}
            role="img"
            aria-label={title}
          >
            {[0, 1, 2, 3].map((line) => {
              const y = padding + line * ((height - padding * 2) / 3);
              return (
                <line
                  key={line}
                  x1={padding}
                  x2={width - padding}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              );
            })}
            <path
              d={path}
              fill="none"
              stroke="#2563eb"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {rows.map((row, index) => {
              const x = padding + index * xStep;
              const y =
                height - padding - (row.value / maxValue) * (height - padding * 2);

              return (
                <g key={row.label + index}>
                  <circle cx={x} cy={y} fill="#2563eb" r="3.5" />
                  {index === 0 || index === rows.length - 1 ? (
                    <text
                      fill="#71717a"
                      fontSize="11"
                      fontWeight="700"
                      textAnchor={index === 0 ? "start" : "end"}
                      x={x}
                      y={height - 6}
                    >
                      {row.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : (
          <DashboardEmptyState message="검색 유입 추이 데이터가 없습니다." />
        )}
      </div>
    </section>
  );
}

function TrafficSourceDonutCard({
  description = "주요 유입 채널 비율입니다.",
  items,
  title = "트래픽 유입",
}: {
  description?: string;
  items: TrafficSourceDonutItem[];
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"doughnut"> | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const chartValues = total > 0 ? items.map((item) => item.value) : [1];
    const chartColors =
      total > 0 ? items.map((item) => item.color) : ["#e5e7eb"];

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: total > 0 ? items.map((item) => item.label) : ["데이터 없음"],
        datasets: [
          {
            data: chartValues,
            backgroundColor: chartColors,
            borderColor: "#ffffff",
            borderWidth: 3,
            hoverOffset: 3,
          },
        ],
      },
      options: {
        animation: false,
        cutout: "68%",
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (total <= 0) return "데이터 없음";
                const value = Number(context.raw ?? 0);
                const percent = Math.round((value / total) * 100);

                return context.label + " " + percent.toLocaleString() + "%";
              },
            },
          },
        },
        responsive: true,
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [items, total]);

  return (
    <section className={panelClassName}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-zinc-950">{title}</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {description}
          </p>
        </div>
        <p className="text-xs font-black text-zinc-400">
          {total.toLocaleString()}명
        </p>
      </div>
      <div className="mt-4 grid grid-cols-[128px_minmax(0,1fr)] items-center gap-4">
        <div className="relative h-32 w-32">
          <canvas ref={canvasRef} aria-label="트래픽 유입 도넛 차트" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black text-zinc-500">
              {total > 0 ? "유입" : "대기"}
            </span>
          </div>
        </div>
        <dl className="min-w-0 space-y-2">
          {items.map((item) => {
            const percent =
              total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <div
                key={item.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs"
              >
                <dt className="flex min-w-0 items-center gap-2 font-bold text-zinc-700">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </dt>
                <dd className="font-black text-zinc-950">
                  {percent.toLocaleString()}%
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

function DashboardBarCard({
  emptyMessage,
  rows,
  title,
}: {
  emptyMessage: string;
  rows: DashboardBarRow[];
  title: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className={panelClassName}>
      <h2 className="text-base font-black text-zinc-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <p className="min-w-0 truncate font-black text-zinc-800">
                  {row.label}
                </p>
                <p className="shrink-0 font-black text-zinc-950">
                  {row.value.toLocaleString()}회
                </p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: Math.max(6, (row.value / maxValue) * 100) + "%" }}
                />
              </div>
              {row.detail ? (
                <p className="mt-1 truncate text-xs font-medium text-zinc-500">
                  {row.detail}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className={mutedTextClassName}>{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function DashboardMobileList({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: { id: string; meta: string; title: string }[];
  title: string;
}) {
  return (
    <section className={panelClassName}>
      <h2 className="text-base font-black text-zinc-950">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
            >
              <p className="line-clamp-2 break-words text-sm font-bold leading-5 text-zinc-900">
                {item.title}
              </p>
              <p className="mt-1 line-clamp-1 break-words text-xs leading-5 text-zinc-500">
                {item.meta}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(mutedTextClassName, "mt-3")}>{emptyMessage}</p>
      )}
    </section>
  );
}

function DashboardTrafficTable({
  rows,
}: {
  rows: AdminDashboardTrafficRow[];
}) {
  if (!rows.length) {
    return <DashboardEmptyState message="트래픽 기록이 없습니다." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[920px] divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <DashboardHeadCell>날짜</DashboardHeadCell>
            <DashboardHeadCell>방문자 수</DashboardHeadCell>
            <DashboardHeadCell>조회수</DashboardHeadCell>
            <DashboardHeadCell>주요 유입 경로</DashboardHeadCell>
            <DashboardHeadCell>PC/모바일 비율</DashboardHeadCell>
            <DashboardHeadCell>브라우저/OS 요약</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {rows.map((row) => (
            <tr key={row.date}>
              <DashboardCell strong>{row.date}</DashboardCell>
              <DashboardCell>{row.visitors.toLocaleString()}</DashboardCell>
              <DashboardCell>{row.views.toLocaleString()}</DashboardCell>
              <DashboardCell>{formatReferrerLabel(row.topReferrer)}</DashboardCell>
              <DashboardCell>{formatDeviceRatio(row)}</DashboardCell>
              <DashboardCell>{row.browserOsSummary}</DashboardCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardViewsTable({
  filter,
  onChangeFilter,
  rows,
}: {
  filter: DashboardViewFilter;
  onChangeFilter: (filter: DashboardViewFilter) => void;
  rows: AdminDashboardViewRanking[];
}) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 bg-zinc-50 p-3">
        {dashboardViewFilters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn(
              "shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
              filter === item.value &&
                "border-blue-600 bg-blue-600 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white",
            )}
            onClick={() => onChangeFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[840px] divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <DashboardHeadCell>순위</DashboardHeadCell>
                <DashboardHeadCell>
                  {filter === "vehicle"
                    ? "차량번호"
                    : filter === "model"
                      ? "모델명"
                      : "후기"}
                </DashboardHeadCell>
                <DashboardHeadCell>모델명</DashboardHeadCell>
                <DashboardHeadCell>조회수</DashboardHeadCell>
                <DashboardHeadCell>최근 조회일</DashboardHeadCell>
                <DashboardHeadCell align="right">상세보기</DashboardHeadCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {rows.map((row) => (
                <tr key={row.type + row.targetId + row.rank}>
                  <DashboardCell strong>{row.rank}</DashboardCell>
                  <DashboardCell strong>{row.title}</DashboardCell>
                  <DashboardCell>{row.modelName}</DashboardCell>
                  <DashboardCell>{row.viewCount.toLocaleString()}</DashboardCell>
                  <DashboardCell>{formatOptionalDate(row.recentViewedAt)}</DashboardCell>
                  <DashboardCell align="right">
                    {row.href ? (
                      <Link className={actionButtonClassName} href={row.href}>
                        상세보기
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-600">-</span>
                    )}
                  </DashboardCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DashboardEmptyState message="조회수 기록이 없습니다." />
      )}
    </div>
  );
}

function DashboardContentTable({
  posts,
  reports,
  reviews,
  stats,
}: {
  posts: AdminCommunityPost[];
  reports: AdminReport[];
  reviews: AdminReview[];
  stats: AdminStats;
}) {
  const rows = [
    {
      label: "게시글 수",
      value: stats.communityPosts.toLocaleString(),
      detail: posts[0]?.title ?? "최근 게시글 없음",
    },
    {
      label: "후기 수",
      value: stats.reviews.toLocaleString(),
      detail: reviews[0]?.content ?? "최근 후기 없음",
    },
    {
      label: "댓글 수",
      value: stats.comments.toLocaleString(),
      detail: "커뮤니티 댓글 전체",
    },
    {
      label: "신고 수",
      value: stats.reports.toLocaleString(),
      detail: reports[0]?.target_title ?? reports[0]?.target_content ?? "신고 없음",
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <DashboardHeadCell>항목</DashboardHeadCell>
            <DashboardHeadCell>건수</DashboardHeadCell>
            <DashboardHeadCell>관리자가 볼 내용</DashboardHeadCell>
            <DashboardHeadCell>최근 등록/발생</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {rows.map((row) => (
            <tr key={row.label}>
              <DashboardCell strong>{row.label}</DashboardCell>
              <DashboardCell>{row.value}</DashboardCell>
              <DashboardCell>{row.detail}</DashboardCell>
              <DashboardCell>
                {row.label === "게시글 수"
                  ? formatOptionalDate(posts[0]?.created_at)
                  : row.label === "후기 수"
                    ? formatOptionalDate(reviews[0]?.created_at)
                    : row.label === "신고 수"
                      ? formatOptionalDate(reports[0]?.created_at)
                      : "-"}
              </DashboardCell>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-0 border-t border-zinc-200 md:grid-cols-2">
        <DashboardRecentList
          emptyMessage="최근 후기가 없습니다."
          items={reviews.map((review) => ({
            id: review.id,
            meta: [review.author_nickname, formatReviewVehicleSummary(review)]
              .filter(Boolean)
              .join(" · "),
            title: review.content,
          }))}
          title="최근 등록된 후기"
        />
        <DashboardRecentList
          emptyMessage="최근 게시글이 없습니다."
          items={posts.map((post) => ({
            id: post.id,
            meta: [
              getCommunityCategoryLabel(post.category),
              post.author_nickname,
              formatOptionalDate(post.created_at),
            ]
              .filter(Boolean)
              .join(" · "),
            title: post.title,
          }))}
          title="최근 등록된 게시글"
        />
      </div>
    </div>
  );
}

function DashboardAcquisitionKeywordTable({
  rows,
}: {
  rows: AdminDashboardAcquisitionKeywordRow[];
}) {
  if (!rows.length) {
    return <DashboardEmptyState message="외부 유입 키워드 데이터가 없습니다." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <DashboardHeadCell>키워드명</DashboardHeadCell>
            <DashboardHeadCell>유입 채널</DashboardHeadCell>
            <DashboardHeadCell>유입 횟수</DashboardHeadCell>
            <DashboardHeadCell>랜딩 페이지</DashboardHeadCell>
            <DashboardHeadCell>최근 유입일</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {rows.map((row) => (
            <tr key={row.keyword + row.channel + row.landingPage}>
              <DashboardCell strong>{row.keyword}</DashboardCell>
              <DashboardCell>{row.channel}</DashboardCell>
              <DashboardCell>{row.visitCount.toLocaleString()}회</DashboardCell>
              <DashboardCell>{row.landingPage}</DashboardCell>
              <DashboardCell>{formatOptionalDate(row.recentOccurredAt)}</DashboardCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardInternalKeywordTable({
  rows,
}: {
  rows: AdminDashboardKeywordRow[];
}) {
  if (!rows.length) {
    return (
      <DashboardEmptyState message="10회 이상 언급된 내부 후기 키워드가 없습니다." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <DashboardHeadCell>키워드명</DashboardHeadCell>
            <DashboardHeadCell>언급 횟수</DashboardHeadCell>
            <DashboardHeadCell>관련 차량/모델</DashboardHeadCell>
            <DashboardHeadCell>최근 발생일</DashboardHeadCell>
            <DashboardHeadCell>AI 데이터 반영 여부</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {rows.map((row) => (
            <tr key={row.keyword}>
              <DashboardCell strong>{row.keyword}</DashboardCell>
              <DashboardCell>{row.mentionCount.toLocaleString()}회</DashboardCell>
              <DashboardCell>{formatModelList(row.relatedModels)}</DashboardCell>
              <DashboardCell>{formatOptionalDate(row.recentOccurredAt)}</DashboardCell>
              <DashboardCell>
                <AiStatusBadge status={row.aiStatus} />
              </DashboardCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiManagementPanel({
  activeTab,
  candidates,
  keywordRules,
  maintenanceRules,
  onChangeCandidateStatus,
  onChangeKeywordRules,
  onChangeMaintenanceRules,
  onRegisterCandidate,
  onChangeTab,
  reviews,
}: {
  activeTab: AiManagementTab;
  candidates: AdminDashboardAiCandidate[];
  keywordRules: AdminAiKeywordRule[];
  maintenanceRules: AdminAiMaintenanceRule[];
  onChangeCandidateStatus: (
    candidate: AdminDashboardAiCandidate,
    nextStatus: AiCandidateStatus,
  ) => void;
  onChangeKeywordRules: (rules: AdminAiKeywordRule[]) => void;
  onChangeMaintenanceRules: (rules: AdminAiMaintenanceRule[]) => void;
  onRegisterCandidate: (
    candidate: AdminDashboardAiCandidate,
    values: AdminNewKeywordCandidateFormValues,
  ) => void;
  onChangeTab: (tab: AiManagementTab) => void;
  reviews: AdminReview[];
}) {
  return (
    <div className="divide-y divide-zinc-200 bg-white">
      <div className="bg-zinc-50 px-4 py-3">
        <h3 className="text-sm font-black text-zinc-950">
          AI DB 로드맵 / 키워드 관리
        </h3>
        <p className="mt-1 text-xs font-medium text-zinc-500">
          대표 키워드, 포함/제외 키워드, 유종 조건, 기본 정비항목 룰을 한 곳에서 관리합니다.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto bg-zinc-50 px-4 py-3">
        {aiManagementTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              "shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
              activeTab === tab.value &&
                "border-zinc-950 bg-zinc-950 text-white hover:border-zinc-950 hover:bg-zinc-950 hover:text-white",
            )}
            onClick={() => onChangeTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "keywords" ? (
        <AiKeywordRuleManager
          rules={keywordRules}
          onChangeRules={onChangeKeywordRules}
        />
      ) : null}
      {activeTab === "maintenance" ? (
        <AiMaintenanceRuleManager
          rules={maintenanceRules}
          onChangeRules={onChangeMaintenanceRules}
        />
      ) : null}
      {activeTab === "candidates" ? (
        <NewKeywordCandidateDetector
          candidates={candidates}
          onChangeStatus={onChangeCandidateStatus}
          onRegisterCandidate={onRegisterCandidate}
          reviews={reviews}
        />
      ) : null}
    </div>
  );
}

function KnowledgeCenterPanel({
  onChangeSearch,
  onChangeSort,
  onDelete,
  onSave,
  onSelect,
  onToggleVisible,
  search,
  selectedTerm,
  sort,
  terms,
}: {
  onChangeSearch: (value: string) => void;
  onChangeSort: (value: KnowledgeSortOption) => void;
  onDelete: (term: AdminKnowledgeTerm) => void;
  onSave: (values: AdminKnowledgeTermFormValues, term?: AdminKnowledgeTerm) => void;
  onSelect: (id: string | null) => void;
  onToggleVisible: (term: AdminKnowledgeTerm) => void;
  search: string;
  selectedTerm: AdminKnowledgeTerm | null;
  sort: KnowledgeSortOption;
  terms: AdminKnowledgeTerm[];
}) {
  const [editingTerm, setEditingTerm] = useState<AdminKnowledgeTerm | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<AdminKnowledgeTermFormValues>(
    createKnowledgeTermFormValues(),
  );
  const openForm = (term?: AdminKnowledgeTerm) => {
    setEditingTerm(term ?? null);
    setFormValues(createKnowledgeTermFormValues(term));
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTerm(null);
  };
  const submitForm = () => {
    onSave(formValues, editingTerm ?? undefined);
    closeForm();
  };

  return (
    <div className="divide-y divide-zinc-200 bg-white">
      <div className="bg-zinc-50 px-4 py-3">
        <h3 className="text-sm font-black text-zinc-950">Knowledge Center</h3>
        <p className="mt-1 text-xs font-medium text-zinc-500">
          용어/증상 DB를 관리합니다.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto bg-zinc-50 px-4 py-3">
        <button
          type="button"
          className="shrink-0 rounded-lg border border-zinc-950 bg-zinc-950 px-3 py-1.5 text-xs font-black text-white"
        >
          용어/증상 DB
        </button>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          className={inputClassName}
          placeholder="대표명, slug, 설명, 원인, 증상, 키워드, 차종, 우선순위 검색"
          value={search}
          onChange={(event) => onChangeSearch(event.target.value)}
        />
        <select
          className={adminInputClassName}
          value={sort}
          onChange={(event) =>
            onChangeSort(normalizeKnowledgeSortOption(event.target.value))
          }
        >
          {knowledgeSortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" className={actionButtonClassName} onClick={() => openForm()}>
          항목 추가
        </button>
      </div>
      {selectedTerm ? (
        <div className="border-t border-zinc-100 bg-blue-50/50 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-blue-700">
                선택 항목 · {selectedTerm.category} · {selectedTerm.slug} · 우선순위 {selectedTerm.priority}
              </p>
              <h4 className="mt-1 text-base font-black text-zinc-950">
                {selectedTerm.representative_name}
              </h4>
              <p className="mt-1 line-clamp-3 text-sm leading-6 text-zinc-600">
                {selectedTerm.description || "설명 없음"}
              </p>
            </div>
            <button
              type="button"
              className={actionButtonClassName}
              onClick={() => onSelect(null)}
            >
              선택 해제
            </button>
          </div>
        </div>
      ) : null}
      <table className={desktopTableClassName}>
        <thead className="bg-zinc-50">
          <tr>
            <th className={tableHeadCellClassName}>분류</th>
            <th className={tableHeadCellClassName}>대표명 / slug / 설명</th>
            <th className={tableHeadCellClassName}>주요 원인 / 증상</th>
            <th className={tableHeadCellClassName}>정비 팁 / 수리비</th>
            <th className={tableHeadCellClassName}>키워드 / 차종</th>
            <th className={tableHeadCellClassName}>우선순위 / 조회수</th>
            <th className={tableHeadCellClassName}>노출</th>
            <th className={tableHeadCellClassName}>최종 수정일</th>
            <th className={tableHeadCellClassName}>관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {terms.length ? (
            terms.map((term) => (
              <tr
                key={term.id}
                className="cursor-pointer transition hover:bg-zinc-50"
                onClick={() => onSelect(term.id)}
              >
                <td className={tableCellClassName}>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-black text-zinc-700">
                    {term.category}
                  </span>
                </td>
                <td className={tableCellClassName}>
                  <p className="font-black text-zinc-950">
                    {term.representative_name}
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-blue-600">
                    {term.slug}
                  </p>
                  <p className="mt-1 line-clamp-2 max-w-[18rem] text-xs leading-5 text-zinc-500">
                    {term.description || "설명 없음"}
                  </p>
                </td>
                <td className={tableCellClassName}>
                  <KnowledgeListPreview
                    emptyLabel="원인 없음"
                    items={term.main_causes}
                  />
                  <KnowledgeListPreview
                    className="mt-1"
                    emptyLabel="증상 없음"
                    items={term.main_symptoms}
                  />
                </td>
                <td className={tableCellClassName}>
                  <p className="text-xs font-black text-zinc-950">
                    {term.priority.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    조회 {term.view_count.toLocaleString()}회
                  </p>
                </td>
                <td className={tableCellClassName}>
                  <KnowledgeListPreview
                    emptyLabel="팁 없음"
                    items={term.maintenance_tips}
                  />
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {term.expected_repair_cost || "수리비 정보 없음"}
                  </p>
                </td>
                <td className={tableCellClassName}>
                  <KnowledgeListPreview
                    emptyLabel="키워드 없음"
                    items={term.related_keywords}
                  />
                  <KnowledgeListPreview
                    className="mt-1"
                    emptyLabel="차종 없음"
                    items={term.related_models}
                  />
                </td>
                <td className={tableCellClassName}>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-black",
                      term.is_visible
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500",
                    )}
                  >
                    {term.is_visible ? "노출" : "비노출"}
                  </span>
                </td>
                <td className={tableCellClassName}>
                  {formatOptionalDate(term.updated_at)}
                </td>
                <td
                  className={tableActionCellClassName}
                  onClick={(event) => event.stopPropagation()}
                >
                  <KnowledgeActionButtons
                    onDelete={onDelete}
                    onEdit={openForm}
                    onToggleVisible={onToggleVisible}
                    term={term}
                  />
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={9} message="Knowledge 항목이 없습니다." />
          )}
        </tbody>
      </table>
      <div className={mobileListClassName}>
        {terms.length ? (
          terms.map((term) => (
            <div
              key={term.id}
              className={mobileCardClassName}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(term.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSelect(term.id);
              }}
            >
              <div className="min-w-0">
                <p className={mobileCardTitleClassName}>
                  {term.representative_name}
                </p>
                <p className={mobileCardMetaClassName}>
                  {term.category} · {term.slug} · 우선순위 {term.priority.toLocaleString()} · 조회 {term.view_count.toLocaleString()}회 · {term.is_visible ? "노출" : "비노출"} ·{" "}
                  {formatOptionalDate(term.updated_at)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                  {term.description || "설명 없음"}
                </p>
              </div>
              <div onClick={(event) => event.stopPropagation()}>
                <KnowledgeActionButtons
                  onDelete={onDelete}
                  onEdit={openForm}
                  onToggleVisible={onToggleVisible}
                  term={term}
                />
              </div>
            </div>
          ))
        ) : (
          <EmptyMobileState message="Knowledge 항목이 없습니다." />
        )}
      </div>
      {isFormOpen ? (
        <KnowledgeTermModal
          onChange={setFormValues}
          onClose={closeForm}
          onSubmit={submitForm}
          values={formValues}
        />
      ) : null}
    </div>
  );
}

function KnowledgeListPreview({
  className,
  emptyLabel,
  items,
}: {
  className?: string;
  emptyLabel: string;
  items: string[];
}) {
  const visibleItems = items.slice(0, 3);

  return (
    <p className={cn("line-clamp-2 text-xs leading-5 text-zinc-500", className)}>
      {visibleItems.length ? visibleItems.join(", ") : emptyLabel}
      {items.length > visibleItems.length ? " 외 " + (items.length - visibleItems.length) : ""}
    </p>
  );
}

function AdminModal({
  children,
  onClose,
  onSubmit,
  submitLabel = "저장",
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/45 p-0 sm:items-center sm:p-4">
      <section className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-lg bg-white shadow-2xl shadow-zinc-950/30 sm:mx-auto sm:max-w-3xl sm:rounded-lg">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-base font-black text-zinc-950">{title}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3">
          <button type="button" className={actionButtonClassName} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-black text-white transition hover:bg-zinc-800"
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function FormField({
  children,
  label,
  required = false,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black text-zinc-600">
        {label}
        {required ? <span className="text-blue-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold text-zinc-700">
      <input
        checked={checked}
        className="h-4 w-4 rounded border-zinc-300"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function KnowledgeTermModal({
  onChange,
  onClose,
  onSubmit,
  values,
}: {
  onChange: (values: AdminKnowledgeTermFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
  values: AdminKnowledgeTermFormValues;
}) {
  const [isSlugEdited, setIsSlugEdited] = useState(Boolean(values.slug));
  const updateValues = (patch: Partial<AdminKnowledgeTermFormValues>) =>
    onChange({ ...values, ...patch });
  const updateRepresentativeName = (representativeName: string) => {
    updateValues({
      representativeName,
      slug: isSlugEdited ? values.slug : createKnowledgeSlug(representativeName),
    });
  };

  return (
    <AdminModal onClose={onClose} onSubmit={onSubmit} title="용어/증상 DB">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="대표 키워드" required>
            <input
              className={adminInputClassName}
              value={values.representativeName}
              onChange={(event) => updateRepresentativeName(event.target.value)}
            />
          </FormField>
          <FormField label="slug" required>
            <input
              className={adminInputClassName}
              value={values.slug}
              onChange={(event) => {
                setIsSlugEdited(true);
                updateValues({ slug: normalizeKnowledgeSlug(event.target.value) });
              }}
            />
          </FormField>
          <FormField label="분류" required>
            <select
              className={adminInputClassName}
              value={values.category}
              onChange={(event) =>
                updateValues({
                  category: normalizeKnowledgeCategory(event.target.value),
                })
              }
            >
              {knowledgeCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="우선순위">
            <input
              className={adminInputClassName}
              min={0}
              type="number"
              value={values.priority}
              onChange={(event) =>
                updateValues({ priority: Number(event.target.value) || 0 })
              }
            />
          </FormField>
        </div>
        <FormField label="설명">
          <textarea
            className={cn(adminInputClassName, "min-h-28")}
            value={values.description}
            onChange={(event) => updateValues({ description: event.target.value })}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="주요 원인">
            <textarea
              className={cn(adminInputClassName, "min-h-24")}
              value={values.mainCauses}
              onChange={(event) => updateValues({ mainCauses: event.target.value })}
            />
          </FormField>
          <FormField label="주요 증상">
            <textarea
              className={cn(adminInputClassName, "min-h-24")}
              value={values.mainSymptoms}
              onChange={(event) => updateValues({ mainSymptoms: event.target.value })}
            />
          </FormField>
          <FormField label="정비 팁 / 수리 방향">
            <textarea
              className={cn(adminInputClassName, "min-h-24")}
              value={values.maintenanceTips}
              onChange={(event) =>
                updateValues({ maintenanceTips: event.target.value })
              }
            />
          </FormField>
          <FormField label="예상 수리비">
            <input
              className={adminInputClassName}
              value={values.expectedRepairCost}
              onChange={(event) =>
                updateValues({ expectedRepairCost: event.target.value })
              }
            />
          </FormField>
          <FormField label="관련 키워드">
            <textarea
              className={cn(adminInputClassName, "min-h-20")}
              value={values.relatedKeywords}
              onChange={(event) =>
                updateValues({ relatedKeywords: event.target.value })
              }
            />
          </FormField>
          <FormField label="관련 차종">
            <textarea
              className={cn(adminInputClassName, "min-h-20")}
              value={values.relatedModels}
              onChange={(event) =>
                updateValues({ relatedModels: event.target.value })
              }
            />
          </FormField>
        </div>
        <CheckboxField
          checked={values.isVisible}
          label="노출 여부"
          onChange={(checked) => updateValues({ isVisible: checked })}
        />
      </div>
    </AdminModal>
  );
}

function AiKeywordRuleModal({
  onChange,
  onClose,
  onSubmit,
  values,
}: {
  onChange: (values: AdminAiKeywordRuleFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
  values: AdminAiKeywordRuleFormValues;
}) {
  const updateValues = (patch: Partial<AdminAiKeywordRuleFormValues>) =>
    onChange({ ...values, ...patch });

  return (
    <AdminModal onClose={onClose} onSubmit={onSubmit} title="AI 키워드 룰">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="대표 키워드" required>
            <input
              className={adminInputClassName}
              value={values.label}
              onChange={(event) => updateValues({ label: event.target.value })}
            />
          </FormField>
          <FormField label="카테고리">
            <input
              className={adminInputClassName}
              value={values.category}
              onChange={(event) => updateValues({ category: event.target.value })}
            />
          </FormField>
          <FormField label="적용 유종">
            <select
              className={adminInputClassName}
              value={values.fuelType}
              onChange={(event) => updateValues({ fuelType: event.target.value })}
            >
              <option value="">전체</option>
              <option value="가솔린">가솔린</option>
              <option value="디젤">디젤</option>
              <option value="LPG">LPG</option>
              <option value="하이브리드">하이브리드</option>
              <option value="전기">전기</option>
            </select>
          </FormField>
          <FormField label="적용 차종/세대">
            <input
              className={adminInputClassName}
              value={values.targetModel}
              onChange={(event) =>
                updateValues({ targetModel: event.target.value })
              }
            />
          </FormField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="포함 키워드">
            <textarea
              className={cn(adminInputClassName, "min-h-28")}
              value={values.includeKeywords}
              onChange={(event) =>
                updateValues({ includeKeywords: event.target.value })
              }
            />
          </FormField>
          <FormField label="제외 키워드">
            <textarea
              className={cn(adminInputClassName, "min-h-28")}
              value={values.excludeKeywords}
              onChange={(event) =>
                updateValues({ excludeKeywords: event.target.value })
              }
            />
          </FormField>
        </div>
        <FormField label="메모">
          <textarea
            className={cn(adminInputClassName, "min-h-24")}
            value={values.memo}
            onChange={(event) => updateValues({ memo: event.target.value })}
          />
        </FormField>
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField
            checked={values.isDefaultMaintenance}
            label="기본 정비항목 룰"
            onChange={(checked) =>
              updateValues({ isDefaultMaintenance: checked })
            }
          />
          <CheckboxField
            checked={values.isVisible}
            label="노출 여부"
            onChange={(checked) => updateValues({ isVisible: checked })}
          />
        </div>
      </div>
    </AdminModal>
  );
}

function AiMaintenanceRuleModal({
  onChange,
  onClose,
  onSubmit,
  values,
}: {
  onChange: (values: AdminAiMaintenanceRuleFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
  values: AdminAiMaintenanceRuleFormValues;
}) {
  const updateValues = (patch: Partial<AdminAiMaintenanceRuleFormValues>) =>
    onChange({ ...values, ...patch });

  return (
    <AdminModal onClose={onClose} onSubmit={onSubmit} title="정비항목 룰">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="룰명" required>
            <input
              className={adminInputClassName}
              value={values.title}
              onChange={(event) => updateValues({ title: event.target.value })}
            />
          </FormField>
          <FormField label="유종">
            <select
              className={adminInputClassName}
              value={values.fuelType}
              onChange={(event) => updateValues({ fuelType: event.target.value })}
            >
              <option value="">전체</option>
              <option value="가솔린">가솔린</option>
              <option value="디젤">디젤</option>
              <option value="LPG">LPG</option>
              <option value="하이브리드">하이브리드</option>
              <option value="전기">전기</option>
            </select>
          </FormField>
        </div>
        <FormField label="조건">
          <textarea
            className={cn(adminInputClassName, "min-h-24")}
            value={values.condition}
            onChange={(event) => updateValues({ condition: event.target.value })}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="연식 조건">
            <input
              className={adminInputClassName}
              value={values.yearCondition}
              onChange={(event) =>
                updateValues({ yearCondition: event.target.value })
              }
            />
          </FormField>
          <FormField label="주행거리 조건">
            <input
              className={adminInputClassName}
              value={values.mileageCondition}
              onChange={(event) =>
                updateValues({ mileageCondition: event.target.value })
              }
            />
          </FormField>
        </div>
        <FormField label="표시 항목">
          <textarea
            className={cn(adminInputClassName, "min-h-24")}
            value={values.items}
            onChange={(event) => updateValues({ items: event.target.value })}
          />
        </FormField>
        <FormField label="메모">
          <textarea
            className={cn(adminInputClassName, "min-h-24")}
            value={values.memo}
            onChange={(event) => updateValues({ memo: event.target.value })}
          />
        </FormField>
        <CheckboxField
          checked={values.isVisible}
          label="노출 여부"
          onChange={(checked) => updateValues({ isVisible: checked })}
        />
      </div>
    </AdminModal>
  );
}

function NewKeywordCandidateModal({
  candidate,
  onChange,
  onClose,
  onSubmit,
  values,
}: {
  candidate: AdminDashboardAiCandidate;
  onChange: (values: AdminNewKeywordCandidateFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
  values: AdminNewKeywordCandidateFormValues;
}) {
  const updateValues = (patch: Partial<AdminNewKeywordCandidateFormValues>) =>
    onChange({ ...values, ...patch });

  return (
    <AdminModal
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={values.excludeCandidate ? "제외 처리" : "등록"}
      title="신규 키워드 자동감지"
    >
      <div className="grid gap-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="text-xs font-black text-blue-700">후보 키워드</p>
          <p className="mt-1 text-lg font-black text-zinc-950">
            {candidate.keyword}
          </p>
        </div>
        <FormField label="대표 키워드" required>
          <input
            className={adminInputClassName}
            disabled={values.excludeCandidate || !values.registerAsRepresentative}
            value={values.label}
            onChange={(event) => updateValues({ label: event.target.value })}
          />
        </FormField>
        <FormField label="포함 키워드">
          <textarea
            className={cn(adminInputClassName, "min-h-24")}
            disabled={values.excludeCandidate || !values.registerAsIncludeKeyword}
            value={values.includeKeywords}
            onChange={(event) =>
              updateValues({ includeKeywords: event.target.value })
            }
          />
        </FormField>
        <FormField label="메모">
          <textarea
            className={cn(adminInputClassName, "min-h-24")}
            value={values.memo}
            onChange={(event) => updateValues({ memo: event.target.value })}
          />
        </FormField>
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField
            checked={values.registerAsRepresentative}
            label="대표 키워드로 등록"
            onChange={(checked) =>
              updateValues({ registerAsRepresentative: checked })
            }
          />
          <CheckboxField
            checked={values.registerAsIncludeKeyword}
            label="포함 키워드로 등록"
            onChange={(checked) =>
              updateValues({ registerAsIncludeKeyword: checked })
            }
          />
          <CheckboxField
            checked={values.excludeCandidate}
            label="제외 여부"
            onChange={(checked) => updateValues({ excludeCandidate: checked })}
          />
          <CheckboxField
            checked={values.isVisible}
            label="노출 여부"
            onChange={(checked) => updateValues({ isVisible: checked })}
          />
        </div>
      </div>
    </AdminModal>
  );
}

function AiKeywordRuleManager({
  onChangeRules,
  rules,
}: {
  onChangeRules: (rules: AdminAiKeywordRule[]) => void;
  rules: AdminAiKeywordRule[];
}) {
  const [search, setSearch] = useState("");
  const [editingRule, setEditingRule] = useState<AdminAiKeywordRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<AdminAiKeywordRuleFormValues>(
    createKeywordRuleFormValues(),
  );
  const visibleRules = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return rules;

    return rules.filter((rule) =>
      [
        rule.label,
        rule.category,
        rule.fuelType,
        rule.targetModel,
        rule.memo,
        rule.includeKeywords.join(" "),
        rule.excludeKeywords.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [rules, search]);
  const openForm = (rule?: AdminAiKeywordRule) => {
    setEditingRule(rule ?? null);
    setFormValues(createKeywordRuleFormValues(rule));
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRule(null);
  };
  const submitForm = () => {
    if (!formValues.label.trim()) return;
    const nextRule: AdminAiKeywordRule = {
      id: editingRule?.id ?? "custom-keyword-" + Date.now(),
      label: formValues.label.trim(),
      includeKeywords: splitAdminListInput(formValues.includeKeywords),
      excludeKeywords: splitAdminListInput(formValues.excludeKeywords),
      category: formValues.category.trim(),
      fuelType: formValues.fuelType.trim(),
      targetModel: formValues.targetModel.trim(),
      isDefaultMaintenance: formValues.isDefaultMaintenance,
      isVisible: formValues.isVisible,
      memo: formValues.memo.trim(),
    };

    onChangeRules(
      editingRule
        ? rules.map((item) => (item.id === editingRule.id ? nextRule : item))
        : [nextRule, ...rules],
    );
    closeForm();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          className={cn(adminInputClassName, "sm:w-80")}
          placeholder="대표 키워드, 포함 키워드, 카테고리 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          className={actionButtonClassName}
          onClick={() => openForm()}
        >
          키워드 추가
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {visibleRules.map((rule) => (
          <article key={rule.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-700">#{rule.label}</p>
                <h4 className="mt-1 text-base font-black text-zinc-950">
                  {rule.category || "카테고리 없음"}
                </h4>
              </div>
              <HiddenStatus isHidden={!rule.isVisible} />
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-zinc-600">
              <DetailLine label="포함" value={rule.includeKeywords.join(", ") || "없음"} />
              <DetailLine label="제외" value={rule.excludeKeywords.join(", ") || "없음"} />
              <DetailLine label="적용 유종" value={rule.fuelType || "전체"} />
              <DetailLine label="차종/세대" value={rule.targetModel || "전체"} />
              <DetailLine label="메모" value={rule.memo || "없음"} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={actionButtonClassName}
                onClick={() => openForm(rule)}
              >
                수정
              </button>
              <button
                type="button"
                className={actionButtonClassName}
                onClick={() =>
                  onChangeRules(
                    rules.map((item) =>
                      item.id === rule.id
                        ? { ...item, isVisible: !item.isVisible }
                        : item,
                    ),
                  )
                }
              >
                {rule.isVisible ? "숨김" : "노출"}
              </button>
              <button
                type="button"
                className={dangerButtonClassName}
                onClick={() => {
                  if (window.confirm("키워드 룰을 삭제하시겠습니까?")) {
                    onChangeRules(rules.filter((item) => item.id !== rule.id));
                  }
                }}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
      {isFormOpen ? (
        <AiKeywordRuleModal
          onChange={setFormValues}
          onClose={closeForm}
          onSubmit={submitForm}
          values={formValues}
        />
      ) : null}
    </div>
  );
}

function AiMaintenanceRuleManager({
  onChangeRules,
  rules,
}: {
  onChangeRules: (rules: AdminAiMaintenanceRule[]) => void;
  rules: AdminAiMaintenanceRule[];
}) {
  const [editingRule, setEditingRule] = useState<AdminAiMaintenanceRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] =
    useState<AdminAiMaintenanceRuleFormValues>(
      createMaintenanceRuleFormValues(),
    );
  const openForm = (rule?: AdminAiMaintenanceRule) => {
    setEditingRule(rule ?? null);
    setFormValues(createMaintenanceRuleFormValues(rule));
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRule(null);
  };
  const submitForm = () => {
    if (!formValues.title.trim()) return;
    const conditionParts = [
      formValues.condition.trim(),
      formValues.yearCondition.trim()
        ? "연식: " + formValues.yearCondition.trim()
        : "",
      formValues.mileageCondition.trim()
        ? "주행거리: " + formValues.mileageCondition.trim()
        : "",
    ].filter(Boolean);

    const nextRule: AdminAiMaintenanceRule = {
      id: editingRule?.id ?? "custom-maintenance-" + Date.now(),
      title: formValues.title.trim(),
      condition: conditionParts.join(" / "),
      fuelType: formValues.fuelType.trim(),
      items: splitAdminListInput(formValues.items),
      isVisible: formValues.isVisible,
      memo: formValues.memo.trim(),
    };

    onChangeRules(
      editingRule
        ? rules.map((item) => (item.id === editingRule.id ? nextRule : item))
        : [nextRule, ...rules],
    );
    closeForm();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-zinc-500">
          기본 참고 정비항목 노출 조건을 관리합니다. 요소수/SCR은 DB 확인 차량만 노출합니다.
        </p>
        <button
          type="button"
          className={actionButtonClassName}
          onClick={() => openForm()}
        >
          룰 추가
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {rules.map((rule) => (
          <article key={rule.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-base font-black text-zinc-950">{rule.title}</h4>
              <HiddenStatus isHidden={!rule.isVisible} />
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-zinc-600">
              <DetailLine label="조건" value={rule.condition || "없음"} />
              <DetailLine label="유종" value={rule.fuelType || "전체"} />
              <DetailLine label="항목" value={rule.items.map((item) => "#" + item).join(" ") || "없음"} />
              <DetailLine label="메모" value={rule.memo || "없음"} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={actionButtonClassName}
                onClick={() => openForm(rule)}
              >
                수정
              </button>
              <button
                type="button"
                className={actionButtonClassName}
                onClick={() =>
                  onChangeRules(
                    rules.map((item) =>
                      item.id === rule.id
                        ? { ...item, isVisible: !item.isVisible }
                        : item,
                    ),
                  )
                }
              >
                {rule.isVisible ? "숨김" : "노출"}
              </button>
              <button
                type="button"
                className={dangerButtonClassName}
                onClick={() => {
                  if (window.confirm("정비항목 룰을 삭제하시겠습니까?")) {
                    onChangeRules(rules.filter((item) => item.id !== rule.id));
                  }
                }}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
      {isFormOpen ? (
        <AiMaintenanceRuleModal
          onChange={setFormValues}
          onClose={closeForm}
          onSubmit={submitForm}
          values={formValues}
        />
      ) : null}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-black text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words font-bold text-zinc-700">{value}</dd>
    </div>
  );
}

function NewKeywordCandidateDetector({
  candidates,
  onChangeStatus,
  onRegisterCandidate,
  reviews,
}: {
  candidates: AdminDashboardAiCandidate[];
  onChangeStatus: (
    candidate: AdminDashboardAiCandidate,
    nextStatus: AiCandidateStatus,
  ) => void;
  onRegisterCandidate: (
    candidate: AdminDashboardAiCandidate,
    values: AdminNewKeywordCandidateFormValues,
  ) => void;
  reviews: AdminReview[];
}) {
  const [activeStatus, setActiveStatus] =
    useState<Exclude<AiCandidateStatus, "applied">>("pending");
  const [editingCandidate, setEditingCandidate] =
    useState<AdminDashboardAiCandidate | null>(null);
  const [candidateFormValues, setCandidateFormValues] =
    useState<AdminNewKeywordCandidateFormValues>({
      excludeCandidate: false,
      includeKeywords: "",
      isVisible: true,
      label: "",
      memo: "",
      registerAsIncludeKeyword: true,
      registerAsRepresentative: true,
    });
  const openCandidateForm = (candidate: AdminDashboardAiCandidate) => {
    setEditingCandidate(candidate);
    setCandidateFormValues({
      excludeCandidate: false,
      includeKeywords: candidate.keyword,
      isVisible: true,
      label: candidate.keyword,
      memo: "신규 키워드 자동감지에서 등록",
      registerAsIncludeKeyword: true,
      registerAsRepresentative: true,
    });
  };
  const closeCandidateForm = () => {
    setEditingCandidate(null);
  };
  const submitCandidateForm = () => {
    if (!editingCandidate) return;
    onRegisterCandidate(editingCandidate, candidateFormValues);
    closeCandidateForm();
  };
  const statusCounts = useMemo(
    () =>
      newKeywordCandidateStatuses.reduce(
        (counts, status) => ({
          ...counts,
          [status.value]: candidates.filter(
            (candidate) => candidate.status === status.value,
          ).length,
        }),
        {} as Record<Exclude<AiCandidateStatus, "applied">, number>,
      ),
    [candidates],
  );
  const visibleCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        if (candidate.status === "applied") {
          return false;
        }

        return candidate.status === activeStatus;
      }),
    [activeStatus, candidates],
  );
  const emptyMessage =
    activeStatus === "pending"
      ? "신규 자동감지 후보가 없습니다."
      : activeStatus === "reviewing"
        ? "보류 중인 신규 키워드 후보가 없습니다."
        : "제외된 신규 키워드 후보가 없습니다.";

  return (
    <div className="divide-y divide-zinc-200 bg-white">
      <div className="bg-zinc-50 px-4 py-3">
        <h3 className="text-sm font-black text-zinc-950">
          신규 키워드 자동감지
        </h3>
        <p className="mt-1 text-xs font-medium text-zinc-500">
          후기 본문에서 반복 등장하지만 현재 키워드 사전에 없는 단어만 표시합니다.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto bg-zinc-50 px-4 py-3">
        {newKeywordCandidateStatuses.map((status) => (
          <button
            key={status.value}
            type="button"
            className={cn(
              "shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
              activeStatus === status.value &&
                "border-blue-600 bg-blue-600 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white",
            )}
            onClick={() => setActiveStatus(status.value)}
          >
            {status.label} {statusCounts[status.value].toLocaleString()}
          </button>
        ))}
      </div>
      {visibleCandidates.length ? (
        visibleCandidates.map((candidate) => {
          const evidence = getAiCandidateEvidence(candidate, reviews);
          const reasonItems = getAiCandidateReasonItems(candidate, reviews);

          return (
            <article
              key={candidate.candidateKey}
              className="grid gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_240px]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                    후기 본문 기반
                  </span>
                  <NewKeywordStatusBadge status={candidate.status} />
                </div>
                <p className="mt-3 text-xs font-black text-zinc-500">
                  후보 키워드
                </p>
                <h4 className="mt-1 break-words text-xl font-black leading-snug text-zinc-950">
                  {candidate.keyword}
                </h4>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <AiEvidenceMetric
                    label="등장 후기 수"
                    value={formatAiEvidenceValue(evidence.reviewCount, "건")}
                  />
                  <AiEvidenceMetric
                    label="최근 30일"
                    value={formatAiEvidenceValue(
                      candidate.recentMentionCount ?? null,
                      "회",
                    )}
                  />
                  <AiEvidenceMetric
                    label="최근 증가율"
                    value={formatAiEvidenceValue(
                      evidence.recentGrowthRate,
                      "%",
                    )}
                  />
                </dl>
                <dl className="mt-4 grid gap-2 text-xs text-zinc-600">
                  <DetailLine
                    label="관련 차종"
                    value={formatModelList(candidate.relatedModels)}
                  />
                  <DetailLine
                    label="추천 카테고리"
                    value={
                      candidate.recommendedCategory ?? "후기 반복 신규 키워드"
                    }
                  />
                </dl>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  예시 문장
                </p>
                {candidate.exampleSentences?.length ? (
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
                    {candidate.exampleSentences.map((sentence) => (
                      <li
                        key={sentence}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        “{sentence}”
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn(mutedTextClassName, "mt-2")}>
                    예시 문장 수집 대기
                  </p>
                )}

                <p className="mt-4 text-xs font-black uppercase tracking-wide text-zinc-500">
                  추천 이유
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-600">
                  {reasonItems.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  관리자 액션
                </p>
                {activeStatus !== "excluded" ? (
                  <button
                    type="button"
                    className={cn(actionButtonClassName, "w-full lg:w-auto")}
                    onClick={() => openCandidateForm(candidate)}
                  >
                    키워드로 등록
                  </button>
                ) : null}
                {activeStatus !== "excluded" ? (
                  <button
                    type="button"
                    className={cn(dangerButtonClassName, "w-full lg:w-auto")}
                    onClick={() => onChangeStatus(candidate, "excluded")}
                  >
                    제외
                  </button>
                ) : null}
                {activeStatus !== "reviewing" ? (
                  <button
                    type="button"
                    className={cn(actionButtonClassName, "w-full lg:w-auto")}
                    onClick={() => onChangeStatus(candidate, "reviewing")}
                  >
                    보류
                  </button>
                ) : null}
                <p className="max-w-60 text-xs leading-5 text-zinc-500 lg:text-right">
                  등록 완료 또는 제외 처리된 키워드는 신규 후보에 다시 노출되지 않습니다.
                </p>
              </div>
            </article>
          );
        })
      ) : (
        <DashboardEmptyState message={emptyMessage} />
      )}
      {editingCandidate ? (
        <NewKeywordCandidateModal
          candidate={editingCandidate}
          onChange={setCandidateFormValues}
          onClose={closeCandidateForm}
          onSubmit={submitCandidateForm}
          values={candidateFormValues}
        />
      ) : null}
    </div>
  );
}

function DashboardAiCandidateTable({
  candidates,
  onChangeStatus,
  reviews,
}: {
  candidates: AdminDashboardAiCandidate[];
  onChangeStatus: (
    candidate: AdminDashboardAiCandidate,
    nextStatus: AiCandidateStatus,
  ) => void;
  reviews: AdminReview[];
}) {
  const [activeStatus, setActiveStatus] =
    useState<Exclude<AiCandidateStatus, "pending">>("reviewing");
  const [archiveFilter, setArchiveFilter] =
    useState<AiCandidateArchiveFilter>("recent3days");
  const statusCounts = useMemo(
    () =>
      aiCandidateStatuses.reduce(
        (counts, status) => ({
          ...counts,
          [status.value]: candidates.filter(
            (candidate) => candidate.status === status.value,
          ).length,
        }),
        {} as Record<Exclude<AiCandidateStatus, "pending">, number>,
      ),
    [candidates],
  );
  const visibleCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        if (candidate.status !== activeStatus) {
          return false;
        }

        if (activeStatus !== "applied" || archiveFilter === "all") {
          return true;
        }

        const updatedAt = candidate.updatedAt
          ? Date.parse(candidate.updatedAt)
          : Number.NaN;

        if (Number.isNaN(updatedAt)) {
          return false;
        }

        const ageMs = aiCandidateArchiveReferenceTime - updatedAt;
        const oneDayMs = 24 * 60 * 60 * 1000;

        return archiveFilter === "today"
          ? ageMs >= 0 && ageMs < oneDayMs
          : ageMs >= 0 && ageMs < 3 * oneDayMs;
      }),
    [activeStatus, archiveFilter, candidates],
  );
  const emptyMessage =
    activeStatus === "reviewing"
      ? "검토중인 AI DB 업데이트 추천이 없습니다."
      : activeStatus === "applied"
        ? "선택한 기간에 반영완료 내역이 없습니다."
        : "제외된 AI DB 업데이트 추천이 없습니다.";

  return (
    <div className="divide-y divide-zinc-200 bg-white">
      <div className="bg-zinc-50 px-4 py-3">
        <h3 className="text-sm font-black text-zinc-950">AI DB 업데이트 추천</h3>
        <p className="mt-1 text-xs font-medium text-zinc-500">
          후기 데이터와 조회 신호에서 반복 패턴을 찾고, 관리자는 반영 여부만 결정합니다.
        </p>
      </div>
      <div className="space-y-3 bg-zinc-50 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {aiCandidateStatuses.map((status) => (
            <button
              key={status.value}
              type="button"
              className={cn(
                "shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                activeStatus === status.value &&
                  "border-blue-600 bg-blue-600 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white",
              )}
              onClick={() => setActiveStatus(status.value)}
            >
              {status.label} {statusCounts[status.value].toLocaleString()}
            </button>
          ))}
        </div>
        {activeStatus === "applied" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-zinc-500">보관 기간</span>
            {aiCandidateArchiveFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={cn(
                  "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                  archiveFilter === filter.value &&
                    "border-blue-600 bg-blue-50 text-blue-700",
                )}
                onClick={() => setArchiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {visibleCandidates.length ? (
        visibleCandidates.map((candidate) => {
        const evidence = getAiCandidateEvidence(candidate, reviews);
        const reasonItems = getAiCandidateReasonItems(candidate, reviews);
        const suggestedUpdates = getAiCandidateSuggestedUpdates(candidate);
        const updateTargets = getAiCandidateUpdateTargets(candidate);

        return (
          <article
            key={candidate.candidateKey}
            className="grid gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)_260px]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                  {getAiSourceLabel(candidate.source)}
                </span>
                <AiStatusBadge status={candidate.status} />
              </div>
              <h4 className="mt-3 break-words text-lg font-black leading-snug text-zinc-950">
                {getAiCandidateTarget(candidate)}
              </h4>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                추천 키워드: {candidate.keyword || "정보 없음"} · 관련 모델:{" "}
                {formatModelList(candidate.relatedModels)}
              </p>
              {activeStatus !== "reviewing" ? (
                <dl className="mt-4 grid gap-2 text-xs text-zinc-400">
                  <div>
                    <dt className="font-black text-zinc-500">반영 위치</dt>
                    <dd className="mt-1 font-bold text-zinc-700">
                      {updateTargets.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-zinc-500">
                      {activeStatus === "applied" ? "반영일시" : "제외일시"}
                    </dt>
                    <dd className="mt-1 font-bold text-zinc-700">
                      {formatOptionalDate(candidate.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-zinc-500">처리 관리자</dt>
                    <dd className="mt-1 font-bold text-zinc-700">
                      {candidate.updatedByNickname ??
                        (candidate.updatedBy
                          ? formatCompactId(candidate.updatedBy, 8)
                          : "시스템/관리자")}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <div className="mt-4">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  추천 내용
                </p>
                <ul className="mt-2 space-y-1.5 text-sm font-medium leading-6 text-zinc-700">
                  {suggestedUpdates.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                추천 사유
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-600">
                {reasonItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <AiEvidenceMetric
                  label="후기 수"
                  value={formatAiEvidenceValue(evidence.reviewCount, "건")}
                />
                <AiEvidenceMetric
                  label="키워드 언급"
                  value={formatAiEvidenceValue(
                    evidence.keywordMentionCount,
                    "회",
                  )}
                />
                <AiEvidenceMetric
                  label="조회수"
                  value={formatAiEvidenceValue(evidence.viewCount, "회")}
                />
                <AiEvidenceMetric
                  label="최근 증가율"
                  value={formatAiEvidenceValue(evidence.recentGrowthRate, "%")}
                />
              </div>
            </div>

            {activeStatus === "reviewing" ? (
              <div className="flex flex-col gap-2 lg:items-end">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  상태 변경
                </p>
                <div className="flex flex-wrap gap-1.5 lg:justify-end">
                  {aiCandidateActionStatuses
                    .filter((status) => status.value !== "reviewing")
                    .map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        className={cn(
                          actionButtonClassName,
                          "min-h-9 px-2.5 text-[11px]",
                        )}
                        onClick={() => onChangeStatus(candidate, status.value)}
                      >
                        {status.label}
                      </button>
                    ))}
                </div>
                <p className="max-w-64 text-xs leading-5 text-zinc-500 lg:text-right">
                  반영완료 또는 제외 처리 시 검토중 목록에서 제거되고 해당 탭으로 이동합니다.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 lg:items-end">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  보관 상태
                </p>
                <AiStatusBadge status={candidate.status} />
                <p className="max-w-64 text-xs leading-5 text-zinc-500 lg:text-right">
                  {activeStatus === "applied"
                    ? "최근 3일 내역이 기본 표시되며, 전체 보기에서 과거 이력을 확인합니다."
                    : "제외된 추천 항목을 다시 확인하는 공간입니다."}
                </p>
              </div>
            )}
          </article>
        );
        })
      ) : (
        <DashboardEmptyState message={emptyMessage} />
      )}
    </div>
  );
}

function AiEvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-[11px] font-bold text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-zinc-950">{value}</p>
    </div>
  );
}

function DashboardRecentList({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: { id: string; meta: string; title: string }[];
  title: string;
}) {
  return (
    <section className="border-zinc-200 p-4 md:border-r md:last:border-r-0">
      <h3 className="text-sm font-black text-zinc-950">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="line-clamp-1 text-sm font-bold text-zinc-900">
                {item.title}
              </p>
              <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                {item.meta}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(mutedTextClassName, "mt-3")}>{emptyMessage}</p>
      )}
    </section>
  );
}

function DashboardHeadCell({
  align = "left",
  children,
}: {
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-500",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function DashboardCell({
  align = "left",
  children,
  strong = false,
}: {
  align?: "left" | "right";
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "max-w-[24rem] px-3 py-3 align-middle text-zinc-600",
        align === "right" && "text-right",
        strong && "font-black text-zinc-950",
      )}
    >
      <span className="line-clamp-2 break-words">{children}</span>
    </td>
  );
}

function DashboardEmptyState({ message }: { message: string }) {
  return <p className={cn(mutedTextClassName, "bg-white p-4")}>{message}</p>;
}

function NewKeywordStatusBadge({ status }: { status: AiCandidateStatus }) {
  const label =
    status === "pending"
      ? "신규 후보"
      : status === "reviewing"
        ? "보류"
        : status === "applied"
          ? "키워드 등록 완료"
          : "제외";

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center justify-center rounded-full border px-2.5 text-xs font-black",
        status === "pending"
          ? "border-blue-500/40 bg-blue-500/10 text-blue-700"
          : status === "reviewing"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
            : status === "applied"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
              : "border-zinc-600 bg-zinc-100 text-zinc-500",
      )}
    >
      {label}
    </span>
  );
}

function AiStatusBadge({ status }: { status: AiCandidateStatus }) {
  const effectiveStatus = status;
  const label =
    effectiveStatus === "pending"
      ? "검토중"
      : aiCandidateStatuses.find((item) => item.value === effectiveStatus)
          ?.label;

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center justify-center rounded-full border px-2.5 text-xs font-black",
        effectiveStatus === "applied"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : effectiveStatus === "reviewing" || effectiveStatus === "pending"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
            : effectiveStatus === "excluded"
              ? "border-zinc-600 bg-zinc-100 text-zinc-400"
              : "border-red-500/40 bg-red-500/10 text-red-700",
      )}
    >
      {label ?? "검토중"}
    </span>
  );
}

function formatReferrerLabel(value: string) {
  if (!value || value === "direct") {
    return "직접 유입";
  }

  return value;
}

function formatDeviceRatio(row: AdminDashboardTrafficRow) {
  const total = row.pcVisitors + row.mobileVisitors;

  if (total <= 0) {
    return "기록 없음";
  }

  const pcRatio = Math.round((row.pcVisitors / total) * 100);
  const mobileRatio = Math.round((row.mobileVisitors / total) * 100);

  return `PC ${pcRatio}% · 모바일 ${mobileRatio}%`;
}

function formatModelList(models: string[]) {
  const visibleModels = models.filter(Boolean).slice(0, 3);

  if (!visibleModels.length) {
    return "관련 모델 없음";
  }

  return visibleModels.join(", ") + (models.length > 3 ? " 외" : "");
}

function getAiCandidateTarget(candidate: AdminDashboardAiCandidate) {
  return candidate.relatedModels[0] || candidate.keyword || "추천 대상 없음";
}

function getAiSourceLabel(source: AiCandidateSource) {
  if (source === "traffic") return "조회수 기반";
  if (source === "review") return "후기 기반";
  if (source === "keyword") return "키워드 기반";

  return "복합 신호";
}

function getReviewVehicleText(review: AdminReview) {
  return [
    getJsonString(review.vehicle_snapshot, "brand"),
    getJsonString(review.vehicle_snapshot, "model"),
    getJsonString(review.vehicle_snapshot, "generation"),
    getJsonString(review.vehicle_snapshot, "modelDetail"),
    getJsonString(review.vehicle_snapshot, "year"),
    review.content,
    ...(Array.isArray(review.tags) ? review.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getAiCandidateReviewMetrics(
  candidate: AdminDashboardAiCandidate,
  reviews: AdminReview[],
) {
  const now = Date.now();
  const recentStart = now - 30 * 24 * 60 * 60 * 1000;
  const previousStart = now - 60 * 24 * 60 * 60 * 1000;
  const keyword = candidate.keyword.trim().toLowerCase();
  const relatedModels = candidate.relatedModels
    .map((model) => model.trim().toLowerCase())
    .filter(Boolean);
  const matchesCandidate = (review: AdminReview) => {
    const reviewText = getReviewVehicleText(review);

    return (
      (keyword.length >= 2 && reviewText.includes(keyword)) ||
      relatedModels.some((model) => reviewText.includes(model))
    );
  };
  const matchedReviews = reviews.filter(matchesCandidate);
  const recentReviews = matchedReviews.filter((review) => {
    const createdAt = Date.parse(review.created_at);

    return !Number.isNaN(createdAt) && createdAt >= recentStart;
  });
  const previousReviews = matchedReviews.filter((review) => {
    const createdAt = Date.parse(review.created_at);

    return (
      !Number.isNaN(createdAt) &&
      createdAt >= previousStart &&
      createdAt < recentStart
    );
  });
  const keywordMentionCount = keyword
    ? recentReviews.reduce((count, review) => {
        const reviewText = getReviewVehicleText(review);
        const pattern = new RegExp(
          keyword.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&"),
          "g",
        );

        return count + (reviewText.match(pattern)?.length ?? 0);
      }, 0)
    : 0;
  const recentGrowthRate =
    previousReviews.length > 0
      ? Math.round(
          ((recentReviews.length - previousReviews.length) /
            previousReviews.length) *
            100,
        )
      : recentReviews.length > 0
        ? 100
        : null;

  return {
    keywordMentionCount,
    recentGrowthRate,
    reviewCount: recentReviews.length,
  };
}

function getAiCandidateEvidence(
  candidate: AdminDashboardAiCandidate,
  reviews: AdminReview[],
) {
  const reviewMetrics = getAiCandidateReviewMetrics(candidate, reviews);
  const keywordMentionCount =
    candidate.evidence.keywordMentionCount ??
    (reviewMetrics.keywordMentionCount > 0
      ? reviewMetrics.keywordMentionCount
      : candidate.source === "keyword"
        ? candidate.mentionCount
        : null);
  const reviewCount =
    candidate.evidence.reviewCount ??
    (reviewMetrics.reviewCount > 0 ? reviewMetrics.reviewCount : null);
  const viewCount =
    candidate.evidence.viewCount ??
    (candidate.source === "traffic" ? candidate.mentionCount : null);
  const recentGrowthRate =
    candidate.evidence.recentGrowthRate ?? reviewMetrics.recentGrowthRate;

  return {
    keywordMentionCount,
    recentGrowthRate,
    reviewCount,
    viewCount,
  };
}

function getAiCandidateSuggestedUpdates(candidate: AdminDashboardAiCandidate) {
  if (candidate.suggestedUpdates.length > 0) {
    return candidate.suggestedUpdates;
  }

  if (candidate.source === "traffic") {
    return [
      "출고 전 기본 점검항목 우선 보강",
      "AI 한줄평을 최근 조회 관심도 기준으로 갱신",
      "대표 키워드와 주의 포인트 추가 검토",
    ];
  }

  return [
    `기본 점검항목에 '${candidate.keyword}' 관련 확인 항목 추가 검토`,
    "AI 한줄평에 반복 언급 키워드 반영",
    `대표 키워드에 '${candidate.keyword}' 추가 검토`,
  ];
}

function getAiCandidateUpdateTargets(candidate: AdminDashboardAiCandidate) {
  const updates = getAiCandidateSuggestedUpdates(candidate).join(" ");
  const targets = [
    updates.includes("대표 키워드") ? "대표 키워드" : null,
    updates.includes("기본 점검항목") ? "기본 점검항목" : null,
    updates.includes("AI 한줄평") ? "AI 한줄평" : null,
    updates.includes("고질병") || updates.includes("정비")
      ? "고질병 DB"
      : null,
  ].filter(Boolean) as string[];

  return targets.length ? targets : ["차량 DB"];
}

function getAiCandidateReasonItems(
  candidate: AdminDashboardAiCandidate,
  reviews: AdminReview[],
) {
  const evidence = getAiCandidateEvidence(candidate, reviews);
  const isNewKeywordCandidate = candidate.candidateKey.startsWith("new-keyword:");
  const reasons = [
    candidate.reason ||
      (isNewKeywordCandidate
        ? "후기 본문 반복 신호가 기준치 이상이며 키워드 사전에 등록되지 않았습니다."
        : "후기/조회/검색 신호가 기준치 이상 반복되어 DB 업데이트 추천으로 분류됐습니다."),
  ];

  if (isNewKeywordCandidate) {
    if (evidence.reviewCount !== null) {
      reasons.push(
        "전체 후기 " +
          evidence.reviewCount.toLocaleString() +
          "건에서 " +
          candidate.keyword +
          " 등장",
      );
    }

    if (candidate.recentMentionCount !== undefined) {
      reasons.push(
        "최근 30일 언급 " +
          candidate.recentMentionCount.toLocaleString() +
          "회",
      );
    }
  } else if (evidence.reviewCount !== null && evidence.keywordMentionCount !== null) {
    reasons.push(
      `최근 30일 후기 ${evidence.reviewCount.toLocaleString()}건에서 '${candidate.keyword}' 언급 ${evidence.keywordMentionCount.toLocaleString()}회`,
    );
  } else if (evidence.keywordMentionCount !== null) {
    reasons.push(
      `누적 분석 신호에서 '${candidate.keyword}' 언급 ${evidence.keywordMentionCount.toLocaleString()}회 확인`,
    );
  }

  if (evidence.viewCount !== null) {
    reasons.push(
      `조회수 ${evidence.viewCount.toLocaleString()}회로 관리자 검토 우선순위에 포함`,
    );
  }

  if (evidence.recentGrowthRate !== null) {
    reasons.push(`최근 후기 증가율 ${evidence.recentGrowthRate.toLocaleString()}%`);
  }

  if (!isNewKeywordCandidate && (evidence.keywordMentionCount ?? 0) >= 10) {
    reasons.push("동일 키워드가 기준치 이상 반복되어 DB 업데이트 추천");
  }

  return Array.from(new Set(reasons));
}

function formatAiEvidenceValue(
  value: number | null,
  suffix: string,
  emptyLabel = "분석 대기",
) {
  return value === null ? emptyLabel : value.toLocaleString() + suffix;
}

function AdminTablePanel({
  children,
  count,
  title,
}: {
  children: React.ReactNode;
  count: number;
  title: string;
}) {
  return (
    <section className={panelClassName}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-zinc-950">{title}</h2>
        <p className="text-xs text-zinc-500">{count.toLocaleString()}건 표시</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 md:overflow-x-auto">
        {children}
      </div>
    </section>
  );
}

function BulkActionBar({
  canPermanentDelete = false,
  hasHiddenSelection,
  hasVisibleSelection,
  onHide,
  onPermanentDelete,
  onUnhide,
  selectedCount,
}: {
  canPermanentDelete?: boolean;
  hasHiddenSelection: boolean;
  hasVisibleSelection: boolean;
  onHide: () => void;
  onPermanentDelete?: () => void;
  onUnhide: () => void;
  selectedCount: number;
}) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3">
      <span className="mr-auto text-xs font-bold text-zinc-400">
        선택 {selectedCount.toLocaleString()}개
      </span>
      {hasVisibleSelection ? (
        <button
          type="button"
          className={actionButtonClassName}
          disabled={!hasSelection}
          onClick={onHide}
        >
          선택숨김
        </button>
      ) : null}
      {hasHiddenSelection ? (
        <button
          type="button"
          className={actionButtonClassName}
          disabled={!hasSelection}
          onClick={onUnhide}
        >
          숨김해제
        </button>
      ) : null}
      {canPermanentDelete && onPermanentDelete ? (
        <button
          type="button"
          className={dangerButtonClassName}
          disabled={!hasSelection}
          onClick={onPermanentDelete}
        >
          선택영구삭제
        </button>
      ) : null}
    </div>
  );
}

function MobileActionDetails({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ActionMenu({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative inline-flex justify-end">
      <summary
        className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg font-black text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 [&::-webkit-details-marker]:hidden"
        aria-label="더보기"
      >
        ⋯
      </summary>
      <div className="absolute right-0 top-9 z-30 flex w-40 flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10">
        {children}
      </div>
    </details>
  );
}

function PostActionButtons({
  isSuperAdmin,
  onDelete,
  onUpdateState,
  post,
}: {
  isSuperAdmin: boolean;
  onDelete: (post: AdminCommunityPost) => void;
  onUpdateState: (
    post: AdminCommunityPost,
    state: {
      next_is_hidden?: boolean;
      next_is_notice?: boolean;
      next_is_pinned?: boolean;
    },
  ) => void;
  post: AdminCommunityPost;
}) {
  return (
    <ActionMenu>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() =>
          onUpdateState(post, {
            next_is_hidden: !post.is_hidden,
          })
        }
      >
        {post.is_hidden ? "숨김해제" : "숨김"}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() =>
          onUpdateState(post, {
            next_is_notice: !post.is_notice,
          })
        }
      >
        {post.is_notice ? "공지해제" : "공지지정"}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() =>
          onUpdateState(post, {
            next_is_pinned: !post.is_pinned,
          })
        }
      >
        {post.is_pinned ? "고정해제" : "상단고정"}
      </button>
      {isSuperAdmin ? (
        <button
          type="button"
          className={dangerButtonClassName}
          onClick={() => onDelete(post)}
        >
          영구삭제
        </button>
      ) : null}
    </ActionMenu>
  );
}

function ReviewActionButtons({
  isSuperAdmin,
  onDelete,
  onToggleHidden,
  review,
}: {
  isSuperAdmin: boolean;
  onDelete: (review: AdminReview) => void;
  onToggleHidden: (review: AdminReview) => void;
  review: AdminReview;
}) {
  return (
    <ActionMenu>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onToggleHidden(review)}
      >
        {review.is_hidden ? "숨김해제" : "숨김"}
      </button>
      {isSuperAdmin ? (
        <button
          type="button"
          className={dangerButtonClassName}
          onClick={() => onDelete(review)}
        >
          영구삭제
        </button>
      ) : null}
    </ActionMenu>
  );
}

function UserActionButtons({
  account,
  isSuperAdmin,
  isVerifiedDealerFeatureReady,
  onGrantNicknameChangeTicket,
  onSetRole,
  onSetSuspended,
  onSetVerifiedDealer,
}: {
  account: AdminUserProfile;
  isSuperAdmin: boolean;
  isVerifiedDealerFeatureReady: boolean;
  onGrantNicknameChangeTicket: (account: AdminUserProfile) => void;
  onSetRole: (account: AdminUserProfile, nextRole: "user" | "admin") => void;
  onSetSuspended: (account: AdminUserProfile) => void;
  onSetVerifiedDealer: (account: AdminUserProfile) => void;
}) {
  return (
    <ActionMenu>
      <button
        type="button"
        className={actionButtonClassName}
        disabled={account.role === "super_admin"}
        onClick={() => onSetSuspended(account)}
      >
        {account.is_suspended ? "정지해제" : "정지"}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        disabled={!isVerifiedDealerFeatureReady}
        onClick={() => onSetVerifiedDealer(account)}
        title={
          isVerifiedDealerFeatureReady
            ? undefined
            : "인증딜러 기능 DB 미적용"
        }
      >
        {account.is_verified_dealer ? "딜러 회수" : "인증딜러"}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onGrantNicknameChangeTicket(account)}
      >
        닉네임 변경
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        disabled={!isSuperAdmin || account.role !== "user"}
        onClick={() => onSetRole(account, "admin")}
      >
        관리자 부여
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        disabled={!isSuperAdmin || account.role !== "admin"}
        onClick={() => onSetRole(account, "user")}
      >
        관리자 회수
      </button>
    </ActionMenu>
  );
}

function NoticeActionButtons({
  notice,
  onDelete,
  onEdit,
}: {
  notice: AdminCommunityPost;
  onDelete: (notice: AdminCommunityPost) => void;
  onEdit: (notice: AdminCommunityPost) => void;
}) {
  return (
    <ActionMenu>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onEdit(notice)}
      >
        수정
      </button>
      <button
        type="button"
        className={dangerButtonClassName}
        onClick={() => onDelete(notice)}
      >
        삭제
      </button>
    </ActionMenu>
  );
}

function PopupNoticeActionButtons({
  notice,
  onDelete,
  onEdit,
  onToggle,
}: {
  notice: AdminPopupNotice;
  onDelete: (notice: AdminPopupNotice) => void;
  onEdit: (notice: AdminPopupNotice) => void;
  onToggle: (notice: AdminPopupNotice) => void;
}) {
  return (
    <ActionMenu>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onToggle(notice)}
      >
        {notice.is_active ? "비활성" : "활성"}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onEdit(notice)}
      >
        수정
      </button>
      <button
        type="button"
        className={dangerButtonClassName}
        onClick={() => onDelete(notice)}
      >
        삭제
      </button>
    </ActionMenu>
  );
}

function KnowledgeActionButtons({
  onDelete,
  onEdit,
  onToggleVisible,
  term,
}: {
  onDelete: (term: AdminKnowledgeTerm) => void;
  onEdit: (term: AdminKnowledgeTerm) => void;
  onToggleVisible: (term: AdminKnowledgeTerm) => void;
  term: AdminKnowledgeTerm;
}) {
  return (
    <ActionMenu>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onToggleVisible(term)}
      >
        {term.is_visible ? "비노출" : "노출"}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onEdit(term)}
      >
        수정
      </button>
      <button
        type="button"
        className={dangerButtonClassName}
        onClick={() => onDelete(term)}
      >
        삭제
      </button>
    </ActionMenu>
  );
}

function SelectionCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      aria-label={label}
      checked={checked}
      className={checkboxClassName}
      disabled={disabled}
      type="checkbox"
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function EmptyTableRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td
        className="px-3 py-8 text-center text-sm text-zinc-500"
        colSpan={colSpan}
      >
        {message}
      </td>
    </tr>
  );
}

function EmptyMobileState({ message }: { message: string }) {
  return <p className="px-3 py-8 text-center text-sm text-zinc-500">{message}</p>;
}

function PostStatusBadges({ post }: { post: AdminCommunityPost }) {
  return (
    <div className="flex flex-nowrap gap-1.5 whitespace-nowrap">
      {post.is_notice ? (
        <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-xs font-bold text-white">
          공지
        </span>
      ) : null}
      {post.is_pinned ? (
        <span className="shrink-0 rounded-full bg-amber-500 px-2 py-1 text-xs font-bold text-black">
          상단고정
        </span>
      ) : null}
      <HiddenStatus isHidden={post.is_hidden} />
    </div>
  );
}

function HiddenStatus({ isHidden }: { isHidden: boolean }) {
  return isHidden ? (
    <span className="shrink-0 rounded-full bg-zinc-700 px-2 py-1 text-xs font-bold text-zinc-700">
      숨김
    </span>
  ) : (
    <span className="shrink-0 rounded-full border border-zinc-300 px-2 py-1 text-xs font-bold text-zinc-400">
      노출
    </span>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  const roleClassName =
    role === "super_admin"
      ? "border-zinc-300 bg-zinc-100 text-zinc-800"
      : role === "admin"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-zinc-300 text-zinc-600";

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1 text-xs font-bold",
        roleClassName,
      )}
    >
      {role}
    </span>
  );
}

function AccountStatusBadge({ isSuspended }: { isSuspended: boolean }) {
  return isSuspended ? (
    <span className="inline-flex whitespace-nowrap rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-700">
      정지
    </span>
  ) : (
    <span className="inline-flex whitespace-nowrap rounded-full border border-zinc-300 px-2 py-1 text-xs font-bold text-zinc-600">
      정상
    </span>
  );
}

function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-green-500/15 px-2 py-1 text-xs font-bold text-green-200">
      활성
    </span>
  ) : (
    <span className="shrink-0 whitespace-nowrap rounded-full border border-zinc-300 px-2 py-1 text-xs font-bold text-zinc-400">
      비활성
    </span>
  );
}
