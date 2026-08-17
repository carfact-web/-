"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import type { Vehicle } from "@/types/vehicle";
import type { VehicleIssueKeywordRule } from "@/utils/vehicleIssueKeywords";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const shellClassName = cn("mx-auto w-full max-w-5xl");
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
type CommercialPlateCheckState = "checking" | "eligible" | "ineligible" | "error";

interface CommercialPlateCheckResponse {
  display?: {
    brand?: string | null;
    carName?: string | null;
    firstRegistrationDate?: string | null;
    fuelType?: string | null;
    generation?: string | null;
    inspectionHistoryCount?: number | null;
    latestPerformanceMileage?: string | null;
    maintenanceHistoryCount?: number | null;
    manufacturer?: string | null;
    performanceCheckCount?: number | null;
    usage?: string | null;
    vehicleType?: string | null;
    year?: string | null;
  } | null;
  match?: {
    candidates?: Array<{
      brand: string;
      generation: string;
      model: string;
    }>;
    status?: "matched" | "multiple_candidates" | "unmatched";
    vehicle?: Omit<Vehicle, "plateNumber"> | null;
  } | null;
  error?: string;
  ok?: boolean;
}

interface AutoMatchingState {
  candidates: NonNullable<CommercialPlateCheckResponse["match"]>["candidates"];
  display: CommercialPlateCheckResponse["display"];
  status: NonNullable<CommercialPlateCheckResponse["match"]>["status"];
  vehicle: Vehicle;
}

const getParsedTime = (dateLabel: string, fallbackTime: number | string) => {
  const parsedTime = Date.parse(dateLabel);

  if (!Number.isNaN(parsedTime)) {
    return parsedTime;
  }

  const fallbackNumber = Number(fallbackTime);

  return Number.isNaN(fallbackNumber) ? 0 : fallbackNumber;
};

const buildSlotOptions = (value: string, candidates: string[]) => {
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))].slice(0, 5);

  if (!value) {
    return uniqueCandidates.length ? uniqueCandidates : ["정보 없음"];
  }

  return [...uniqueCandidates.filter((item) => item !== value), value].slice(-5);
};

const formatMileageLabel = (mileage: string | null | undefined) => {
  const numericMileage = String(mileage ?? "").replace(/[^0-9]/g, "");

  return numericMileage ? `${Number(numericMileage).toLocaleString()} km` : "";
};

function AutoMatchCheckBadge() {
  return (
    <span className="auto-match-check-badge" aria-hidden="true">
      <svg
        className="auto-match-check-svg"
        viewBox="0 0 38 38"
        focusable="false"
      >
        <path
          className="auto-match-check-path"
          d="M10.5 19.5 16.2 25 28 13.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4.2"
        />
      </svg>
    </span>
  );
}

