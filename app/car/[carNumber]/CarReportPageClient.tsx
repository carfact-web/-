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
import type {
  KotsaDetailedHistory,
  KotsaMaintenanceHistoryItem,
  KotsaPerformanceHistoryItem,
} from "@/types/kotsa";
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
type HistoryDetailType = "maintenance" | "performance" | null;

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
    detailedHistory?: KotsaDetailedHistory | null;
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

interface DealerRegistrationPermission {
  canRegister: boolean;
  isLoading: boolean;
  isVerifiedDealer: boolean;
  role: string;
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

const createMissingAutoMatchingState = (plateNumber: string): AutoMatchingState => ({
  candidates: [],
  display: null,
  status: "unmatched",
  vehicle: {
    brand: "",
    fuelType: "",
    generation: "",
    mileage: "",
    model: "",
    plateNumber,
    year: "",
  },
});

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

function AutoMatchMissingBadge() {
  return (
    <span className="auto-match-missing-badge" aria-hidden="true">
      <svg
        className="auto-match-check-svg"
        viewBox="0 0 38 38"
        focusable="false"
      >
        <path
          className="auto-match-x-path auto-match-x-path-first"
          d="M12.5 12.5 25.5 25.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4.2"
        />
        <path
          className="auto-match-x-path auto-match-x-path-second"
          d="M25.5 12.5 12.5 25.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
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
    void Promise.resolve().then(() => {
      setIsReducedMotion(media.matches);
    });

    if (!isReady) {
      void Promise.resolve().then(() => {
        setActiveIndex(0);
      });
      return;
    }

    if (media.matches) {
      void Promise.resolve().then(() => {
        setActiveIndex(fields.length);
      });
      if (!needsUserSelection) {
        const completeTimer = window.setTimeout(onComplete, 700);
        return () => window.clearTimeout(completeTimer);
      }
      return;
    }

    void Promise.resolve().then(() => {
      setActiveIndex(0);
    });

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
              const hasFinalValue = Boolean(field.value);
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
                    "grid min-h-[74px] grid-cols-[106px_minmax(0,1fr)_40px] items-center gap-3 rounded-xl border bg-zinc-900/80 px-3 py-2.5 transition sm:min-h-20 sm:grid-cols-[120px_minmax(0,1fr)_48px] sm:rounded-2xl sm:px-4 sm:py-3",
                    isActive
                      ? "border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.24)]"
                      : "border-white/10",
                    isLocked && "bg-red-500/5",
                  )}
                >
                  <span className="vehicle-field-label">
                    <span className="vehicle-field-pin" aria-hidden="true">
                      📌
                    </span>
                    <span className="truncate">{field.label}</span>
                  </span>
                  <div className="relative h-10 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black px-3 sm:h-11 sm:px-4">
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
                      hasFinalValue ? (
                        <AutoMatchCheckBadge />
                      ) : (
                        <AutoMatchMissingBadge />
                      )
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

function CommercialIneligibleModal({
  canRegister,
  isOpen,
  onGoHome,
  onRegister,
}: {
  canRegister: boolean;
  isOpen: boolean;
  onGoHome: () => void;
  onRegister: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commercial-ineligible-title"
    >
      <section className="modal-enter w-[calc(100%-40px)] max-w-[500px] rounded-3xl border border-white/10 bg-zinc-950 p-6 text-center shadow-2xl shadow-red-950/30 sm:p-8">
        <div className="mb-5 flex justify-center">
          <AutoMatchMissingBadge />
        </div>
        <p className="mb-3 text-xs font-black tracking-[0.16em] text-red-400">
          CARFACT CHECK
        </p>
        <h1
          id="commercial-ineligible-title"
          className="text-[21px] font-black leading-tight text-white sm:text-[24px]"
        >
          {canRegister
            ? "등록된 차량정보를 찾지 못했습니다"
            : "매매 상품용 차량으로 확인되지 않았습니다"}
        </h1>
        <p className="mt-4 text-[15px] font-semibold leading-6 text-zinc-300">
          {canRegister
            ? "해당 차량은 현재 중고차 매매 상품용 차량으로 확인되지 않습니다."
            : "해당 차량은 중고차 매매 상품용 차량으로 확인되지 않습니다."}
        </p>
        <p className="mt-3 text-[13px] leading-6 text-zinc-500 sm:text-sm">
          {canRegister
            ? "인증 딜러는 실제 매매 상품용 차량인 경우 차량정보를 직접 등록할 수 있습니다."
            : "카팩트는 중고차 매매 상품용 차량에 한해 차량정보와 실제 후기를 공유하고 있습니다."}
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onGoHome}
            className={cn(
              "h-[52px] rounded-xl border border-white/10 bg-zinc-900 px-5 text-sm font-black text-white transition hover:bg-zinc-800 active:scale-[0.98]",
              !canRegister && "sm:col-span-2",
            )}
          >
            처음 화면으로 이동
          </button>
          {canRegister ? (
            <button
              type="button"
              onClick={onRegister}
              className="h-[52px] rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-600 active:scale-[0.98]"
            >
              차량정보 직접 등록
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function VehicleUnavailableGuide({
  onHome,
  onLookup,
}: {
  onHome: () => void;
  onLookup: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-950 p-7 shadow-2xl shadow-red-950/20 sm:p-10">
      <p className="mb-3 text-xs font-black tracking-[0.16em] text-red-400">
        CARFACT CHECK
      </p>
      <h1 className="text-[24px] font-black leading-tight text-white sm:text-3xl">
        차량정보를 확인할 수 없습니다
      </h1>
      <p className="mt-4 text-[15px] font-semibold leading-6 text-zinc-300">
        입력하신 차량번호가 정확한지 다시 확인해 주세요.
      </p>
      <p className="mt-3 text-[13px] leading-6 text-zinc-500 sm:text-sm">
        카팩트는 중고차 매매 상품용 차량에 한해 차량정보와 실제 후기를 제공하고 있습니다.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onLookup}
          className="h-[52px] rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-600 active:scale-[0.98]"
        >
          다른 차량 조회하기
        </button>
        <button
          type="button"
          onClick={onHome}
          className="h-[52px] rounded-xl border border-white/10 bg-zinc-900 px-5 text-sm font-black text-white transition hover:bg-zinc-800 active:scale-[0.98]"
        >
          홈으로 이동
        </button>
      </div>
    </section>
  );
}

function DealerVehicleRegistrationGuide({
  onHome,
  onRegister,
}: {
  onHome: () => void;
  onRegister: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-950 p-7 shadow-2xl shadow-red-950/20 sm:p-10">
      <p className="mb-3 text-xs font-black tracking-[0.16em] text-red-400">
        CARFACT DEALER
      </p>
      <h1 className="text-[24px] font-black leading-tight text-white sm:text-3xl">
        차량 정보를 찾지 못했습니다
      </h1>
      <p className="mt-4 text-[15px] font-semibold leading-6 text-zinc-300">
        인증 딜러는 실제 매매 상품용 차량인 경우 차량정보를 직접 등록할 수 있습니다.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRegister}
          className="h-[52px] rounded-xl bg-red-500 px-5 text-sm font-black text-white transition hover:bg-red-600 active:scale-[0.98]"
        >
          차량정보 직접 등록
        </button>
        <button
          type="button"
          onClick={onHome}
          className="h-[52px] rounded-xl border border-white/10 bg-zinc-900 px-5 text-sm font-black text-white transition hover:bg-zinc-800 active:scale-[0.98]"
        >
          홈으로 이동
        </button>
      </div>
    </section>
  );
}

const historyDisclaimer =
  "표시된 이력은 국토교통부 및 한국교통안전공단에서 제공된 자동차정보를 기반으로 하며, 실제 정비명세서의 전체 내용과 차이가 있을 수 있습니다.";

const formatHistoryMileage = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? `${Number(digits).toLocaleString()} km` : "제공 정보 없음";
};

const formatHistoryValue = (value: string | null | undefined) =>
  value?.trim() ? value : "제공 정보 없음";

const hiddenHistoryValues = new Set([
  "x",
  "null",
  "미제공",
  "정보없음",
  "정보 없음",
  "해당사항없음",
  "해당 사항 없음",
]);

const getVisibleHistoryValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return hiddenHistoryValues.has(trimmed.replace(/\s+/g, " ").toLowerCase())
    ? null
    : trimmed;
};

