"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getReviewStorageKey, reviewsChangeEventName } from "@/hooks/useReviews";
import { getVehicleStorageKey } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const panelClassName = cn("max-w-2xl rounded-2xl bg-zinc-900 p-6");
const inputClassName = cn("w-full rounded-xl bg-zinc-800 p-4 text-white");
const primaryButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600 active:scale-95"
);
const recentSectionClassName = cn("mt-10 max-w-2xl");
const recentListClassName = cn("space-y-3");
const recentCardClassName = cn(
  "block rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition",
  "hover:border-zinc-700 hover:bg-zinc-800"
);
const recentMetaClassName = cn(
  "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"
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
      <h1 className="text-5xl font-bold mb-4">카팩트</h1>

      <p className="text-gray-400 text-xl mb-10">
        중고차 사진? 광고문구?
        <br />
        팩트로 판단하자.
      </p>

      <div className={panelClassName}>
        <input
          value={carNumber}
          onChange={(e) => setCarNumber(e.target.value)}
          type="text"
          placeholder="차량번호 입력 (예: 123가4567)"
          className={inputClassName}
        />

        <button
          type="button"
          onClick={goToReport}
          className={primaryButtonClassName}
        >
          차량 팩트 조회
        </button>
      </div>

      <section className={recentSectionClassName}>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">최근 등록된 팩트</h2>
            <p className="mt-1 text-sm text-gray-500">
              최근 작성된 차량 후기를 빠르게 확인해보세요.
            </p>
          </div>
        </div>

        {recentFacts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-gray-500">
            아직 등록된 팩트가 없습니다.
          </div>
        ) : (
          <div className={recentListClassName}>
            {recentFacts.map((fact) => {
              const vehicleTitle = fact.vehicle
                ? [fact.vehicle.brand, fact.vehicle.model].filter(Boolean).join(" ")
                : fact.carNumber;
              const generation = fact.vehicle?.generation;
              const mileage = fact.vehicle?.mileage
                ? `${Number(fact.vehicle.mileage).toLocaleString()}km`
                : "";

              return (
                <Link
                  key={`${fact.carNumber}-${fact.id}`}
                  href={`/car/${encodeURIComponent(fact.carNumber)}`}
                  className={recentCardClassName}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-gray-100">
                        {vehicleTitle}
                      </p>
                      {generation && (
                        <p className="mt-1 text-sm text-gray-400">
                          {generation}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-gray-400">
                      팩트
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-300">
                    {fact.content}
                  </p>

                  <div className={recentMetaClassName}>
                    {mileage && <span>{mileage}</span>}
                    {mileage && fact.createdAt && <span aria-hidden>·</span>}
                    {fact.createdAt && <span>{fact.createdAt}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
