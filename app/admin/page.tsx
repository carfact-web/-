"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";
import type { Json } from "@/types/supabase";

type AdminTab =
  | "dashboard"
  | "posts"
  | "reviews"
  | "users"
  | "reports"
  | "notices";
type AdminRole = "user" | "admin" | "super_admin";
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
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-100 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50",
);
const dangerButtonClassName = cn(
  actionButtonClassName,
  "border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20",
);
const tableClassName = cn("min-w-full divide-y divide-zinc-800 text-sm");
const tableHeadCellClassName = cn(
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-zinc-500",
);
const tableCellClassName = cn("px-3 py-3 align-top text-zinc-200");
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

  return date.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

export default function AdminPage() {
  const router = useRouter();
  const {
    isAdmin,
    isAuthenticated,
    isAuthReady,
    isProfileReady,
    isSuperAdmin,
    profile,
    user,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [trafficStats, setTrafficStats] =
    useState<AdminTrafficStats>(emptyTrafficStats);
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
      const [
        statsResult,
        postsResult,
        reviewsResult,
        usersResult,
        reportsResult,
        noticesResult,
        popupNoticesResult,
        trafficStatsResult,
        verifiedDealerFeatureResult,
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
        supabase.rpc("list_verified_dealer_profiles", {
          target_user_ids: [],
        }),
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
      setPosts((postsResult.data ?? []) as AdminCommunityPost[]);
      setReviews((reviewsResult.data ?? []) as AdminReview[]);
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
            <table className={tableClassName}>
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
                  <th className={tableHeadCellClassName}>관리</th>
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
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() =>
                              void updatePostState(post, {
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
                              void updatePostState(post, {
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
                              void updatePostState(post, {
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
                              onClick={() => void deletePost(post)}
                            >
                              영구삭제
                            </button>
                          ) : null}
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
            <table className={tableClassName}>
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
                  <th className={tableHeadCellClassName}>관리</th>
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
                        {review.title ? (
                          <p className="max-w-lg break-words font-bold text-white">
                            {review.title}
                          </p>
                        ) : null}
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
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() => void updateReviewHidden(review)}
                          >
                            {review.is_hidden ? "숨김해제" : "숨김"}
                          </button>
                          {isSuperAdmin ? (
                            <button
                              type="button"
                              className={dangerButtonClassName}
                              onClick={() => void deleteReview(review)}
                            >
                              영구삭제
                            </button>
                          ) : null}
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
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeadCellClassName}>회원 ID</th>
                  <th className={tableHeadCellClassName}>닉네임</th>
                  <th className={tableHeadCellClassName}>변경권</th>
                  <th className={tableHeadCellClassName}>Role</th>
                  <th className={tableHeadCellClassName}>인증딜러</th>
                  <th className={tableHeadCellClassName}>상태</th>
                  <th className={tableHeadCellClassName}>가입일</th>
                  <th className={tableHeadCellClassName}>관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {users.length ? (
                  users.map((account) => (
                    <tr key={account.id}>
                      <td className={tableCellClassName}>
                        <span className="font-mono text-xs text-zinc-400">
                          {account.id}
                        </span>
                      </td>
                      <td className={tableCellClassName}>
                        <VerifiedNickname
                          isVerifiedDealer={account.is_verified_dealer}
                        >
                          {account.nickname ?? "닉네임 없음"}
                        </VerifiedNickname>
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
                      <td className={tableCellClassName}>
                        <AccountStatusBadge
                          isSuspended={account.is_suspended}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        {formatDate(account.created_at)}
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={actionButtonClassName}
                            disabled={account.role === "super_admin"}
                            onClick={() => void setUserSuspended(account)}
                          >
                            {account.is_suspended ? "정지해제" : "정지"}
                          </button>
                          <button
                            type="button"
                            className={actionButtonClassName}
                            disabled={!isVerifiedDealerFeatureReady}
                            onClick={() => void setVerifiedDealer(account)}
                            title={
                              isVerifiedDealerFeatureReady
                                ? undefined
                                : "인증딜러 기능 DB 미적용"
                            }
                          >
                            {account.is_verified_dealer
                              ? "인증딜러 회수"
                              : "인증딜러 부여"}
                          </button>
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() =>
                              void grantNicknameChangeTicket(account)
                            }
                          >
                            닉네임 변경권 +1
                          </button>
                          <button
                            type="button"
                            className={actionButtonClassName}
                            disabled={!isSuperAdmin || account.role !== "user"}
                            onClick={() => void setUserRole(account, "admin")}
                          >
                            관리자 부여
                          </button>
                          <button
                            type="button"
                            className={actionButtonClassName}
                            disabled={!isSuperAdmin || account.role !== "admin"}
                            onClick={() => void setUserRole(account, "user")}
                          >
                            관리자 회수
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyTableRow colSpan={8} message="회원이 없습니다." />
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
            <table className={tableClassName}>
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
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>공지</th>
                    <th className={tableHeadCellClassName}>상태</th>
                    <th className={tableHeadCellClassName}>작성일</th>
                    <th className={tableHeadCellClassName}>관리</th>
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
                        <td className={tableCellClassName}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={actionButtonClassName}
                              onClick={() => void upsertCommunityNotice(notice)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className={dangerButtonClassName}
                              onClick={() => void deleteCommunityNotice(notice)}
                            >
                              삭제
                            </button>
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
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeadCellClassName}>팝업</th>
                    <th className={tableHeadCellClassName}>상태</th>
                    <th className={tableHeadCellClassName}>작성일</th>
                    <th className={tableHeadCellClassName}>관리</th>
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
                        <td className={tableCellClassName}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={actionButtonClassName}
                              onClick={() => void togglePopupNotice(notice)}
                            >
                              {notice.is_active ? "비활성" : "활성"}
                            </button>
                            <button
                              type="button"
                              className={actionButtonClassName}
                              onClick={() => void upsertPopupNotice(notice)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className={dangerButtonClassName}
                              onClick={() => void deletePopupNotice(notice)}
                            >
                              삭제
                            </button>
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
  reviews,
  stats,
  trafficStats,
}: {
  reviews: AdminReview[];
  stats: AdminStats;
  trafficStats: AdminTrafficStats;
}) {
  const reviewsById = new Map(reviews.map((review) => [review.id, review]));
  const trafficItems = [
    { label: "오늘 방문자", value: trafficStats.todayVisitors },
    { label: "7일 방문자", value: trafficStats.sevenDayVisitors },
    { label: "30일 방문자", value: trafficStats.thirtyDayVisitors },
    { label: "총 방문자", value: trafficStats.totalVisitors },
    { label: "오늘 후기수", value: trafficStats.todayReviews },
    { label: "총 후기수", value: trafficStats.totalReviews },
    { label: "총 회원수", value: trafficStats.totalUsers },
  ];
  const contentItems = [
    { label: "회원수", value: stats.users },
    { label: "게시글수", value: stats.communityPosts },
    { label: "후기수", value: stats.reviews },
    { label: "댓글수", value: stats.comments },
    { label: "신고수", value: stats.reports },
  ];

  return (
    <div className="space-y-4">
      <section className={panelClassName}>
        <h2 className="text-lg font-black text-white">트래픽 통계</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trafficItems.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <TrafficBreakdownPanel
          emptyMessage="기기 통계가 없습니다."
          items={trafficStats.deviceBreakdown.map((item) => ({
            ...item,
            label: formatTrafficLabel(item.label),
          }))}
          title="모바일 / PC / 태블릿 비율"
        />
        <TrafficBreakdownPanel
          emptyMessage="브라우저 통계가 없습니다."
          items={trafficStats.browserBreakdown}
          title="브라우저별 방문 비율"
        />
        <TrafficBreakdownPanel
          emptyMessage="OS 통계가 없습니다."
          items={trafficStats.osBreakdown}
          title="OS별 방문 비율"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <TrafficBreakdownPanel
          emptyMessage="유입경로 기록이 없습니다."
          items={trafficStats.referrerTop.map((item) => ({
            ...item,
            label: item.label === "direct" ? "직접 유입" : item.label,
          }))}
          title="유입경로 TOP10"
        />
        <TrafficBreakdownPanel
          emptyMessage="접속 페이지 기록이 없습니다."
          items={trafficStats.pathTop.map((item) => ({
            ...item,
            label: item.label === "unknown" ? "알 수 없음" : item.label,
          }))}
          title="접속 페이지 TOP10"
        />
        <TrafficTimePanel
          emptyMessage="시간대별 기록이 없습니다."
          items={trafficStats.hourlyVisitors}
          title="시간대별 방문자 수"
        />
        <TrafficTimePanel
          emptyMessage="일자별 기록이 없습니다."
          items={trafficStats.dailyVisitors}
          title="일자별 방문자 수"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TrafficVehicleRankingPanel
          emptyMessage="차량 조회 기록이 없습니다."
          items={trafficStats.topVehicles}
          title="조회수 TOP10 차량"
        />
        <TrafficModelRankingPanel
          emptyMessage="모델 조회 기록이 없습니다."
          items={trafficStats.topModels}
          title="조회수 TOP10 모델"
        />
        <TrafficRankingPanel
          emptyMessage="후기 조회 기록이 없습니다."
          items={trafficStats.topReviews.map((item) => {
            const review = reviewsById.get(item.review_id);
            const snapshot = review?.vehicle_snapshot;
            const manufacturer =
              item.manufacturer ??
              (snapshot ? getJsonString(snapshot, "brand") : null);
            const model =
              item.model ??
              (snapshot ? getJsonString(snapshot, "model") : null);
            const carNumber =
              item.car_number ??
              (snapshot ? getJsonString(snapshot, "plateNumber") : null);
            const year =
              item.year ?? (snapshot ? getJsonString(snapshot, "year") : null);

            return {
              id: item.review_id,
              meta: [
                year ? year + "년" : "",
                item.author_nickname ? "작성자 " + item.author_nickname : "",
                item.content,
              ]
                .filter(Boolean)
                .join(" · "),
              title: formatTrafficVehicleTitle({
                carNumber,
                manufacturer,
                model,
              }),
              viewCount: item.view_count,
            };
          })}
          title="조회수 TOP10 후기"
        />
      </div>

      <section className={panelClassName}>
        <h2 className="text-lg font-black text-white">콘텐츠 현황</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {contentItems.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black p-4">
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function formatTrafficLabel(label: string) {
  return (
    {
      desktop: "PC",
      mobile: "모바일",
      tablet: "태블릿",
      unknown: "알 수 없음",
    }[label] ?? label
  );
}

function formatTrafficVehicleTitle({
  carNumber,
  manufacturer,
  model,
}: {
  carNumber: string | null;
  manufacturer: string | null;
  model: string | null;
}) {
  const vehicleName = [manufacturer, model].filter(Boolean).join(" ");

  if (vehicleName && carNumber) {
    return vehicleName + " · " + carNumber;
  }

  return vehicleName || carNumber || "차량 정보 없음";
}

function formatTrafficVehicleModel(item: AdminTrafficTopVehicle) {
  return item.model_detail ?? item.generation ?? item.model ?? "차종 정보 없음";
}

function formatTrafficVehicleMeta(item: AdminTrafficTopVehicle) {
  return [
    item.year ? item.year + "년형" : "",
    item.fuel_type,
    formatMileage(item.mileage),
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatMileage(value: string | null) {
  if (!value) {
    return "";
  }

  const numericValue = Number(value.replace(/[^0-9]/g, ""));

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue.toLocaleString() + "km";
  }

  return value;
}

function formatTrafficModelName(item: AdminTrafficTopModel) {
  const modelName = item.model_name?.trim();
  const manufacturer = item.manufacturer?.trim();

  if (!modelName && !manufacturer) {
    return "모델 정보 없음";
  }

  if (!manufacturer || !modelName) {
    return modelName || manufacturer || "모델 정보 없음";
  }

  if (modelName.toLowerCase().includes(manufacturer.toLowerCase())) {
    return modelName;
  }

  return manufacturer + " " + modelName;
}

function TrafficBreakdownPanel({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: AdminTrafficBreakdownItem[];
  title: string;
}) {
  const visibleItems = items.filter((item) => item.visitor_count > 0);

  return (
    <section className={panelClassName}>
      <h2 className="text-lg font-black text-white">{title}</h2>
      {visibleItems.length ? (
        <div className="mt-4 space-y-3">
          {visibleItems.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-bold text-zinc-200">
                  {item.label}
                </span>
                <span className="shrink-0 font-black text-zinc-100">
                  {item.visitor_count.toLocaleString()}
                  {item.percentage !== undefined
                    ? ` · ${item.percentage.toFixed(1)}%`
                    : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width:
                      Math.max(2, Math.min(item.percentage ?? 0, 100)) + "%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={cn(mutedTextClassName, "mt-4")}>{emptyMessage}</p>
      )}
    </section>
  );
}

function TrafficTimePanel({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: AdminTrafficTimeItem[];
  title: string;
}) {
  const maxValue = Math.max(1, ...items.map((item) => item.visitor_count));
  const hasVisitors = items.some((item) => item.visitor_count > 0);

  return (
    <section className={panelClassName}>
      <h2 className="text-lg font-black text-white">{title}</h2>
      {hasVisitors ? (
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs"
            >
              <span className="truncate font-bold text-zinc-500">
                {item.label}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width:
                      Math.max(2, (item.visitor_count / maxValue) * 100) + "%",
                  }}
                />
              </div>
              <span className="text-right font-black text-zinc-100">
                {item.visitor_count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={cn(mutedTextClassName, "mt-4")}>{emptyMessage}</p>
      )}
    </section>
  );
}

function TrafficVehicleRankingPanel({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: AdminTrafficTopVehicle[];
  title: string;
}) {
  return (
    <section className={panelClassName}>
      <h2 className="text-lg font-black text-white">{title}</h2>
      {items.length ? (
        <ol className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.vehicle_id || index}
              className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 rounded-lg border border-zinc-800 bg-black p-3"
            >
              <span className="pt-0.5 text-sm font-black text-red-400">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">
                  {item.car_number ?? "차량번호 없음"}
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-zinc-100">
                  {formatTrafficVehicleModel(item)}
                </span>
                {formatTrafficVehicleMeta(item) ? (
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {formatTrafficVehicleMeta(item)}
                  </span>
                ) : null}
              </span>
              <span className="pt-0.5 text-right text-sm font-black text-zinc-100">
                조회수 {item.view_count.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={cn(mutedTextClassName, "mt-4")}>{emptyMessage}</p>
      )}
    </section>
  );
}

function TrafficModelRankingPanel({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: AdminTrafficTopModel[];
  title: string;
}) {
  return (
    <section className={panelClassName}>
      <h2 className="text-lg font-black text-white">{title}</h2>
      {items.length ? (
        <ol className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li
              key={(item.manufacturer ?? "") + (item.model_name ?? "") + index}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border border-zinc-800 bg-black p-3"
            >
              <span className="text-sm font-black text-red-400">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {formatTrafficModelName(item)}
                </span>
              </span>
              <span className="text-right text-sm font-black text-zinc-100">
                조회수 {item.view_count.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={cn(mutedTextClassName, "mt-4")}>{emptyMessage}</p>
      )}
    </section>
  );
}

function TrafficRankingPanel({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: { id: string; meta: string; title: string; viewCount: number }[];
  title: string;
}) {
  return (
    <section className={panelClassName}>
      <h2 className="text-lg font-black text-white">{title}</h2>
      {items.length ? (
        <ol className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id || index}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border border-zinc-800 bg-black p-3"
            >
              <span className="text-sm font-black text-red-400">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {item.title}
                </span>
                {item.meta ? (
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {item.meta}
                  </span>
                ) : null}
              </span>
              <span className="text-sm font-black text-zinc-100">
                조회 {item.viewCount.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={cn(mutedTextClassName, "mt-4")}>{emptyMessage}</p>
      )}
    </section>
  );
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
      <div className="overflow-x-auto rounded-lg border border-zinc-900">
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
    <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-200">
      정지
    </span>
  ) : (
    <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-300">
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
