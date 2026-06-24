"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";
import {
  countVehicleIssueKeywordMentions,
  extractVehicleIssueKeywords,
  normalizeVehicleIssueKeyword,
} from "@/utils/vehicleIssueKeywords";
import type { Json } from "@/types/supabase";

type AdminTab =
  | "dashboard"
  | "posts"
  | "reviews"
  | "users"
  | "reports"
  | "notices";
type AdminRole = "user" | "admin" | "super_admin";
type DashboardBoardTab =
  | "traffic"
  | "views"
  | "content"
  | "keywords"
  | "ai";
type DashboardViewFilter = "vehicle" | "model" | "review";
type AiCandidateStatus = "reviewing" | "applied" | "excluded";
type AiCandidateSource = "traffic" | "review" | "keyword" | "mixed";
type AiCandidateArchiveFilter = "today" | "recent3days" | "all";
type CommunityCategory =
  | "free"
  | "maintenance"
  | "news"
  | "electric"
  | "imported"
  | "domestic"
  | "partner";

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

interface AdminDashboardAiCandidate {
  candidateKey: string;
  keyword: string;
  mentionCount: number;
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
  keywordRows: AdminDashboardKeywordRow[];
  aiCandidates: AdminDashboardAiCandidate[];
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
  author_id: string | null;
  author_nickname: string | null;
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

const tabs: { label: string; value: AdminTab }[] = [
  { label: "대시보드", value: "dashboard" },
  { label: "게시글 관리", value: "posts" },
  { label: "후기 관리", value: "reviews" },
  { label: "회원 관리", value: "users" },
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
  aiCandidates: [],
};

const pageClassName = cn(
  "min-h-screen bg-black px-4 py-6 pb-28 text-white sm:px-6 sm:py-8",
);
const shellClassName = cn("mx-auto flex w-full max-w-[1600px] flex-col gap-5");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/20 sm:p-5",
);
const mutedTextClassName = cn("text-sm leading-relaxed text-zinc-400");
const tabButtonClassName = cn(
  "rounded-lg border border-zinc-800 px-3 py-2 text-sm font-bold text-zinc-300 transition",
  "hover:border-zinc-600 hover:bg-zinc-900 hover:text-white",
);
const activeTabButtonClassName = cn(
  "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500",
);
const actionButtonClassName = cn(
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-bold text-zinc-100 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50",
);
const dangerButtonClassName = cn(
  actionButtonClassName,
  "border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20",
);
const tableClassName = cn("min-w-full divide-y divide-zinc-800 text-sm");
const desktopTableClassName = cn(tableClassName, "hidden min-w-[1180px] md:table");
const tableHeadCellClassName = cn(
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-zinc-500",
);
const tableCellClassName = cn("px-3 py-3 align-top text-zinc-200");
const tableActionCellClassName = cn(tableCellClassName, "min-w-[24rem] text-right");
const desktopActionGroupClassName = cn("flex flex-nowrap justify-end gap-1.5");
const mobileListClassName = cn("divide-y divide-zinc-900 md:hidden");
const mobileCardClassName = cn(
  "grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3",
);
const mobileCardTitleClassName = cn(
  "line-clamp-2 break-words text-sm font-black leading-5 text-white",
);
const mobileCardMetaClassName = cn(
  "mt-1 line-clamp-1 break-words text-xs leading-5 text-zinc-500",
);
const mobileCardSubMetaClassName = cn(
  "mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400",
);
const inputClassName = cn(
  "min-h-10 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-white outline-none transition",
  "placeholder:text-zinc-600 focus:border-red-500",
);
const checkboxClassName = cn(
  "h-4 w-4 rounded border-zinc-700 bg-black text-red-500",
  "focus:ring-2 focus:ring-red-500/40 focus:ring-offset-0",
);

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
  const plateNumber = getJsonString(snapshot, "plateNumber");
  const year = getJsonString(snapshot, "year");
  const vehicleName = [brand, model].filter(Boolean).join(" ");

  return [vehicleName || review.vehicle_id, plateNumber, year ? year + "년" : ""]
    .filter(Boolean)
    .join(" · ");
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
  { label: "AI DB 업데이트 추천", value: "ai" },
];

const aiCandidateStatuses: { label: string; value: AiCandidateStatus }[] = [
  { label: "검토중", value: "reviewing" },
  { label: "반영완료 보관함", value: "applied" },
  { label: "제외", value: "excluded" },
];

