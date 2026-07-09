"use client";

import { useMemo, useState } from "react";
import { KotsaLoginRequiredModal } from "@/components/KotsaLoginRequiredModal";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  isValidCommercialPlateNumber,
  normalizeCommercialPlateNumber,
} from "@/utils/vehiclePlateValidation";
import type { FormEvent } from "react";
import type { KotsaVehicleHistory } from "@/types/kotsa";

const pageClassName = cn("min-h-screen bg-black px-4 py-8 text-white sm:px-6");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-amber-400/20 bg-[linear-gradient(180deg,#11100a_0%,#080806_100%)] p-4 shadow-2xl shadow-black/20 sm:p-5",
);
const inputClassName = cn(
  "commercial-plate-number-input",
);
const primaryButtonClassName = cn(
  "mt-3 w-full rounded-lg px-4 py-4 text-base font-bold text-white transition",
  "bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-[0.99]",
  "disabled:cursor-not-allowed disabled:bg-[#3A3A3A] disabled:hover:bg-[#3A3A3A] disabled:active:scale-100",
);
const formMessageClassName = cn(
  "mt-2 px-1 text-xs font-semibold text-amber-300",
);

interface CommercialPlateResponse {
  businessVehicle?: boolean;
  cached?: boolean;
  code?: string;
  data?: KotsaVehicleHistory;
  error?: string;
  ok: boolean;
  requestId?: string;
}

const formatCount = (value: number | null | undefined) =>
  value === null || value === undefined ? "확인 필요" : `${value.toLocaleString()}회`;

const formatYn = (value: boolean | null | undefined) => {
  if (value === true) {
    return "예";
  }

  if (value === false) {
    return "아니오";
  }

  return "확인 필요";
};

const formatRiskCount = (value: number | null | undefined) =>
  value === null || value === undefined ? "확인 필요" : `${value.toLocaleString()}건`;

const getBusinessStatus = (data: KotsaVehicleHistory | null) => {
  const raw = data?.raw;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const first = Array.isArray((raw as { data?: unknown }).data)
    ? (raw as { data: unknown[] }).data[0]
    : null;

  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return null;
  }

  const value = (first as Record<string, unknown>).prcsImprtyRsnDtls;

  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getRuleInsights = (
  data: KotsaVehicleHistory | null,
  businessStatus: string | null,
) => {
  if (!data) {
    return [];
  }

  const insights: string[] = [];
  const inspectionCount = data.inspectionRecords.length;
  const maintenanceCount = data.maintenanceHistoryCount ?? 0;
  const performanceCount = data.performanceCheckCount ?? 0;
  const overdueTaxCount = data.overdueTaxCount ?? 0;
  const seizureCount = data.seizureCount ?? 0;
  const mortgageCount = data.mortgageCount ?? 0;

  if (businessStatus?.includes("운행")) {
    insights.push("영업용 차량으로 정상 운행 중입니다.");
  } else if (businessStatus) {
    insights.push(`공단 업무상태는 ${businessStatus}입니다.`);
  }

  if (inspectionCount >= 2) {
    insights.push("검사이력이 많은 차량입니다.");
  } else if (inspectionCount > 0) {
    insights.push("검사이력이 확인됩니다.");
  }

  if (data.usage) {
    insights.push("영업 특성상 운행거리가 많았을 가능성이 있습니다.");
  }

  if (performanceCount >= 2) {
    insights.push("성능점검 이력이 다수 존재합니다.");
  } else if (performanceCount === 1) {
    insights.push("성능점검 이력이 확인됩니다.");
  }

  if (maintenanceCount > 0) {
    insights.push("정비 이력이 확인됩니다.");
  }

  if (overdueTaxCount === 0 && seizureCount === 0 && mortgageCount === 0) {
    insights.push("체납, 압류 및 저당 이력이 없습니다.");
  } else {
    insights.push("체납, 압류 또는 저당 이력은 상세 확인이 필요합니다.");
  }

  if (data.scrapped === false) {
    insights.push("폐차 차량은 아닙니다.");
  } else if (data.scrapped === true) {
    insights.push("폐차 이력이 확인됩니다.");
  }

  if (data.insuranceActive === true) {
    insights.push("의무보험 가입 상태가 확인됩니다.");
  } else if (data.insuranceActive === false) {
    insights.push("의무보험 가입 여부는 추가 확인이 필요합니다.");
  }

  return insights.slice(0, 6);
};

export default function CommercialPlatePage() {
  const [plateNumber, setPlateNumber] = useState("");
  const [result, setResult] = useState<KotsaVehicleHistory | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { isAuthReady, isAuthenticated, session } = useAuth();
  const normalizedPlateNumber = normalizeCommercialPlateNumber(plateNumber);
  const hasPlateInput = normalizedPlateNumber.length > 0;
  const isPlateValid = isValidCommercialPlateNumber(normalizedPlateNumber);
  const showValidationError = hasPlateInput && !isPlateValid;
  const loginRedirectTo = normalizedPlateNumber
    ? `/commercial-plate?plateNumber=${encodeURIComponent(normalizedPlateNumber)}`
    : "/commercial-plate";
  const businessStatus = useMemo(() => getBusinessStatus(result), [result]);
  const hasResult = Boolean(result?.carName || result?.usage || result?.vehicleType);

  const lookupCommercialPlate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isPlateValid || isLoading || !isAuthReady) {
      return;
    }

    if (!isAuthenticated || !session?.access_token) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsLoading(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/kotsa/commercial-plate", {
        body: JSON.stringify({ vehicleNumber: normalizedPlateNumber }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: "조회 정보를 불러오지 못했습니다.",
      }))) as CommercialPlateResponse;

      if (response.status === 401 || payload.code === "LOGIN_REQUIRED") {
        setIsLoginModalOpen(true);
        return;
      }

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "조회 정보를 불러오지 못했습니다.");
        return;
      }

      if (!payload.businessVehicle || !payload.data) {
        setMessage(
          "영업용 차량 정보를 확인하지 못했습니다.\n\n가능한 원인\n\n• 일반 번호판 차량\n• 지역명이 누락된 번호판\n• 조회 대상이 아닌 차량\n• 공단 데이터 미반영\n\n지역명이 있는 번호판은\n서울38아8000처럼\n지역명을 포함하여 입력해주세요.",
        );
        return;
      }

      setResult(payload.data);
    } catch {
      setMessage("조회 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const ruleInsights = getRuleInsights(result, businessStatus);
  const summaryItems = [
    ["운행상태", businessStatus ?? "운행 정보 확인 필요"],
    ["차명", result?.carName],
    ["차종", result?.vehicleType],
    ["용도", result?.usage],
    ["최초등록일", result?.firstRegistrationDate],
    ["검사이력", result ? `${result.inspectionRecords.length.toLocaleString()}건` : null],
    ["정비횟수", formatCount(result?.maintenanceHistoryCount)],
    ["성능점검횟수", formatCount(result?.performanceCheckCount)],
    ["체납건수", formatRiskCount(result?.overdueTaxCount)],
    ["압류건수", formatRiskCount(result?.seizureCount)],
    ["저당건수", formatRiskCount(result?.mortgageCount)],
    ["의무보험 여부", formatYn(result?.insuranceActive)],
    ["폐차 여부", formatYn(result?.scrapped)],
  ];

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white">영업넘버 확인</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            영업용 번호판을 직접 입력하면 운행 여부와 기본 이력을 확인합니다.
          </p>
        </div>

        <form className={panelClassName} onSubmit={lookupCommercialPlate}>
          <div className="commercial-plate-input-frame">
            <input
              value={plateNumber}
              onChange={(event) => {
                setPlateNumber(sanitizeVehiclePlateNumber(event.target.value));
              }}
              type="text"
              placeholder="예) 서울38아8000"
              className={inputClassName}
              aria-invalid={showValidationError}
              aria-describedby={
                showValidationError ? "commercial-plate-validation" : undefined
              }
            />
          </div>

          <p className="mt-2 px-1 text-xs leading-5 text-zinc-500">
            예) 경기70바1234
            <br />
            지역명이 있는 번호판은 반드시 지역명까지 입력해주세요.
          </p>

          {showValidationError && (
            <p
              id="commercial-plate-validation"
              className={formMessageClassName}
              aria-live="polite"
            >
              영업용 번호판을 지역명 포함 또는 미포함 형태로 입력해주세요.
            </p>
          )}

          <button
            type="submit"
            className={primaryButtonClassName}
            disabled={!isPlateValid || isLoading || !isAuthReady}
          >
            {isLoading ? "확인 중..." : "영업넘버 확인"}
          </button>
        </form>

        {message ? (
          <section className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <p className="whitespace-pre-line text-sm leading-6 text-zinc-300">
              {message}
            </p>
          </section>
        ) : null}

        {hasResult ? (
          <section className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-amber-300">영업넘버</p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  영업넘버 정보
                </h2>
              </div>
              <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-300">
                24시간 보관
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {summaryItems.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-zinc-900 p-3">
                  <dt className="text-xs font-bold text-zinc-500">{label}</dt>
                  <dd className="mt-1 text-sm font-bold leading-6 text-zinc-100">
                    {value || "확인 필요"}
                  </dd>
                </div>
              ))}
            </dl>

            {ruleInsights.length ? (
              <section className="mt-5 rounded-lg border border-amber-400/20 bg-zinc-900 p-4">
                <p className="text-xs font-black text-amber-300">규칙 기반 해석</p>
                <h3 className="mt-1 text-lg font-black text-white">
                  영업넘버 해석
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  {ruleInsights.map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>

      <KotsaLoginRequiredModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        redirectTo={loginRedirectTo}
      />
    </main>
  );
}