function AutoMatchingPanel({
  onComplete,
  onSelectCandidate,
  state,
}: {
  onComplete: () => void;
  onSelectCandidate: (
    candidate: NonNullable<AutoMatchingState["candidates"]>[number],
  ) => void;
  state: AutoMatchingState | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const candidates = state?.candidates ?? [];
  const isReady = Boolean(state);
  const fields = [
    {
      checkingLabel: "제조사 확인 중…",
      label: "제조사",
      value: state?.vehicle.brand ?? "",
      options: buildSlotOptions(
        state?.vehicle.brand ?? "",
        candidates.map((item) => item.brand),
      ),
    },
    {
      checkingLabel: "모델명 확인 중…",
      label: "모델",
      value: state?.vehicle.model ?? "",
      options: buildSlotOptions(
        state?.vehicle.model ?? "",
        candidates.map((item) => item.model),
      ),
    },
    {
      checkingLabel: "세부모델 확인 중…",
      label: "세부모델",
      value: state?.vehicle.generation ?? "",
      options: buildSlotOptions(
        state?.vehicle.generation ?? "",
        candidates.map((item) => item.generation),
      ),
    },
    {
      checkingLabel: "연식 확인 중…",
      label: "연식",
      value: state?.vehicle.year ?? "",
      options: buildSlotOptions(state?.vehicle.year ?? "", [
        state?.display?.year ?? "",
      ]),
    },
    {
      checkingLabel: "연료 확인 중…",
      label: "연료",
      value: state?.vehicle.fuelType ?? "",
      options: buildSlotOptions(state?.vehicle.fuelType ?? "", [
        state?.display?.fuelType ?? "",
      ]),
    },
    {
      checkingLabel: "주행거리 확인 중…",
      label: "주행거리",
      value: formatMileageLabel(state?.vehicle.mileage),
      options: buildSlotOptions(state?.vehicle.mileage ?? "", [
        state?.display?.latestPerformanceMileage ?? "",
      ]).map((item) =>
        /^\d+$/.test(item) ? `${Number(item).toLocaleString()} km` : item,
      ),
    },
  ];
  const needsUserSelection =
    state?.status === "multiple_candidates" && candidates.length > 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(media.matches);

    if (!isReady) {
      setActiveIndex(0);
      return;
    }

    if (media.matches) {
      setActiveIndex(fields.length);
      if (!needsUserSelection) {
        const completeTimer = window.setTimeout(onComplete, 700);
        return () => window.clearTimeout(completeTimer);
      }
      return;
    }

    setActiveIndex(0);

    const timers = fields.map((_, index) =>
      window.setTimeout(() => setActiveIndex(index + 1), 430 * (index + 1)),
    );
    const completeTimer = needsUserSelection
      ? null
      : window.setTimeout(onComplete, 430 * fields.length + 700);

    return () => {
      timers.forEach(window.clearTimeout);
      if (completeTimer !== null) {
        window.clearTimeout(completeTimer);
      }
    };
  }, [fields.length, isReady, needsUserSelection, onComplete]);

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-red-950/20 sm:p-8">
          <div className="mb-4 sm:mb-5">
            <p className="text-[11px] font-black tracking-[0.16em] text-red-400 sm:text-xs">
              CARFACT AUTO MATCHING
            </p>
            <h1 className="mt-1.5 whitespace-nowrap text-[22px] font-bold leading-tight text-white sm:text-[26px]">
              차량정보 자동 선택 중
            </h1>
            <p className="mt-1.5 text-[13px] font-semibold text-zinc-400 sm:text-sm">
              차량정보를 순서대로 확인하고 있습니다
            </p>
          </div>

          <div className="grid gap-2.5 sm:gap-3">
            {fields.map((field, index) => {
              const isActive = activeIndex === index;
              const isLocked = activeIndex > index;
              const finalValue = field.value || "제공 정보 없음";
              const currentValue =
                isLocked || isReducedMotion
                  ? finalValue
                  : isActive
                    ? field.checkingLabel
                    : "대기 중";

              return (
                <div
                  key={field.label}
                  className={cn(
                    "grid min-h-[74px] grid-cols-[25%_minmax(0,60%)_15%] items-center gap-0 rounded-xl border bg-zinc-900/80 px-3 py-2.5 transition sm:min-h-20 sm:grid-cols-[8rem_minmax(0,1fr)_3rem] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3",
                    isActive
                      ? "border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.24)]"
                      : "border-white/10",
                    isLocked && "bg-red-500/5",
                  )}
                >
                  <p className="auto-match-label">
                    <span className="auto-match-label-pin" aria-hidden="true">
                      📌
                    </span>
                    <span className="truncate">{field.label}</span>
                  </p>
                  <div className="relative mx-2 h-10 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black px-3 sm:mx-0 sm:h-11 sm:px-4">
                    <div
                      className={cn(
                        "flex h-full min-w-0 items-center truncate whitespace-nowrap text-[16px] font-black text-white transition-transform duration-300 min-[380px]:text-[17px] sm:text-lg",
                        isActive && "motion-safe:animate-pulse",
                      )}
                    >
                      {currentValue || "정보 없음"}
                    </div>
                  </div>
                  <div className="grid justify-items-end">
                    {isLocked ? (
                      <AutoMatchCheckBadge />
                    ) : (
                      <span
                        className={cn(
                          "auto-match-status-indicator",
                          isActive
                            ? "auto-match-status-indicator-active"
                            : "auto-match-status-indicator-waiting",
                        )}
                        aria-label={`${field.label} ${isActive ? "확인 중" : "대기"}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {needsUserSelection ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <p className="text-sm font-bold text-amber-200">
                세부모델 후보를 확인해주세요.
              </p>
              <div className="mt-3 grid gap-2">
                {candidates.map((candidate) => (
                  <button
                    key={`${candidate.brand}-${candidate.model}-${candidate.generation}`}
                    type="button"
                    onClick={() => onSelectCandidate(candidate)}
                    className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-left text-sm font-bold text-white transition hover:border-red-500 active:scale-[0.98]"
                  >
                    {[candidate.brand, candidate.model, candidate.generation]
                      .filter(Boolean)
                      .join(" ")}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function CarReportPage() {
  const params = useParams();
  const router = useRouter();
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>("latest");
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [commercialPlateCheckState, setCommercialPlateCheckState] =
    useState<CommercialPlateCheckState>("checking");
  const [commercialPlateCheckError, setCommercialPlateCheckError] = useState("");
  const [commercialPlateRetryCount, setCommercialPlateRetryCount] = useState(0);
  const [apiVehicle, setApiVehicle] = useState<Vehicle | null>(null);
  const [apiDisplay, setApiDisplay] =
    useState<NonNullable<CommercialPlateCheckResponse["display"]> | null>(null);
  const [autoMatchingState, setAutoMatchingState] =
    useState<AutoMatchingState | null>(null);
  const [showAutoMatching, setShowAutoMatching] = useState(false);
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

  const { isAdmin, session, user } = useAuth();
  const { deleteReview, reviews } = useReviews(carNumber);
  const { vehicle: registeredVehicle } = useVehicle(carNumber);
  const { saveRecentView } = useRecentViews();
  const vehicle = registeredVehicle ?? apiVehicle;
  const aiAnalysisEventKeyRef = useRef<string | null>(null);
  const brand = vehicle?.brand ?? "";
  const model = vehicle?.model ?? "";
  const generation = vehicle?.generation ?? "";
  const year = vehicle?.year ?? "";
  const mileage = vehicle?.mileage ?? "";
  const fuelType = vehicle?.fuelType ?? "";
  const hasVehicleInfo = Boolean(vehicle && (model || year));
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

  useEffect(() => {
    if (!isAuthenticated) return;

    const accessToken = session?.access_token;
    if (!accessToken || !carNumber) return;

    const controller = new AbortController();
    let isActive = true;

    void Promise.resolve().then(() => {
      if (isActive) {
        setAutoMatchingState(null);
        setCommercialPlateCheckState("checking");
        setCommercialPlateCheckError("");
        setShowAutoMatching(false);
      }
    });

    fetch("/api/kotsa/commercial-plate", {
      body: JSON.stringify({ vehicleNumber: carNumber }),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | CommercialPlateCheckResponse
          | null;

        if (!response.ok || !payload?.ok) {
          const message =
            payload?.error ?? "상품용 차량 여부를 확인하지 못했습니다.";

          if (
            isActive &&
            /(매매 상품용|상품용 차량|제공 대상|조회 대상|대상 차량).*(아니|없|불가)|확인되지 않/.test(
              message,
            )
          ) {
            setCommercialPlateCheckState("ineligible");
            return;
          }

          throw new Error(message);
        }
        if (!isActive) return;

        const display = payload.display;
        const registrationYear = display?.firstRegistrationDate
          ?.replace(/\D/g, "")
          .slice(0, 4);
        const matchedVehicle = payload.match?.vehicle;
        const nextVehicle: Vehicle = matchedVehicle
          ? { ...matchedVehicle, plateNumber: carNumber }
          : {
              brand: display?.manufacturer ?? display?.brand ?? "",
              fuelType: display?.fuelType ?? "",
              generation: display?.generation ?? display?.vehicleType ?? "",
              mileage: display?.latestPerformanceMileage ?? "",
              model: display?.carName ?? display?.vehicleType ?? "",
              plateNumber: carNumber,
              year: display?.year ?? registrationYear ?? "",
            };

        setApiDisplay(display ?? null);
        setApiVehicle(nextVehicle);
        setAutoMatchingState({
          candidates: payload.match?.candidates ?? [],
          display: display ?? null,
          status: payload.match?.status,
          vehicle: nextVehicle,
        });
        setShowAutoMatching(true);

        // A successful response from the approved attachment API is the
        // eligibility signal. Usage classification must not block the report.
        setCommercialPlateCheckState("eligible");
      })
      .catch((error: unknown) => {
        if (!isActive || controller.signal.aborted) return;

        setCommercialPlateCheckState("error");
        setCommercialPlateCheckError(
          error instanceof Error
            ? error.message
            : "상품용 차량 여부를 확인하지 못했습니다.",
        );
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [carNumber, commercialPlateRetryCount, isAuthenticated, session?.access_token]);

  const kakaoLoginFromCurrentPage = () => {
    void signInWithKakao(window.location.href);
  };

  const googleLoginFromCurrentPage = () => {
    void signInWithGoogle(window.location.href);
  };

  const completeAutoMatching = useCallback(() => {
    setShowAutoMatching(false);
  }, []);

  const selectAutoMatchingCandidate = useCallback(
    (candidate: NonNullable<AutoMatchingState["candidates"]>[number]) => {
      const nextVehicle: Vehicle = {
        brand: candidate.brand,
        fuelType: apiVehicle?.fuelType ?? "",
        generation: candidate.generation,
        mileage: apiVehicle?.mileage ?? "",
        model: candidate.model,
        plateNumber: carNumber,
        year: apiVehicle?.year ?? "",
      };

      setApiVehicle(nextVehicle);
      setAutoMatchingState((current) =>
        current
          ? {
              ...current,
              status: "matched",
              vehicle: nextVehicle,
            }
          : null,
      );
      setShowAutoMatching(true);
    },
    [apiVehicle?.fuelType, apiVehicle?.mileage, apiVehicle?.year, carNumber],
  );

  if (isGuestReportChecking) {
    return (
      <AutoMatchingPanel
        onComplete={completeAutoMatching}
        onSelectCandidate={selectAutoMatchingCandidate}
        state={null}
      />
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

  if (commercialPlateCheckState === "ineligible") {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className="rounded-3xl border border-white/10 bg-zinc-950 p-7 shadow-2xl shadow-red-950/20 sm:p-10">
            <div className="mb-6 inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-bold tracking-[0.16em] text-red-400">
              CARFACT CHECK
            </div>
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
              해당 차량은 중고차 매매 상품용 차량으로 확인되지 않습니다.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
              차량번호를 다시 확인하거나 다른 차량을 조회해주세요.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-9 inline-flex rounded-xl bg-red-500 px-6 py-4 text-sm font-black text-white transition hover:bg-red-600 active:scale-[0.98]"
            >
              처음으로 이동
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (commercialPlateCheckState === "error") {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <section className="rounded-3xl border border-white/10 bg-zinc-950 p-7 sm:p-10">
            <p className="text-sm font-bold text-red-400">
              차량정보를 불러오지 못했습니다.
            </p>
            <h1 className="mt-3 text-3xl font-black">잠시 후 다시 시도해주세요.</h1>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-500">
              {commercialPlateCheckError}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setCommercialPlateRetryCount((count) => count + 1)}
                className="rounded-xl bg-red-500 px-6 py-4 text-sm font-black transition hover:bg-red-600 active:scale-[0.98]"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-white/10 bg-zinc-900 px-6 py-4 text-sm font-black transition hover:bg-zinc-800 active:scale-[0.98]"
              >
                처음으로
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (commercialPlateCheckState === "checking" || showAutoMatching) {
    return (
      <AutoMatchingPanel
        onComplete={completeAutoMatching}
        onSelectCandidate={selectAutoMatchingCandidate}
        state={autoMatchingState}
      />
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
              <section className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-black/45">
                <div className="border-b border-white/10 px-5 py-6 sm:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.18em] text-red-400">
                        CARFACT VEHICLE DATA
                      </p>
                      <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                        {[brand, model].filter(Boolean).join(" ") || "조회 차량"}
                      </h2>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        공공데이터에서 확인된 항목만 표시합니다.
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">
                      조회 완료
                    </span>
                  </div>
                </div>

                <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["제조사", brand],
                    ["모델", model],
                    ["세대·차종", generation],
                    ["연료", fuelType],
                    ["연식", year ? `${year}년식` : ""],
                    [
                      "현재 주행거리",
                      mileage
                        ? `${Number(mileage.replace(/[^0-9.]/g, "")).toLocaleString()} km`
                        : "",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="min-h-28 bg-zinc-950 px-5 py-5 sm:px-6">
                      <p className="text-xs font-bold text-zinc-600">{label}</p>
                      <p className="mt-3 text-lg font-black text-white">
                        {value || "제공 정보 없음"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 px-5 py-6 sm:px-8">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.16em] text-red-400">
                        HISTORY &amp; INSPECTION
                      </p>
                      <h3 className="mt-2 text-2xl font-black">정비·성능정보</h3>
                    </div>
                    <p className="text-xs font-semibold text-zinc-600">
                      관계기관 제공 기준
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["정비 이력", apiDisplay?.maintenanceHistoryCount],
                      ["성능점검 이력", apiDisplay?.performanceCheckCount],
                      ["검사 이력", apiDisplay?.inspectionHistoryCount],
                    ].map(([label, count]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                      >
                        <p className="text-sm font-bold text-zinc-400">{label}</p>
                        <p className="mt-3 text-3xl font-black">
                          {typeof count === "number" ? `${count}건` : "제공 정보 없음"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-xs leading-5 text-zinc-600">
                    세부 이력은 제공 범위와 조회 시점에 따라 달라질 수 있습니다.
                    A4 리포트 양식은 추후 내려받기 기능에서 사용됩니다.
                  </p>
                </div>

                {registeredVehicle && (
                  <Link
                    href={`/car/${encodeURIComponent(carNumber)}/edit`}
                    className={editLinkClassName}
                  >
                    차량정보가 바뀌었나요?
                  </Link>
                )}
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
