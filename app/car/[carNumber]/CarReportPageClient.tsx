"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import { AiSummaryCard } from "@/components/AiSummaryCard";
import { CarViewEventToast } from "@/components/CarViewEventToast";
import { ReviewCard } from "@/components/ReviewCard";
import { useAuth } from "@/hooks/useAuth";
import { useGuestReportAccess } from "@/hooks/useGuestReportAccess";
import { useRecentViews } from "@/hooks/useRecentViews";
import { useReviews } from "@/hooks/useReviews";
import { useVehicle } from "@/hooks/useVehicle";
import { fetchPublicAiKeywordRules } from "@/lib/aiKeywordRules";
import { recordPageView } from "@/lib/pageViews";
import {
  fetchSupabaseModelReviewKeywordStats,
  fetchSupabaseReviewsByVehicleModel,
} from "@/lib/supabaseData";
import { fetchVehicleInspectionProfile } from "@/lib/vehicleInspectionProfiles";
import type { VehicleInspectionProfile } from "@/data/vehicleInspectionData";
import { getStructuredAiSummary } from "@/utils/aiSummary";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  getReviewKeywordStats,
  type ReviewKeywordStat,
} from "@/utils/reviewKeywordStats";
import { getVehicleModelKey } from "@/utils/vehicleModelKey";
import {
  getHelpfulCountsSnapshot,
  getServerHelpfulCountsSnapshot,
  parseHelpfulJson,
  subscribeToHelpfulChanges,
} from "@/utils/reviewHelpful";
import type { Review } from "@/types/review";
import type { VehicleIssueKeywordRule } from "@/utils/vehicleIssueKeywords";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn("w-full rounded-2xl bg-zinc-900 p-6");
const homeButtonClassName = cn(
  "mb-8 inline-flex items-center rounded-lg bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-gray-200 transition",
  "hover:opacity-75",
);
const actionLinkClassName = cn(
  "block w-full rounded-xl bg-red-500 p-4 text-center font-bold transition",
  "hover:bg-red-600",
);
const editLinkClassName = cn(
  "mt-3 mb-6 block w-full rounded-xl bg-zinc-700 p-3 text-center text-sm font-bold transition",
  "hover:bg-zinc-600",
);
const reviewPaginationClassName = cn(
  "mb-8 flex flex-wrap items-center justify-center gap-2",
);
const reviewPageButtonClassName = cn(
  "rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-800 hover:text-white active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-transparent disabled:hover:text-gray-300",
);
const activeReviewPageButtonClassName = cn(
  "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500",
);
const reviewHeaderClassName = cn(
  "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
);
const sortControlClassName = cn(
  "inline-flex w-full rounded-lg border border-zinc-700 bg-zinc-950 p-1 sm:w-auto",
);
const sortButtonClassName = cn(
  "flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-gray-400 transition sm:flex-none",
  "hover:bg-zinc-800 hover:text-white active:scale-[0.98]",
);
const activeSortButtonClassName = cn("bg-red-500 text-white hover:bg-red-500");
const reviewsPerPage = 5;
type ReviewSortOption = "latest" | "helpful" | "photo";

const getParsedTime = (dateLabel: string, fallbackTime: number | string) => {
  const parsedTime = Date.parse(dateLabel);

  if (!Number.isNaN(parsedTime)) {
    return parsedTime;
  }

  const fallbackNumber = Number(fallbackTime);

  return Number.isNaN(fallbackNumber) ? 0 : fallbackNumber;
};