const aiCandidateActionStatuses: { label: string; value: AiCandidateStatus }[] = [
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

const normalizeAiCandidateStatus = (value: unknown): AiCandidateStatus => {
  if (
    value === "reviewing" ||
    value === "applied" ||
    value === "excluded"
  ) {
    return value;
  }

  return "reviewing";
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
  const [dashboardViewFilter, setDashboardViewFilter] =
    useState<DashboardViewFilter>("vehicle");
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [notices, setNotices] = useState<AdminCommunityPost[]>([]);
  const [popupNotices, setPopupNotices] = useState<AdminPopupNotice[]>([]);
  const [postSearch, setPostSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [noticeSearch, setNoticeSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isVerifiedDealerFeatureReady, setIsVerifiedDealerFeatureReady] =
    useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  const hasProfile = Boolean(profile);
  const isCheckingRole =
    isAuthReady && isAuthenticated && (!isProfileReady || !hasProfile);
  const canAccess =
    isAuthReady && isAuthenticated && isProfileReady && hasProfile && isAdmin;
  const selectedPosts = useMemo(
    () => posts.filter((post) => selectedPostIds.includes(post.id)),
    [posts, selectedPostIds],
  );
  const selectedReviews = useMemo(
    () => reviews.filter((review) => selectedReviewIds.includes(review.id)),
    [reviews, selectedReviewIds],
  );
  const selectedReports = useMemo(
    () =>
      reports.filter((report) => selectedReportIds.includes(report.report_id)),
    [reports, selectedReportIds],
  );
  const allPostsSelected =
    posts.length > 0 && selectedPosts.length === posts.length;
  const allReviewsSelected =
    reviews.length > 0 && selectedReviews.length === reviews.length;
  const allReportsSelected =
    reports.length > 0 && selectedReports.length === reports.length;
  const sessionAccessToken = session?.access_token ?? "";
  const activeSearch = useMemo(() => {
    if (activeTab === "posts") return postSearch;
    if (activeTab === "reviews") return reviewSearch;
    if (activeTab === "users") return userSearch;
    if (activeTab === "reports") return reportSearch;
    if (activeTab === "notices") return noticeSearch;
    return "";
  }, [
    activeTab,
    noticeSearch,
    postSearch,
    reportSearch,
    reviewSearch,
    userSearch,
  ]);

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
      setOperatorDashboardData({
        totalViews: toNumber(nextOperatorDashboard?.total_views),
        trafficRows: toOperatorTrafficRows(
          nextOperatorDashboard?.traffic_rows ?? [],
        ),
        viewRankings: toOperatorViewRankings(
          nextOperatorDashboard?.view_rankings ?? [],
        ),
        keywordRows: toOperatorKeywordRows(
          nextOperatorDashboard?.keyword_rows ?? [],
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
      setSelectedPostIds([]);
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
      keywordRows: current.keywordRows.map((item) =>
        "keyword:" + item.keyword === candidate.candidateKey
          ? { ...item, aiStatus: nextStatus }
          : item,
      ),
    }));

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
        ? "AI 추천 데이터를 차량 DB에 반영했습니다."
        : "AI 추천 상태를 변경했습니다.",
    );
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
            <p className="text-sm font-bold text-red-200">
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
      <div className={shellClassName}>
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold text-red-400">ADMIN</p>
            <h1 className="mt-1 text-2xl font-black text-white">
              관리자 페이지
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {profile?.nickname ?? user?.email ?? "관리자"} 계정으로 접속
              중입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClassName}
              onClick={() => void refreshCurrentTab()}
            >
              새로고침
            </button>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              홈으로
            </Link>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={cn(
                tabButtonClassName,
                activeTab === tab.value && activeTabButtonClassName,
              )}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab !== "dashboard" ? (
          <SearchBar
            activeTab={activeTab}
            searchValue={activeSearch}
            setNoticeSearch={setNoticeSearch}
            setPostSearch={setPostSearch}
            setReportSearch={setReportSearch}
            setReviewSearch={setReviewSearch}
            setUserSearch={setUserSearch}
          />
        ) : null}

        {actionMessage ? (
          <section className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
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
            onChangeViewFilter={setDashboardViewFilter}
            operatorDashboardData={operatorDashboardData}
            posts={posts}
            reports={reports}
            reviews={reviews}
            stats={stats}
            trafficStats={trafficStats}
          />
        ) : null}

        {activeTab === "posts" ? (
          <AdminTablePanel count={posts.length} title="게시글 관리">
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
              {posts.length ? (
                posts.map((post) => (
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
                          <p className={mobileCardTitleClassName}>
                            {post.title}
                          </p>
                          <p className={mobileCardMetaClassName}>
                            {getCommunityCategoryLabel(post.category)} ·{" "}
                            {post.author_nickname ?? formatCompactId(post.user_id)} ·{" "}
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
                ))
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
                      disabled={!posts.length}
                      label="게시글 전체 선택"
                      onChange={(checked) =>
                        setSelectedPostIds(
                          checked ? posts.map((post) => post.id) : [],
                        )
                      }
                    />
                  </th>
                  <th className={tableHeadCellClassName}>제목</th>
                  <th className={tableHeadCellClassName}>분류</th>
                  <th className={tableHeadCellClassName}>상태</th>
                  <th className={tableHeadCellClassName}>지표</th>
                  <th className={tableHeadCellClassName}>작성일</th>
                  <th className={cn(tableHeadCellClassName, "text-right")}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {posts.length ? (
                  posts.map((post) => (
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
                        <p className="max-w-sm font-bold text-white">
                          {post.title}
                        </p>
                        <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-xs leading-[1.7] text-zinc-500">
                          {post.content}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          작성자: {post.author_nickname ?? post.user_id}
                        </p>
                      </td>
                      <td className={tableCellClassName}>
                        {getCommunityCategoryLabel(post.category)}
                      </td>
                      <td className={tableCellClassName}>
                        <PostStatusBadges post={post} />
                      </td>
                      <td className={tableCellClassName}>
                        신고 {post.report_count.toLocaleString()} / 댓글{" "}
                        {post.comment_count.toLocaleString()} / 좋아요{" "}
                        {post.like_count.toLocaleString()}
                      </td>
                      <td className={tableCellClassName}>
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
                  ))
                ) : (
                  <EmptyTableRow colSpan={7} message="게시글이 없습니다." />
                )}
              </tbody>
            </table>
          </AdminTablePanel>
        ) : null}

        {activeTab === "reviews" ? (
          <AdminTablePanel count={reviews.length} title="후기 관리">
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
              {reviews.length ? (
                reviews.map((review) => (
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
                          <p className={mobileCardTitleClassName}>
                            {review.content}
                          </p>
                          <p className={mobileCardMetaClassName}>
                            {review.author_nickname ??
                              (review.author_id
                                ? formatCompactId(review.author_id, 6)
                                : "익명 사용자")}{" "}
                            · {formatReviewVehicleSummary(review)} ·{" "}
                            {formatDate(review.created_at)}
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
                ))
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
                      disabled={!reviews.length}
                      label="후기 전체 선택"
                      onChange={(checked) =>
                        setSelectedReviewIds(
                          checked ? reviews.map((review) => review.id) : [],
                        )
                      }
                    />
                  </th>
                  <th className={tableHeadCellClassName}>내용</th>
                  <th className={tableHeadCellClassName}>작성자</th>
                  <th className={tableHeadCellClassName}>상태</th>
                  <th className={tableHeadCellClassName}>신고</th>
                  <th className={tableHeadCellClassName}>작성일</th>
                  <th className={cn(tableHeadCellClassName, "text-right")}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {reviews.length ? (
                  reviews.map((review) => (
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
                      <td className={tableCellClassName}>
                        <p className="max-w-lg whitespace-pre-wrap break-words leading-[1.7] text-white">
                          {review.content}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          차량 ID: {review.vehicle_id}
                        </p>
                      </td>
                      <td className={tableCellClassName}>
                        {review.author_nickname ??
                          review.author_id ??
                          "익명 사용자"}
                      </td>
                      <td className={tableCellClassName}>
                        <HiddenStatus isHidden={review.is_hidden} />
                      </td>
                      <td className={tableCellClassName}>
                        {review.report_count.toLocaleString()}
                      </td>
                      <td className={tableCellClassName}>
                        {formatDate(review.created_at)}
                      </td>
                      <td className={tableActionCellClassName}>
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
                  ))
                ) : (
                  <EmptyTableRow colSpan={7} message="후기가 없습니다." />
                )}
              </tbody>
            </table>
          </AdminTablePanel>
        ) : null}

        {activeTab === "users" ? (
          <AdminTablePanel count={users.length} title="회원 관리">
            <div className={mobileListClassName}>
              {users.length ? (
                users.map((account) => (
                  <article className={mobileCardClassName} key={account.id}>
                    <div className="min-w-0">
                      <p className={mobileCardTitleClassName}>
                        <VerifiedNickname
                          isVerifiedDealer={account.is_verified_dealer}
                        >
                          {account.nickname ?? "닉네임 없음"}
                        </VerifiedNickname>
                      </p>
                      <p className={mobileCardMetaClassName}>
                        {getDisplayValue(account.email)} ·{" "}
                        {formatProviderLabel(account.login_provider)} · 가입{" "}
                        {formatDate(account.created_at)}
                      </p>
                      <p className={mobileCardMetaClassName}>
                        최근 로그인 {formatOptionalDate(account.last_sign_in_at)}
                      </p>
                      <details className="mt-1 text-xs text-zinc-500">
                        <summary className="cursor-pointer select-none text-zinc-400">
                          회원 ID 보기
                        </summary>
                        <div className="mt-1 break-all font-mono text-[11px] leading-relaxed">
                          {account.id}
                        </div>
                      </details>
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
                              : "border-zinc-700 bg-zinc-900 text-zinc-400",
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
              <tbody className="divide-y divide-zinc-900">
                {users.length ? (
                  users.map((account) => (
                    <tr key={account.id}>
                      <td className={tableCellClassName}>
                        <div className="min-w-32">
                          <details className="group">
                            <summary className="cursor-pointer list-none">
                              <span className="inline-flex items-center gap-1.5">
                                <VerifiedNickname
                                  isVerifiedDealer={account.is_verified_dealer}
                                >
                                  {account.nickname ?? "닉네임 없음"}
                                </VerifiedNickname>
                                <span className="text-[10px] font-bold text-zinc-600 group-open:hidden">
                                  ID
                                </span>
                                <span className="hidden text-[10px] font-bold text-zinc-600 group-open:inline">
                                  접기
                                </span>
                              </span>
                            </summary>
                            <div className="mt-1 max-w-48 break-all font-mono text-[11px] leading-relaxed text-zinc-500">
                              {account.id}
                            </div>
                          </details>
                        </div>
                      </td>
                      <td className={tableCellClassName}>
                        <div className="min-w-56 max-w-72">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-200">
                              {formatProviderLabel(account.login_provider)}
                            </span>
                            <span className="min-w-0 truncate text-xs text-zinc-300">
                              {getDisplayValue(account.email)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClassName}>
                        <span className="font-mono text-sm font-bold text-zinc-100">
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
                              ? "border-zinc-700 bg-zinc-900 text-zinc-500"
                              : account.is_verified_dealer
                                ? "border-[#2563EB]/50 bg-[#2563EB]/10 text-[#2563EB]"
                                : "border-zinc-700 bg-zinc-900 text-zinc-400",
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
                          <p className="text-xs font-bold text-red-300">
                            {report.report_type}
                          </p>
                          <p className={mobileCardTitleClassName}>
                            {report.target_title ?? report.target_content}
                          </p>
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
                    {report.target_path ? (
                      <Link
                        className={cn(
                          actionButtonClassName,
                          "min-h-8 px-2.5 text-[11px]",
                        )}
                        href={report.target_path}
                      >
                        보기
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-500">연결 없음</span>
                    )}
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
                  <th className={tableHeadCellClassName}>바로가기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
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
                        <p className="text-xs font-bold text-red-300">
                          {report.report_type}
                        </p>
                        <p className="mt-1 max-w-sm whitespace-pre-wrap break-words font-bold leading-[1.7] text-white">
                          {report.target_title ?? report.target_content}
                        </p>
                        <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-xs leading-[1.7] text-zinc-500">
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
                        {report.target_path ? (
                          <Link
                            className={actionButtonClassName}
                            href={report.target_path}
                          >
                            대상 보기
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            연결 없음
                          </span>
                        )}
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
              <div className="border-b border-zinc-900 p-3">
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
                        <p className={mobileCardTitleClassName}>
                          {notice.title}
                        </p>
                        <p className={mobileCardMetaClassName}>
                          {notice.content}
                        </p>
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
                    <th className={tableHeadCellClassName}>공지</th>
                    <th className={tableHeadCellClassName}>상태</th>
                    <th className={tableHeadCellClassName}>작성일</th>
                    <th className={cn(tableHeadCellClassName, "text-right")}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {notices.length ? (
                    notices.map((notice) => (
                      <tr key={notice.id}>
                        <td className={tableCellClassName}>
                          <p className="max-w-sm font-bold text-white">
                            {notice.title}
                          </p>
                          <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-xs leading-[1.7] text-zinc-500">
                            {notice.content}
                          </p>
                        </td>
                        <td className={tableCellClassName}>
                          <PostStatusBadges post={notice} />
                        </td>
                        <td className={tableCellClassName}>
                          {formatDate(notice.created_at)}
                        </td>
                        <td className={tableActionCellClassName}>
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
                      colSpan={4}
                      message="공지 내역이 없습니다."
                    />
                  )}
                </tbody>
              </table>
            </AdminTablePanel>

            <AdminTablePanel count={popupNotices.length} title="팝업공지 관리">
              <div className="border-b border-zinc-900 p-3">
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
                        <p className={mobileCardTitleClassName}>
                          {notice.title}
                        </p>
                        <p className={mobileCardMetaClassName}>
                          {notice.content}
                        </p>
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
                    <th className={tableHeadCellClassName}>팝업</th>
                    <th className={tableHeadCellClassName}>상태</th>
                    <th className={tableHeadCellClassName}>작성일</th>
                    <th className={cn(tableHeadCellClassName, "text-right")}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {popupNotices.length ? (
                    popupNotices.map((notice) => (
                      <tr key={notice.id}>
                        <td className={tableCellClassName}>
                          <p className="max-w-sm font-bold text-white">
                            {notice.title}
                          </p>
                          <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-xs leading-[1.7] text-zinc-500">
                            {notice.content}
                          </p>
                          {notice.link_url ? (
                            <p className="mt-2 break-all text-xs text-zinc-500">
                              {notice.link_url}
                            </p>
                          ) : null}
                        </td>
                        <td className={tableCellClassName}>
                          <ActiveStatusBadge isActive={notice.is_active} />
                        </td>
                        <td className={tableCellClassName}>
                          {formatDate(notice.created_at)}
                        </td>
                        <td className={tableActionCellClassName}>
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
                      colSpan={4}
                      message="팝업공지 내역이 없습니다."
                    />
                  )}
                </tbody>
              </table>
            </AdminTablePanel>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function SearchBar({
  activeTab,
  searchValue,
  setNoticeSearch,
  setPostSearch,
  setReportSearch,
  setReviewSearch,
  setUserSearch,
}: {
  activeTab: Exclude<AdminTab, "dashboard">;
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
    reports: "신고 사유, 대상 내용, 작성자 검색",
    notices: "공지 제목, 내용, 팝업 URL 검색",
  }[activeTab];

  const updateSearch = (value: string) => {
    if (activeTab === "posts") setPostSearch(value);
    if (activeTab === "reviews") setReviewSearch(value);
    if (activeTab === "users") setUserSearch(value);
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

function DashboardPanel({
  activeDashboardTab,
  dashboardViewFilter,
  onChangeAiCandidateStatus,
  onChangeDashboardTab,
  onChangeViewFilter,
  operatorDashboardData,
  posts,
  reports,
  reviews,
  stats,
  trafficStats,
}: {
  activeDashboardTab: DashboardBoardTab;
  dashboardViewFilter: DashboardViewFilter;
  onChangeAiCandidateStatus: (
    candidate: AdminDashboardAiCandidate,
    nextStatus: AiCandidateStatus,
  ) => void;
  onChangeDashboardTab: (tab: DashboardBoardTab) => void;
  onChangeViewFilter: (filter: DashboardViewFilter) => void;
  operatorDashboardData: AdminOperatorDashboardData;
  posts: AdminCommunityPost[];
  reports: AdminReport[];
  reviews: AdminReview[];
  stats: AdminStats;
  trafficStats: AdminTrafficStats;
}) {
  const summaryItems = [
    { label: "오늘 방문자", value: trafficStats.todayVisitors },
    { label: "7일 방문자", value: trafficStats.sevenDayVisitors },
    { label: "30일 방문자", value: trafficStats.thirtyDayVisitors },
    { label: "총 조회수", value: operatorDashboardData.totalViews },
    { label: "총 후기수", value: stats.reviews },
    { label: "총 게시글수", value: stats.communityPosts },
    { label: "신고수", value: stats.reports },
  ];
  const filteredRankings = operatorDashboardData.viewRankings.filter(
    (item) => item.type === dashboardViewFilter,
  );
  const recentReviews = reviews.slice(0, 5);
  const recentPosts = posts.filter((post) => !post.is_notice).slice(0, 5);

  return (
    <div className="space-y-4">
      <section className={panelClassName}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-white">운영 요약</h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              오늘 확인할 핵심 지표만 표시합니다.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {summaryItems.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>

      <section className={panelClassName}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-white">운영 게시판</h2>
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
                  "shrink-0 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-white",
                  activeDashboardTab === tab.value &&
                    "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500",
                )}
                onClick={() => onChangeDashboardTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-900">
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
            <DashboardKeywordTable rows={operatorDashboardData.keywordRows} />
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
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black p-3 sm:p-4">
      <p className="truncate text-xs font-bold text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white sm:text-2xl">
        {value.toLocaleString()}
      </p>
    </div>
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
      <table className="min-w-[920px] divide-y divide-zinc-900 text-sm">
        <thead className="bg-black">
          <tr>
            <DashboardHeadCell>날짜</DashboardHeadCell>
            <DashboardHeadCell>방문자 수</DashboardHeadCell>
            <DashboardHeadCell>조회수</DashboardHeadCell>
            <DashboardHeadCell>주요 유입 경로</DashboardHeadCell>
            <DashboardHeadCell>PC/모바일 비율</DashboardHeadCell>
            <DashboardHeadCell>브라우저/OS 요약</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900 bg-zinc-950">
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
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-900 bg-black p-3">
        {dashboardViewFilters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn(
              "shrink-0 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-black text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-white",
              filter === item.value &&
                "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500",
            )}
            onClick={() => onChangeFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[840px] divide-y divide-zinc-900 text-sm">
            <thead className="bg-black">
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
            <tbody className="divide-y divide-zinc-900 bg-zinc-950">
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
      <table className="min-w-[760px] divide-y divide-zinc-900 text-sm">
        <thead className="bg-black">
          <tr>
            <DashboardHeadCell>항목</DashboardHeadCell>
            <DashboardHeadCell>건수</DashboardHeadCell>
            <DashboardHeadCell>관리자가 볼 내용</DashboardHeadCell>
            <DashboardHeadCell>최근 등록/발생</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900 bg-zinc-950">
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
      <div className="grid gap-0 border-t border-zinc-900 md:grid-cols-2">
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

function DashboardKeywordTable({
  rows,
}: {
  rows: AdminDashboardKeywordRow[];
}) {
  if (!rows.length) {
    return (
      <DashboardEmptyState message="10회 이상 언급된 유입/후기 키워드가 없습니다." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] divide-y divide-zinc-900 text-sm">
        <thead className="bg-black">
          <tr>
            <DashboardHeadCell>키워드명</DashboardHeadCell>
            <DashboardHeadCell>언급 횟수</DashboardHeadCell>
            <DashboardHeadCell>관련 차량/모델</DashboardHeadCell>
            <DashboardHeadCell>최근 발생일</DashboardHeadCell>
            <DashboardHeadCell>AI 데이터 반영 여부</DashboardHeadCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900 bg-zinc-950">
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
    useState<AiCandidateStatus>("reviewing");
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
        {} as Record<AiCandidateStatus, number>,
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
    <div className="divide-y divide-zinc-900 bg-zinc-950">
      <div className="bg-black px-4 py-3">
        <h3 className="text-sm font-black text-white">AI DB 업데이트 추천</h3>
        <p className="mt-1 text-xs font-medium text-zinc-500">
          후기 데이터와 조회 신호에서 반복 패턴을 찾고, 관리자는 반영 여부만 결정합니다.
        </p>
      </div>
      <div className="space-y-3 bg-black px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {aiCandidateStatuses.map((status) => (
            <button
              key={status.value}
              type="button"
              className={cn(
                "shrink-0 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-black text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-white",
                activeStatus === status.value &&
                  "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500",
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
                  "rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-black text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-white",
                  archiveFilter === filter.value &&
                    "border-red-500 bg-red-500/20 text-red-100",
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
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-100">
                  {getAiSourceLabel(candidate.source)}
                </span>
                <AiStatusBadge status={candidate.status} />
              </div>
              <h4 className="mt-3 break-words text-lg font-black leading-snug text-white">
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
                    <dd className="mt-1 font-bold text-zinc-200">
                      {updateTargets.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-zinc-500">
                      {activeStatus === "applied" ? "반영일시" : "제외일시"}
                    </dt>
                    <dd className="mt-1 font-bold text-zinc-200">
                      {formatOptionalDate(candidate.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-zinc-500">처리 관리자</dt>
                    <dd className="mt-1 font-bold text-zinc-200">
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
                <ul className="mt-2 space-y-1.5 text-sm font-medium leading-6 text-zinc-200">
                  {suggestedUpdates.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
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
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-300">
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
    <div className="rounded-lg border border-zinc-800 bg-black px-3 py-2">
      <p className="text-[11px] font-bold text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
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
    <section className="border-zinc-900 p-4 md:border-r md:last:border-r-0">
      <h3 className="text-sm font-black text-white">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="rounded-lg border border-zinc-900 bg-black p-3">
              <p className="line-clamp-1 text-sm font-bold text-zinc-100">
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
        "max-w-[24rem] px-3 py-3 align-middle text-zinc-300",
        align === "right" && "text-right",
        strong && "font-black text-white",
      )}
    >
      <span className="line-clamp-2 break-words">{children}</span>
    </td>
  );
}

function DashboardEmptyState({ message }: { message: string }) {
  return <p className={cn(mutedTextClassName, "bg-zinc-950 p-4")}>{message}</p>;
}

function AiStatusBadge({ status }: { status: AiCandidateStatus }) {
  const effectiveStatus = status;
  const label = aiCandidateStatuses.find(
    (item) => item.value === effectiveStatus,
  )?.label;

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center justify-center rounded-full border px-2.5 text-xs font-black",
        effectiveStatus === "applied"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : effectiveStatus === "reviewing"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
            : effectiveStatus === "excluded"
              ? "border-zinc-600 bg-zinc-900 text-zinc-400"
              : "border-red-500/40 bg-red-500/10 text-red-100",
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
  const reasons = [
    candidate.reason ||
      "후기/조회/검색 신호가 기준치 이상 반복되어 DB 업데이트 추천으로 분류됐습니다.",
  ];

  if (evidence.reviewCount !== null && evidence.keywordMentionCount !== null) {
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

  if ((evidence.keywordMentionCount ?? 0) >= 10) {
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
        <h2 className="text-lg font-black text-white">{title}</h2>
        <p className="text-xs text-zinc-500">{count.toLocaleString()}건 표시</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-900 md:overflow-x-auto">
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
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-900 p-3">
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
  return (
    <details className="relative">
      <summary
        className={cn(
          actionButtonClassName,
          "min-h-8 cursor-pointer list-none px-2.5 text-[11px] [&::-webkit-details-marker]:hidden",
        )}
      >
        관리
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-40 flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-xl shadow-black/40">
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
    <>
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
    </>
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
    <>
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
    </>
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
    <>
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
    </>
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
    <>
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
    </>
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
    <>
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
    </>
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
    <div className="flex flex-wrap gap-1.5">
      {post.is_notice ? (
        <span className="rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
          공지
        </span>
      ) : null}
      {post.is_pinned ? (
        <span className="rounded-full bg-amber-500 px-2 py-1 text-xs font-bold text-black">
          상단고정
        </span>
      ) : null}
      <HiddenStatus isHidden={post.is_hidden} />
    </div>
  );
}

function HiddenStatus({ isHidden }: { isHidden: boolean }) {
  return isHidden ? (
    <span className="rounded-full bg-zinc-700 px-2 py-1 text-xs font-bold text-zinc-200">
      숨김
    </span>
  ) : (
    <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-400">
      노출
    </span>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  const roleClassName =
    role === "super_admin"
      ? "border-red-500/60 bg-red-500/10 text-red-200"
      : role === "admin"
        ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
        : "border-zinc-700 text-zinc-300";

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
    <span className="inline-flex whitespace-nowrap rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-200">
      정지
    </span>
  ) : (
    <span className="inline-flex whitespace-nowrap rounded-full border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-300">
      정상
    </span>
  );
}

function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="rounded-full bg-green-500/15 px-2 py-1 text-xs font-bold text-green-200">
      활성
    </span>
  ) : (
    <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-400">
      비활성
    </span>
  );
}