const splitHistoryBadges = (value: string | null | undefined) =>
  getVisibleHistoryValue(value)
    ?.split(/[·,]/)
    .map((item) => getVisibleHistoryValue(item))
    .filter((item): item is string => Boolean(item)) ?? [];

function HistoryCountCard({
  count,
  disabled,
  label,
  onClick,
}: {
  count: number;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  const valueLabel = disabled && count === 0 ? "정보 없음" : `${count.toLocaleString()}건`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-[82px] rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition sm:min-h-[92px] sm:rounded-2xl sm:p-4",
        !disabled &&
          "cursor-pointer hover:border-red-500/60 hover:bg-red-500/10 active:scale-[0.99]",
        disabled && "cursor-default opacity-75",
      )}
    >
      <p className="text-[11px] font-semibold leading-tight text-zinc-400 sm:text-[13px]">
        {label}
      </p>
      <p className="mt-2 text-[21px] font-[750] leading-tight sm:text-[26px]">
        {valueLabel}
      </p>
      {disabled ? (
        <p className="mt-2 text-[10px] font-semibold leading-tight text-zinc-500 sm:text-xs">
          제공된 검사 세부정보가 없습니다
        </p>
      ) : null}
    </button>
  );
}

function MaintenanceHistoryList({
  items,
}: {
  items: KotsaMaintenanceHistoryItem[];
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <MaintenanceHistoryCard item={item} key={item.id} />
      ))}
    </div>
  );
}