export default function CarReportPage() {
  const params = useParams();
  const router = useRouter();
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>("latest");
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [inspectionProfile, setInspectionProfile] =
    useState<VehicleInspectionProfile | null>(null);
  const [aiKeywordRules, setAiKeywordRules] = useState<
    VehicleIssueKeywordRule[]
  >([]);
  const [modelReviewStatsSnapshot, setModelReviewStatsSnapshot] = useState<{
    keywordStats: ReviewKeywordStat[];
    modelKey: string;
    reviewCount: number;
  } | null>(null);
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string),
  );
  const {
    isAllowed: isGuestReportAllowed,
    isAuthenticated,
    isChecking: isGuestReportChecking,
    signInWithGoogle,
    signInWithKakao,
  } = useGuestReportAccess(carNumber);

  const { isAdmin, user } = useAuth();
  const { deleteReview, reviews } = useReviews(carNumber);
  const { vehicle } = useVehicle(carNumber);
  const { saveRecentView } = useRecentViews();
  const aiAnalysisEventKeyRef = useRef<string | null>(null);
  const brand = vehicle?.brand ?? "";
  const model = vehicle?.model ?? "";
  const generation = vehicle?.generation ?? "";
  const year = vehicle?.year ?? "";
  const mileage = vehicle?.mileage ?? "";
  const fuelType = vehicle?.fuelType ?? "";
  const hasVehicleInfo = Boolean(brand && model && generation && year);
  const currentVehicleModelKey = useMemo(
    () => (vehicle ? getVehicleModelKey(vehicle) : ""),
    [vehicle],
  );

  const helpfulCountsSnapshot = useSyncExternalStore(
    subscribeToHelpfulChanges,
    getHelpfulCountsSnapshot,
    getServerHelpfulCountsSnapshot,
  );
  const helpfulCounts = useMemo(
    () => parseHelpfulJson<Record<string, number>>(helpfulCountsSnapshot, {}),
    [helpfulCountsSnapshot],
  );
  const sortedReviews = useMemo(
    () =>
      [...reviews].sort((left, right) => {
        const leftHelpfulCount =
          helpfulCounts[`${carNumber}-${left.id}`] ?? left.helpfulCount ?? 0;
        const rightHelpfulCount =
          helpfulCounts[`${carNumber}-${right.id}`] ?? right.helpfulCount ?? 0;
        const leftCreatedTime = getParsedTime(left.createdAt, left.id);
        const rightCreatedTime = getParsedTime(right.createdAt, right.id);

        if (reviewSort === "helpful") {
          return (
            rightHelpfulCount - leftHelpfulCount ||
            rightCreatedTime - leftCreatedTime
          );
        }

        if (reviewSort === "photo") {
          const leftHasImages = (left.images?.length ?? 0) > 0;
          const rightHasImages = (right.images?.length ?? 0) > 0;

          if (leftHasImages !== rightHasImages) {
            return Number(rightHasImages) - Number(leftHasImages);
          }

          return rightCreatedTime - leftCreatedTime;
        }

        return rightCreatedTime - leftCreatedTime;
      }),
    [carNumber, helpfulCounts, reviewSort, reviews],
  );
  const modelReviewStats = useMemo(
    () =>
      modelReviewStatsSnapshot?.modelKey === currentVehicleModelKey
        ? modelReviewStatsSnapshot
        : null,
    [currentVehicleModelKey, modelReviewStatsSnapshot],
  );
  const modelReviewKeywordStats = useMemo(
    () => modelReviewStats?.keywordStats ?? [],
    [modelReviewStats],
  );
  const modelReviewCount = modelReviewStats?.reviewCount ?? 0;
  const focusedReviewKeywordStats = useMemo(
    () =>
      getReviewKeywordStats(reviews, 5, 1, {
        fuelType,
        generation,
        keywordRules: aiKeywordRules,
        modelName: model,
      }),
    [aiKeywordRules, fuelType, generation, model, reviews],
  );
  const aiAnalysis = useMemo(
    () =>
      getStructuredAiSummary(brand, model, year, mileage, {
        fuelType,
        generation,
        inspectionProfile,
        reviewCount: modelReviewCount,
        reviewKeywordStats: modelReviewKeywordStats,
        vehicleNumber: carNumber,
      }),
    [
      brand,
      carNumber,
      fuelType,
      generation,
      inspectionProfile,
      mileage,
      model,
      modelReviewCount,
      modelReviewKeywordStats,
      year,
    ],
  );
  const totalReviewPages = Math.max(
    1,
    Math.ceil(sortedReviews.length / reviewsPerPage),
  );
  const currentReviewPage = Math.min(reviewPage, totalReviewPages);
  const visibleReviews = sortedReviews.slice(
    (currentReviewPage - 1) * reviewsPerPage,
    currentReviewPage * reviewsPerPage,
  );
  const changeReviewSort = (nextSort: ReviewSortOption) => {
    setReviewSort(nextSort);
    setReviewPage(1);
  };
  const recentTitle =
    [brand, model, generation].filter(Boolean).join(" ") || carNumber;
  const reviewPath = `/car/${encodeURIComponent(carNumber)}/review`;
  const reviewLoginPath = `/login?redirectTo=${encodeURIComponent(reviewPath)}`;
  const getCanManageReview = (review: Review) =>
    Boolean(user && (review.authorId === user.id || isAdmin));
  const handleEditReview = (review: Review) => {
    router.push(
      reviewPath + "?reviewId=" + encodeURIComponent(String(review.id)),
    );
  };
  const handleDeleteReview = async (review: Review) => {
    const reviewId = String(review.id);

    if (!getCanManageReview(review) || deletingReviewId) {
      return;
    }

    if (!window.confirm("후기를 삭제하시겠습니까?")) {
      return;
    }

    setDeletingReviewId(reviewId);

    try {
      const didDelete = await deleteReview(reviewId);

      if (!didDelete) {
        window.alert("삭제 권한이 없거나 이미 삭제된 후기입니다.");
      }
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "후기 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  };

  useEffect(() => {
    if (!isGuestReportAllowed) {
      return;
    }

    saveRecentView(carNumber, recentTitle, vehicle ?? undefined);
  }, [carNumber, isGuestReportAllowed, recentTitle, vehicle, saveRecentView]);

  useEffect(() => {
    if (!isGuestReportAllowed || !vehicle?.id) {
      return;
    }

    void recordPageView({
      eventType: "vehicle_search",
      vehicleId: vehicle.id,
    }).catch(() => {
      // Traffic analytics should never block the vehicle report page.
    });
  }, [isGuestReportAllowed, vehicle?.id]);

  useEffect(() => {
    if (
      !isGuestReportAllowed ||
      !vehicle?.id ||
      !modelReviewStatsSnapshot ||
      modelReviewStatsSnapshot.modelKey !== currentVehicleModelKey
    ) {
      return;
    }

    const eventKey = vehicle.id + ":" + modelReviewStatsSnapshot.modelKey;

    if (aiAnalysisEventKeyRef.current === eventKey) {
      return;
    }

    aiAnalysisEventKeyRef.current = eventKey;
    void recordPageView({
      eventType: "ai_analysis_complete",
      vehicleId: vehicle.id,
    }).catch(() => {
      // Analytics should never block the vehicle report page.
    });
  }, [
    currentVehicleModelKey,
    isGuestReportAllowed,
    modelReviewStatsSnapshot,
    vehicle?.id,
  ]);

  useEffect(() => {
    let isActive = true;

    fetchPublicAiKeywordRules()
      .then((rules) => {
        if (isActive) {
          setAiKeywordRules(rules);
        }
      })
      .catch(() => {
        if (isActive) {
          setAiKeywordRules([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!brand || !model) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setInspectionProfile(null);
        }
      });
      return () => {
        isActive = false;
      };
    }

    fetchVehicleInspectionProfile(brand, model, generation)
      .then((profile) => {
        if (isActive) {
          setInspectionProfile(profile);
        }
      })
      .catch(() => {
        if (isActive) {
          setInspectionProfile(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [brand, generation, model]);

  useEffect(() => {
    let isActive = true;

    if (!vehicle || !currentVehicleModelKey) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setModelReviewStatsSnapshot(null);
        }
      });
      return () => {
        isActive = false;
      };
    }

    fetchSupabaseModelReviewKeywordStats(vehicle, aiKeywordRules)
      .then(async (statsResult) => {
        if (statsResult) {
          return statsResult;
        }

        const fallbackReviews = (await fetchSupabaseReviewsByVehicleModel(vehicle)) ?? [];

        return {
          keywordStats: getReviewKeywordStats(fallbackReviews, 5, 1, {
            fuelType,
            generation,
            keywordRules: aiKeywordRules,
            modelName: model,
          }),
          reviewCount: fallbackReviews.length,
        };
      })
      .then((statsResult) => {
        if (isActive) {
          setModelReviewStatsSnapshot({
            keywordStats: statsResult.keywordStats,
            modelKey: currentVehicleModelKey,
            reviewCount: statsResult.reviewCount,
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setModelReviewStatsSnapshot({
            keywordStats: [],
            modelKey: currentVehicleModelKey,
            reviewCount: 0,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [aiKeywordRules, currentVehicleModelKey, fuelType, generation, model, vehicle]);

  const kakaoLoginFromCurrentPage = () => {
    void signInWithKakao(window.location.href);
  };

  const googleLoginFromCurrentPage = () => {
    void signInWithGoogle(window.location.href);
  };

  if (isGuestReportChecking) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <button
            type="button"
            onClick={() => router.push("/")}
            className={homeButtonClassName}
          >
            ← 홈으로
          </button>

          <h1 className="text-5xl font-bold mb-6">카팩트 리포트</h1>

          <div className={panelClassName}>
            <p className="text-sm text-zinc-400">
              로그인 상태를 확인하고 있습니다.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    const vehicleTitle = [brand, model, generation].filter(Boolean).join(" ");
    const teaserFields = [
      { label: "현재 주행거리", hint: "로그인 후 공개" },
      { label: "주요 제원", hint: "로그인 후 공개" },
      { label: "정비 이력", hint: "로그인 후 공개" },
      { label: "성능 점검", hint: "로그인 후 공개" },
      { label: "실제 후기", hint: "로그인 후 공개" },
    ];

    return (
      <main className="min-h-screen overflow-hidden bg-black text-white">
        <div
          className="pointer-events-none fixed inset-0 opacity-80"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at 50% 18%, rgba(239,68,68,0.18), transparent 32%), radial-gradient(circle at 15% 70%, rgba(255,255,255,0.05), transparent 28%)",
          }}
        />

        <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-16 pt-6 sm:px-10 sm:pt-10">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-400 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            다시 조회하기
          </button>

          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-red-950/20 sm:p-10">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent"
              aria-hidden="true"
            />

            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold tracking-[0.18em] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
                CARFACT CHECK · 조회 완료
              </div>
              <span className="text-xs font-semibold tracking-[0.2em] text-zinc-600">
                VERIFIED VEHICLE
              </span>
            </div>

            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold text-red-400">
                실제 차량정보가 확인되었습니다
              </p>
              <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
                {hasVehicleInfo ? vehicleTitle : "차량 기본정보 확인 완료"}
              </h1>
              {year && (
                <p className="mt-4 text-xl font-bold text-zinc-300 sm:text-2xl">
                  {year}년식
                </p>
              )}
              <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                모델과 연식까지 조회되었습니다. 상세 이력은 본인 확인 후 안전하게
                공개됩니다.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teaserFields.map((field) => (
                <div
                  key={field.label}
                  className="group relative min-h-28 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-5"
                >
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-md"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-300">
                        {field.label}
                      </span>
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-500"
                        aria-hidden="true"
                      >
                        🔒
                      </span>
                    </div>
                    <div className="h-3 w-3/4 rounded-full bg-zinc-800 blur-[2px]" />
                    <p className="mt-3 text-xs font-medium text-zinc-600">
                      {field.hint}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-7">
              <div>
                <h2 className="text-xl font-black sm:text-2xl">
                  로그인하면 전체 차량정보가 열립니다
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  로그인 후 이 화면으로 돌아와 주행거리, 제원, 정비·성능점검
                  정보와 실제 후기를 확인할 수 있어요.
                </p>
                <p className="mt-3 text-sm font-bold text-white">
                  카팩트(CARFACT)의 모든 서비스는 무료로 제공됩니다.
                </p>
              </div>

              <div className="mt-5 grid shrink-0 gap-2 sm:mt-0 sm:min-w-56">
                <button
                  type="button"
                  onClick={kakaoLoginFromCurrentPage}
                  className="rounded-xl bg-[#FEE500] px-5 py-3 text-sm font-black text-black transition hover:brightness-95 active:scale-[0.98]"
                >
                  카카오로 계속하기
                </button>
                <button
                  type="button"
                  onClick={googleLoginFromCurrentPage}
                  className="rounded-xl border border-white/15 bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Google로 계속하기
                </button>
              </div>
            </div>
          </section>

          <p className="mt-6 text-center text-xs leading-5 text-zinc-700">
            상세 정보는 로그인한 사용자에게만 제공됩니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <button
          type="button"
          onClick={() => router.push("/")}
          className={homeButtonClassName}
        >
          ← 홈으로
        </button>

        <h1 className="text-5xl font-bold mb-6">카팩트 리포트</h1>

        <p className="text-2xl text-gray-300 mb-10">
          차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
        </p>

        <CarViewEventToast carNumber={carNumber} />

        <div className={panelClassName}>
          {!hasVehicleInfo ? (
            <>
              <p className="text-gray-300 mb-6">
                차량 정보를 찾지 못했어요. 직접 차량 정보를 등록해주세요.
              </p>

              <Link
                href={`/car/${encodeURIComponent(carNumber)}/setup`}
                className={actionLinkClassName}
              >
                차량 정보 등록하기
              </Link>
            </>
          ) : (
            <>
              <section className="mb-6">
                <h2 className="mb-4 text-2xl font-bold">차량정보</h2>
                <div className="rounded-xl bg-zinc-800 p-4">
                  <p className="text-gray-300">
                    {[brand, model, generation, year && `${year}년`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(fuelType || mileage) && (
                    <p className="text-sm text-gray-500 mt-2">
                      {[
                        fuelType,
                        mileage &&
                          `주행거리: ${Number(mileage).toLocaleString()}km`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <Link
                  href={`/car/${encodeURIComponent(carNumber)}/edit`}
                  className={editLinkClassName}
                >
                  차량정보가 바뀌었나요?
                </Link>
              </section>

              <AiSummaryCard
                analysis={aiAnalysis}
                focusedReviewCount={reviews.length}
                focusedReviewKeywords={focusedReviewKeywordStats}
                summaries={[]}
              />

              <div className={reviewHeaderClassName}>
                <h2 className="text-3xl font-bold">등록된 팩트/후기</h2>
                <div className={sortControlClassName} aria-label="후기 정렬">
                  <button
                    type="button"
                    onClick={() => changeReviewSort("latest")}
                    aria-pressed={reviewSort === "latest"}
                    className={cn(
                      sortButtonClassName,
                      reviewSort === "latest" && activeSortButtonClassName,
                    )}
                  >
                    최신순
                  </button>
                  <button
                    type="button"
                    onClick={() => changeReviewSort("helpful")}
                    aria-pressed={reviewSort === "helpful"}
                    className={cn(
                      sortButtonClassName,
                      reviewSort === "helpful" && activeSortButtonClassName,
                    )}
                  >
                    도움순
                  </button>
                  <button
                    type="button"
                    onClick={() => changeReviewSort("photo")}
                    aria-pressed={reviewSort === "photo"}
                    className={cn(
                      sortButtonClassName,
                      reviewSort === "photo" && activeSortButtonClassName,
                    )}
                  >
                    사진순
                  </button>
                </div>
              </div>

              {reviews.length === 0 ? (
                <p className="text-gray-400 mb-8">
                  아직 등록된 후기가 없습니다.
                </p>
              ) : (
                <div className="space-y-4 mb-8">
                  {visibleReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      canDelete={getCanManageReview(review)}
                      canEdit={getCanManageReview(review)}
                      isDeleting={deletingReviewId === String(review.id)}
                      onDelete={() => void handleDeleteReview(review)}
                      onEdit={() => handleEditReview(review)}
                      review={review}
                      reviewKey={`${carNumber}-${review.id}`}
                      vehicleId={vehicle?.id}
                    />
                  ))}
                </div>
              )}

              {reviews.length > reviewsPerPage && (
                <div
                  className={reviewPaginationClassName}
                  aria-label="후기 페이지"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setReviewPage(Math.max(1, currentReviewPage - 1))
                    }
                    disabled={currentReviewPage === 1}
                    className={reviewPageButtonClassName}
                  >
                    이전
                  </button>

                  {Array.from({ length: totalReviewPages }, (_, index) => {
                    const page = index + 1;

                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setReviewPage(page)}
                        aria-current={
                          currentReviewPage === page ? "page" : undefined
                        }
                        className={cn(
                          reviewPageButtonClassName,
                          currentReviewPage === page &&
                            activeReviewPageButtonClassName,
                        )}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      setReviewPage(
                        Math.min(totalReviewPages, currentReviewPage + 1),
                      )
                    }
                    disabled={currentReviewPage === totalReviewPages}
                    className={reviewPageButtonClassName}
                  >
                    다음
                  </button>
                </div>
              )}

              <Link
                href={isAuthenticated ? reviewPath : reviewLoginPath}
                className={actionLinkClassName}
              >
                이 차량 후기 남기기
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
