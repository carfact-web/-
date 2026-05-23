"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getReviewStorageKey, reviewsChangeEventName } from "@/hooks/useReviews";
import { getVehicleStorageKey } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn(
  "min-h-screen bg-[#08090b] px-4 py-5 text-white sm:px-6 sm:py-8"
);
const shellClassName = cn("mx-auto flex w-full max-w-3xl flex-col gap-8");
const headerClassName = cn(
  "flex items-center justify-between border-b border-zinc-800/80 pb-4"
);
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-base text-white outline-none transition",
  "placeholder:text-zinc-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
);
const primaryButtonClassName = cn(
  "mt-3 w-full rounded-lg bg-red-600 px-4 py-4 text-base font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.99]"
);
const recentSectionClassName = cn("max-w-3xl");
const recentListClassName = cn("space-y-3");
const recentCardClassName = cn(
  "block rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition",
  "hover:border-zinc-700 hover:bg-zinc-900"
);
const recentMetaClassName = cn(
  "mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500"
);

interface RecentFact {
  id: number;
  carNumber: string;
  vehicle: Vehicle | null;
  content: string;
  createdAt: string;
}

const recentReviewsSnapshotEventName = "recent-reviews-snapshot";
const reviewStorageKeyPrefix = getReviewStorageKey("");

const parseJson = <T,>(json: string | null): T | null => {
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
};

const subscribeToRecentReviews = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(reviewsChangeEventName, onStoreChange);
  window.addEventListener(recentReviewsSnapshotEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(reviewsChangeEventName, onStoreChange);
    window.removeEventListener(recentReviewsSnapshotEventName, onStoreChange);
  };
};

const getRecentReviewsSnapshot = () => {
  const reviewsByCar: Record<string, string | null> = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (key?.startsWith(reviewStorageKeyPrefix)) {
      reviewsByCar[key] = localStorage.getItem(key);
    }
  }

  return JSON.stringify(reviewsByCar);
};

const getServerRecentReviewsSnapshot = () => "{}";

const getRecentFacts = (snapshot: string): RecentFact[] => {
  const reviewsByCar = parseJson<Record<string, string | null>>(snapshot) ?? {};

  return Object.entries(reviewsByCar)
    .flatMap(([storageKey, reviewsJson]) => {
      const carNumber = storageKey.slice(reviewStorageKeyPrefix.length);
      const reviews = parseJson<Review[]>(reviewsJson) ?? [];
      const savedVehicle = parseJson<Vehicle>(
        localStorage.getItem(getVehicleStorageKey(carNumber))
      );

      return reviews.map((review) => ({
        id: review.id,
        carNumber,
        vehicle: review.vehicleSnapshot ?? savedVehicle,
        content: review.content,
        createdAt: review.createdAt,
      }));
    })
    .sort((left, right) => right.id - left.id)
    .slice(0, 5);
};

const hasCompleteVehicleInfo = (vehicleJson: string | null) => {
  if (!vehicleJson) {
    return false;
  }

  try {
    const vehicle = JSON.parse(vehicleJson) as Vehicle;

    return Boolean(
      vehicle.plateNumber &&
        vehicle.brand &&
        vehicle.model &&
        vehicle.generation &&
        vehicle.year
    );
  } catch {
    return false;
  }
};

export default function Home() {
  const [carNumber, setCarNumber] = useState("");
  const recentReviewsSnapshot = useSyncExternalStore(
    subscribeToRecentReviews,
    getRecentReviewsSnapshot,
    getServerRecentReviewsSnapshot
  );
  const recentFacts = getRecentFacts(recentReviewsSnapshot);

  const goToReport = () => {
    const value = carNumber.trim();

    if (!value) {
      alert("차량번호를 입력해주세요.");
      return;
    }

    const encodedValue = encodeURIComponent(value);
    const vehicle = localStorage.getItem(getVehicleStorageKey(value));

    window.location.href = hasCompleteVehicleInfo(vehicle)
      ? `/car/${encodedValue}`
      : `/car/${encodedValue}/setup`;
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className={headerClassName}>
          <div>
            <p className="text-xs font-semibold text-red-500">
              차주가 알려주지 않는 이야기
            </p>
            <h1 className="mt-1 text-2xl font-black text-white">카플래닛</h1>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-400">
            CarPlanet
          </span>
        </header>

        <section className="pt-3">
          <p className="text-3xl font-black leading-tight text-white sm:text-5xl">
            좋은 차는 이유가 있고,
            <br />
            안 좋은 차도 이유가 있습니다.
          </p>

          <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base">
            차량번호로 실제 차주들의 이야기를 확인하세요.
          </p>
        </section>

        <div className={panelClassName}>
          <input
            value={carNumber}
            onChange={(e) => setCarNumber(e.target.value)}
            type="text"
            placeholder="예) 123가4567"
            className={inputClassName}
          />

          <button
            type="button"
            onClick={goToReport}
            className={primaryButtonClassName}
          >
            차량 이야기 보기
          </button>
        </div>

        <section className={recentSectionClassName}>
          <div className="mb-3">
            <h2 className="text-xl font-black text-white">
              최근 등록된 차량 이야기
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              최근 작성된 후기를 최신순으로 보여드립니다.
            </p>
          </div>

          {recentFacts.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
              아직 등록된 차량 이야기가 없습니다.
            </div>
          ) : (
            <div className={recentListClassName}>
              {recentFacts.map((fact) => {
                const vehicleTitle = fact.vehicle
                  ? [fact.vehicle.brand, fact.vehicle.model]
                      .filter(Boolean)
                      .join(" ")
                  : fact.carNumber;
                const generation = fact.vehicle?.generation || "세대 정보 없음";
                const mileage = fact.vehicle?.mileage
                  ? `${Number(fact.vehicle.mileage).toLocaleString()}km`
                  : "주행거리 정보 없음";

                return (
                  <Link
                    key={`${fact.carNumber}-${fact.id}`}
                    href={`/car/${encodeURIComponent(fact.carNumber)}`}
                    className={recentCardClassName}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-zinc-100">
                          {vehicleTitle}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {generation}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300">
                        이야기
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-300">
                      {fact.content}
                    </p>

                    <div className={recentMetaClassName}>
                      <span>{mileage}</span>
                      {fact.createdAt && <span aria-hidden>·</span>}
                      {fact.createdAt && <span>{fact.createdAt}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