function MaintenanceHistoryCard({
  item,
}: {
  item: KotsaMaintenanceHistoryItem;
}) {
  const [isBusinessNameExpanded, setIsBusinessNameExpanded] = useState(false);
  const componentName =
    getVisibleHistoryValue(item.componentName) ?? "정비 항목 확인 필요";
  const businessName = getVisibleHistoryValue(item.businessName);
  const jobTypeBadges = splitHistoryBadges(item.jobType);

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs leading-none">
        <span className="font-black text-white">
          {formatHistoryValue(item.date)}
        </span>
        <span className="min-w-0 truncate font-semibold text-zinc-500">
          {formatHistoryMileage(item.mileage)}
        </span>
      </div>

      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
        <h4 className="min-w-0 text-[15px] font-black leading-tight text-white sm:text-base">
          {componentName}
        </h4>
        {jobTypeBadges.map((badge) => (
          <span
            className="inline-flex h-5 max-w-full items-center rounded-full bg-red-500/15 px-2 text-[10px] font-black leading-none text-red-100"
            key={badge}
          >
            {badge}
          </span>
        ))}
      </div>

      {businessName ? (
        <button
          type="button"
          className={cn(
            "mt-1 block w-full min-w-0 text-left text-[11px] font-semibold leading-4 text-zinc-500",
            !isBusinessNameExpanded && "truncate",
          )}
          onClick={() => setIsBusinessNameExpanded((current) => !current)}
          title={businessName}
        >
          {businessName}
        </button>
      ) : null}
    </article>
  );
}

