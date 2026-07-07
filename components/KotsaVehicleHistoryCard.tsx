"use client";

import type { KotsaVehicleDisplayInfo } from "@/types/kotsa";

interface KotsaVehicleHistoryCardProps {
  display: KotsaVehicleDisplayInfo | null;
  isLoading?: boolean;
  message?: string;
}

const formatNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue.toLocaleString() : String(value);
};

const toScrappedLabel = (value: boolean | null | undefined) => {
  if (value === true) {
    return "폐차";
  }

  if (value === false) {
    return "정상";
  }

  return null;
};

export function KotsaVehicleHistoryCard({
  display,
  isLoading = false,
  message,
}: KotsaVehicleHistoryCardProps) {
  const items = [
    ["차명", display?.carName],
    ["차종", display?.vehicleType],
    ["용도", display?.usage],
    ["최초등록일", display?.firstRegistrationDate],
    ["연식", display?.year ? `${display.year}년` : null],
    ["연료", display?.fuelType],
    [
      "최근 성능기록부 주행거리",
      display?.latestPerformanceMileage
        ? `${formatNumber(display.latestPerformanceMileage)}km`
        : null,
    ],
    [
      "정비횟수",
      display?.maintenanceHistoryCount !== null &&
      display?.maintenanceHistoryCount !== undefined
        ? `${display.maintenanceHistoryCount}회`
        : null,
    ],
    [
      "성능점검횟수",
      display?.performanceCheckCount !== null &&
      display?.performanceCheckCount !== undefined
        ? `${display.performanceCheckCount}회`
        : null,
    ],
    [
      "검사이력 수",
      display ? `${display.inspectionHistoryCount.toLocaleString()}건` : null,
    ],
    ["폐차여부", toScrappedLabel(display?.scrapped)],
  ];
  const hasPerformanceRecord =
    Boolean(display?.performanceCheckCount) ||
    Boolean(display?.latestPerformanceMileage);

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-red-400">
            KOTSA
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">KOTSA 차량정보</h2>
        </div>
        {hasPerformanceRecord ? (
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-200"
            onClick={() => {
              window.alert("성능기록부 원본 열람은 공단 정책 확인 후 연결됩니다.");
            }}
          >
            성능기록부 열람하기
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-zinc-400">KOTSA 정보를 확인하고 있습니다.</p>
      ) : message ? (
        <p className="mt-4 text-sm leading-6 text-zinc-400">{message}</p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-900 p-3">
              <dt className="text-xs font-bold text-zinc-500">{label}</dt>
              <dd className="mt-1 text-sm font-bold text-zinc-100">
                {value || "확인 필요"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
