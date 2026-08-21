"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRecentViews } from "@/hooks/useRecentViews";
import { cn } from "@/utils/cn";
import { getVehicleDisplayName } from "@/utils/vehicleDisplayName";

const pageClassName = cn("min-h-screen bg-black px-4 pt-8 pb-28 text-white sm:px-6 sm:pt-10");
const shellClassName = cn("mx-auto max-w-3xl space-y-6");
const headerClassName = cn("flex flex-col gap-3");
const badgeClassName = cn(
  "inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300"
);
const panelClassName = cn(
  "rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl shadow-black/20"
);
const cardClassName = cn(
  "group flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 transition hover:border-zinc-700 hover:bg-zinc-800/80"
);
const cardTitleClassName = cn("text-lg font-bold text-white");
const cardSubClassName = cn("text-sm text-zinc-400");
const listClassName = cn("space-y-4");
const buttonGroupClassName = cn("flex flex-wrap items-center gap-3");
const clearButtonClassName = cn(
  "rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition",
  "hover:bg-zinc-700 disabled:bg-zinc-800/60"
);
const removeButtonClassName = cn(
  "rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition",
  "hover:bg-red-500"
);

const getVehicleSnapshotLabel = (vehicleSnapshot?: {
  brand?: string;
  model?: string;
  generation?: string;
  year?: string;
  fuelType?: string;
  mileage?: string;
}) => {
  if (!vehicleSnapshot) {
    return "차량 정보 없음";
  }

  return [
    getVehicleDisplayName(vehicleSnapshot),
    vehicleSnapshot.year && `${vehicleSnapshot.year}년`,
    vehicleSnapshot.fuelType,
    vehicleSnapshot.mileage && `${Number(vehicleSnapshot.mileage).toLocaleString()}km`,
  ]
    .filter(Boolean)
    .join(" · ");
};

export default function RecentPage() {
  const { recentViews, removeRecentView, clearRecentViews } = useRecentViews();

  const sortedRecentViews = useMemo(
    () => [...recentViews].sort((left, right) => {
      return (
        Date.parse(right.lastViewedAt) - Date.parse(left.lastViewedAt)
      );
    }),
    [recentViews]
  );

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <section className={headerClassName}>
          <div>
            <p className="text-xs font-semibold text-red-500">최근 조회</p>
            <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">
              최근에 본 차량
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              최근 조회 순으로 차량번호를 보여줍니다. 개별 삭제 또는 전체 삭제가 가능합니다.
            </p>
          </div>

          <div className={buttonGroupClassName}>
            <button
              type="button"
              className={clearButtonClassName}
              onClick={clearRecentViews}
              disabled={recentViews.length === 0}
            >
              전체 삭제
            </button>
          </div>
        </section>

        {sortedRecentViews.length === 0 ? (
          <div className={panelClassName}>
            <p className="text-sm text-zinc-400">
              최근 조회 기록이 없습니다. 차량 상세, 후기, 리포트 페이지를 방문하면 자동 저장됩니다.
            </p>
          </div>
        ) : (
          <div className={listClassName}>
            {sortedRecentViews.map((view) => (
              <div key={view.carNumber} className={cardClassName}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className={cardTitleClassName}>{view.title}</p>
                    <p className={cardSubClassName}>{view.carNumber}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={badgeClassName}>
                      {new Date(view.lastViewedAt).toLocaleString("ko-KR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <button
                      type="button"
                      className={removeButtonClassName}
                      onClick={() => removeRecentView(view.carNumber)}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <p className={cardSubClassName}>
                  {getVehicleSnapshotLabel(view.vehicleSnapshot)}
                </p>

                <Link
                  href={`/car/${encodeURIComponent(view.carNumber)}`}
                  className="inline-flex rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  상세 보기
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