function PerformanceHistoryList({
  items,
}: {
  items: KotsaPerformanceHistoryItem[];
}) {
  const changedFields = new Set<string>();

  if (items.length >= 2) {
    const [latest, previous] = items;
    (
      [
        ["accidentStatus", "사고 여부"],
        ["repairStatus", "수리·상태"],
        ["statusCategory", "상태 구분"],
        ["mileage", "주행거리"],
      ] as const
    ).forEach(([key, label]) => {
      if (latest[key] && previous[key] && latest[key] !== previous[key]) {
        changedFields.add(label);
      }
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <article
          key={item.id}
          className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">
                {index === 0 ? "최신 점검" : "이전 점검"}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {formatHistoryValue(item.inspectionDate)}
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-200">
              {formatHistoryMileage(item.mileage)}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {[
              ["사고 여부", item.accidentStatus],
              ["수리·상태", item.repairStatus],
              ["상태 구분", item.statusCategory],
              ["점검업체", item.inspectionBusinessName],
              ["제공업체", item.informationBusinessName],
              [
                "유효기간",
                [item.validFrom, item.validTo].filter(Boolean).join(" ~ "),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className={cn(
                  "rounded-xl bg-black/30 p-3",
                  changedFields.has(String(label)) && "ring-1 ring-red-400/40",
                )}
              >
                <dt className="text-[11px] font-bold text-zinc-500">{label}</dt>
                <dd className="mt-1 font-semibold text-zinc-100">
                  {formatHistoryValue(String(value ?? ""))}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function HistoryDetailPanel({
  detailedHistory,
  onClose,
  type,
}: {
  detailedHistory: KotsaDetailedHistory;
  onClose: () => void;
  type: Exclude<HistoryDetailType, null>;
}) {
  const isMaintenance = type === "maintenance";
  const title = isMaintenance ? "정비이력 상세" : "성능점검 이력 상세";
  const subtitle = isMaintenance
    ? `전체 ${detailedHistory.maintenance.length.toLocaleString()}건`
    : `전체 ${detailedHistory.performance.length.toLocaleString()}건`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/75 px-4 pt-8 backdrop-blur-sm sm:items-center sm:px-5 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-detail-title"
      onClick={onClose}
    >
      <section
        className="modal-enter flex max-h-[calc(100dvh-72px)] w-full flex-col rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/50 sm:max-h-[82vh] sm:max-w-[800px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[11px] font-black tracking-[0.16em] text-red-400">
              CARFACT HISTORY
            </p>
            <h3
              id="history-detail-title"
              className="mt-1.5 text-xl font-black text-white sm:text-2xl"
            >
              {title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-zinc-500">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-lg font-black text-white transition hover:bg-white/10"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:px-5">
          {isMaintenance ? (
            <MaintenanceHistoryList items={detailedHistory.maintenance} />
          ) : (
            <PerformanceHistoryList items={detailedHistory.performance} />
          )}
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs font-medium leading-5 text-zinc-500">
            {historyDisclaimer}
          </p>
        </div>
      </section>
    </div>
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
  const [showCommercialIneligibleModal, setShowCommercialIneligibleModal] =
    useState(false);
  const [activeHistoryDetail, setActiveHistoryDetail] =
    useState<HistoryDetailType>(null);
  const [dealerRegistrationPermission, setDealerRegistrationPermission] =
    useState<DealerRegistrationPermission>({
      canRegister: false,
      isLoading: true,
      isVerifiedDealer: false,
      role: "user",
    });
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

  const { isAdmin, isAuthReady, isProfileReady, session, user } = useAuth();
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
  const detailedHistory = useMemo<KotsaDetailedHistory>(
    () =>
      apiDisplay?.detailedHistory ?? {
        inspection: [],
        maintenance: [],
        performance: [],
      },
    [apiDisplay?.detailedHistory],
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
  const closeHistoryDetail = useCallback(() => {
    setActiveHistoryDetail(null);
  }, []);
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
    if (!activeHistoryDetail) {
      return;
    }

    window.history.pushState({ carfactHistoryDetail: activeHistoryDetail }, "", window.location.href);
    const handlePopState = () => {
      setActiveHistoryDetail(null);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeHistoryDetail]);

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
        setShowCommercialIneligibleModal(false);
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
            setApiDisplay(null);
            setApiVehicle(null);
            setAutoMatchingState(createMissingAutoMatchingState(carNumber));
            setShowAutoMatching(true);
            setShowCommercialIneligibleModal(false);
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

  useEffect(() => {
    let isActive = true;
    const shouldCheckDealerPermission =
      commercialPlateCheckState === "ineligible" ||
      (isAuthenticated && !hasVehicleInfo);

    if (!shouldCheckDealerPermission) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setDealerRegistrationPermission({
            canRegister: false,
            isLoading: true,
            isVerifiedDealer: false,
            role: "user",
          });
        }
      });
      return () => {
        isActive = false;
      };
    }

    if (!isAuthReady || !isProfileReady) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setDealerRegistrationPermission({
            canRegister: false,
            isLoading: true,
            isVerifiedDealer: false,
            role: "user",
          });
        }
      });
      return () => {
        isActive = false;
      };
    }

    const accessToken = session?.access_token;

    if (!accessToken) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setDealerRegistrationPermission({
            canRegister: false,
            isLoading: false,
            isVerifiedDealer: false,
            role: "anonymous",
          });
        }
      });
      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (isActive) {
        setDealerRegistrationPermission({
          canRegister: false,
          isLoading: true,
          isVerifiedDealer: false,
          role: "user",
        });
      }
    });

    fetch("/api/dealer/vehicle-registration", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              canRegister?: boolean;
              isVerifiedDealer?: boolean;
              ok?: boolean;
              role?: string;
            }
          | null;

        if (!isActive) return;

        const isVerifiedDealer =
          Boolean(response.ok && payload?.ok && payload.isVerifiedDealer === true);
        const canRegister =
          Boolean(response.ok && payload?.ok && payload.canRegister === true) &&
          isVerifiedDealer;

        setDealerRegistrationPermission({
          canRegister,
          isLoading: false,
          isVerifiedDealer,
          role: typeof payload?.role === "string" ? payload.role : "user",
        });
      })
      .catch(() => {
        if (isActive) {
          setDealerRegistrationPermission({
            canRegister: false,
            isLoading: false,
            isVerifiedDealer: false,
            role: "user",
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    commercialPlateCheckState,
    hasVehicleInfo,
    isAuthReady,
    isAuthenticated,
    isProfileReady,
    session?.access_token,
  ]);

  const kakaoLoginFromCurrentPage = () => {
    void signInWithKakao(window.location.href);
  };

  const googleLoginFromCurrentPage = () => {
    void signInWithGoogle(window.location.href);
  };

  const completeAutoMatching = useCallback(() => {
    setShowAutoMatching(false);
  }, []);

  const completeIneligibleAutoMatching = useCallback(() => {
    setShowAutoMatching(false);
    setShowCommercialIneligibleModal(true);
  }, []);

  const resetReportToHome = useCallback(() => {
    setApiVehicle(null);
    setAutoMatchingState(null);
    setCommercialPlateCheckError("");
    setCommercialPlateCheckState("checking");
    setShowCommercialIneligibleModal(false);
    setShowAutoMatching(false);
    router.replace("/");
  }, [router]);

  const goToDealerRegistration = useCallback(() => {
    if (!dealerRegistrationPermission.canRegister) {
      return;
    }

    window.sessionStorage.setItem(
      "carfact_dealer_registration_intent",
      String(Date.now()),
    );
    router.push(`/car/${encodeURIComponent(carNumber)}/setup`);
  }, [carNumber, dealerRegistrationPermission.canRegister, router]);

  useEffect(() => {
    if (!showCommercialIneligibleModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetReportToHome();
      }
    };

    const handlePopState = () => {
      resetReportToHome();
    };

    window.history.pushState({ carfactCommercialModal: true }, "", window.location.href);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [resetReportToHome, showCommercialIneligibleModal]);

  const retryCommercialPlateCheck = useCallback(() => {
    if (commercialPlateCheckState !== "error") {
      return;
    }

    setApiVehicle(null);
    setAutoMatchingState(null);
    setCommercialPlateCheckError("");
    setCommercialPlateCheckState("checking");
    setShowCommercialIneligibleModal(false);
    setShowAutoMatching(false);
    setCommercialPlateRetryCount((count) => count + 1);
  }, [commercialPlateCheckState]);

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
    if (!hasVehicleInfo) {
      return (
        <main className={pageClassName}>
          <div className={shellClassName}>
            <VehicleUnavailableGuide
              onHome={() => router.replace("/")}
              onLookup={() => router.replace("/")}
            />
          </div>
        </main>
      );
    }

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
    const modalReady =
      showCommercialIneligibleModal && !dealerRegistrationPermission.isLoading;

    return (
      <>
        <AutoMatchingPanel
          onComplete={completeIneligibleAutoMatching}
          onSelectCandidate={selectAutoMatchingCandidate}
          state={autoMatchingState ?? createMissingAutoMatchingState(carNumber)}
        />
        <CommercialIneligibleModal
          canRegister={
            dealerRegistrationPermission.isVerifiedDealer === true &&
            dealerRegistrationPermission.canRegister === true
          }
          isOpen={modalReady}
          onGoHome={resetReportToHome}
          onRegister={goToDealerRegistration}
        />
      </>
    );
  }

  if (commercialPlateCheckState === "error") {
    return (
      <main className={pageClassName}>
        <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center">
          <section className="w-full rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-red-950/20 sm:p-10">
            <p className="text-xs font-black tracking-[0.16em] text-red-400">
              CARFACT CHECK
            </p>
            <h1 className="mt-3 text-[23px] font-black leading-tight sm:text-3xl">
              차량 확인 중 오류가 발생했습니다
            </h1>
            <p className="mt-4 text-[15px] font-semibold leading-6 text-zinc-300 sm:text-base">
              일시적으로 차량정보를 확인하지 못했습니다. 잠시 후 다시 시도해
              주세요.
            </p>
            <p className="mt-3 whitespace-pre-line text-xs leading-5 text-zinc-600">
              {commercialPlateCheckError}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={retryCommercialPlateCheck}
                className="min-w-36 flex-1 rounded-xl bg-red-500 px-6 py-4 text-sm font-black transition hover:bg-red-600 active:scale-[0.98]"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={resetReportToHome}
                className="min-w-36 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-6 py-4 text-sm font-black transition hover:bg-zinc-800 active:scale-[0.98]"
              >
                홈으로 돌아가기
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

  const mileageLabel = formatMileageLabel(mileage);
  const hasMileage = Boolean(mileageLabel);
  const mileageNotice =
    "현재 주행거리는 국토교통부 자동차정보 데이터를 기반으로 제공되며, 최종 수집 시점 이후 실제 주행거리와 차이가 있을 수 있습니다.";
  const vehicleInfoCells = [
    {
      className: "order-1",
      label: "세대·차종",
      value: generation,
    },
    {
      className: "order-2",
      label: "연식",
      value: year ? `${year}년식` : "",
    },
    {
      className: "order-3",
      label: "연료",
      value: fuelType,
    },
    {
      className: "order-4 col-span-3 sm:col-span-1",
      label: "현재 주행거리",
      notice: hasMileage ? mileageNotice : "",
      value: mileageLabel,
    },
  ];

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
            dealerRegistrationPermission.isLoading ? (
              <p className="text-sm text-zinc-400" aria-live="polite">
                차량정보 등록 권한을 확인하고 있습니다.
              </p>
            ) : dealerRegistrationPermission.isVerifiedDealer === true &&
              dealerRegistrationPermission.canRegister === true ? (
              <DealerVehicleRegistrationGuide
                onHome={resetReportToHome}
                onRegister={goToDealerRegistration}
              />
            ) : (
              <VehicleUnavailableGuide
                onHome={resetReportToHome}
                onLookup={resetReportToHome}
              />
            )
          ) : (
            <>
              <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-black/45 sm:mb-10">
                <div className="border-b border-white/10 px-4 py-4 sm:px-7 sm:py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black tracking-[0.18em] text-red-400 sm:text-xs">
                        CARFACT VEHICLE DATA
                      </p>
                      <p className="mt-2 max-w-full truncate text-[14px] font-semibold leading-[1.2] text-zinc-400 sm:text-[15px]">
                        {brand || "제조사 정보 없음"}
                      </p>
                      <h2 className="mt-1 max-w-full text-[22px] font-[750] leading-[1.2] tracking-tight text-white sm:text-[26px]">
                        {model || "조회 차량"}
                      </h2>
                      <p className="mt-1.5 text-xs font-semibold text-zinc-500 sm:text-sm">
                        공공데이터에서 확인된 항목만 표시합니다.
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                      조회 완료
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-white/10 sm:grid-cols-[1fr_1fr_1fr_1.35fr]">
                  {vehicleInfoCells.map((cell) => (
                    <div
                      key={cell.label}
                      className={cn(
                        "min-h-[74px] bg-zinc-950 px-3 py-3 sm:min-h-[82px] sm:px-5 sm:py-4",
                        cell.label === "현재 주행거리" &&
                          "min-h-[112px] px-4 py-4 sm:min-h-[82px] sm:px-5 sm:py-4",
                        cell.className,
                      )}
                    >
                      <p className="text-[12px] font-semibold text-zinc-500 sm:text-xs">
                        {cell.label}
                      </p>
                      <p
                        className={cn(
                          "mt-2 truncate text-[17px] font-bold leading-tight text-white sm:text-[18px]",
                          cell.label === "현재 주행거리" &&
                            "text-[22px] font-[750] sm:text-[22px]",
                        )}
                      >
                        {cell.value || "제공 정보 없음"}
                      </p>
                      {"notice" in cell && cell.notice ? (
                        <p className="mt-2 text-[11px] font-medium leading-[1.45] text-white/60 sm:hidden">
                          {cell.notice}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {hasMileage ? (
                  <p className="hidden border-t border-white/10 bg-zinc-950 px-5 py-3 text-[12px] font-medium leading-[1.45] text-white/55 sm:block">
                    ⓘ {mileageNotice}
                  </p>
                ) : null}

                <div className="border-t border-white/10 px-4 py-5 sm:px-7 sm:py-6">
                  <div className="mb-4">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.16em] text-red-400 sm:text-xs">
                        HISTORY &amp; INSPECTION
                      </p>
                      <h3 className="mt-1.5 text-[22px] font-black leading-tight sm:text-[24px]">
                        정비·성능정보
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-zinc-500">
                      관계기관 제공 기준
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                    <HistoryCountCard
                      count={detailedHistory.maintenance.length}
                      disabled={detailedHistory.maintenance.length === 0}
                      label="정비이력"
                      onClick={() => setActiveHistoryDetail("maintenance")}
                    />
                    <HistoryCountCard
                      count={detailedHistory.performance.length}
                      disabled={detailedHistory.performance.length === 0}
                      label="성능점검 이력"
                      onClick={() => setActiveHistoryDetail("performance")}
                    />
                    <HistoryCountCard
                      count={detailedHistory.inspection.length}
                      disabled
                      label="검사이력"
                    />
                  </div>
                  <p className="mt-5 text-xs leading-5 text-zinc-600">
                    {historyDisclaimer}
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
      {activeHistoryDetail ? (
        <HistoryDetailPanel
          detailedHistory={detailedHistory}
          onClose={closeHistoryDetail}
          type={activeHistoryDetail}
        />
      ) : null}
    </main>
  );
}
