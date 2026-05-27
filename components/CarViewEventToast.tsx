"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/utils/cn";

interface CarViewEventToastProps {
  carNumber: string;
  className?: string;
}

interface CarViewStat {
  sevenDayViewCount: number;
}

const carViewStatsStorageKey = "carViewStats";
const minViewCount = 3;
const maxViewCount = 48;
const fadeOutDelayMs = 10000;
const removeDelayMs = 10500;

const toastClassName = cn(
  "relative z-[9999] mb-5 w-full max-w-2xl rounded-xl border border-white/10",
  "bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 shadow-lg shadow-black/25",
  "backdrop-blur transition-all duration-500 ease-out",
  "sm:inline-flex sm:w-auto sm:items-center"
);

const hiddenToastClassName = cn("-translate-y-1 opacity-0");
const visibleToastClassName = cn("translate-y-0 opacity-100");

const normalizeCarNumber = (carNumber: string) =>
  carNumber.trim().replace(/\s+/g, "").toUpperCase();

const getMockViewCount = (carNumber: string) => {
  const normalizedCarNumber = normalizeCarNumber(carNumber);
  const hash = Array.from(normalizedCarNumber).reduce(
    (value, character) =>
      (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261
  );
  const countRange = maxViewCount - minViewCount + 1;

  return minViewCount + (hash % countRange);
};

const parseStoredStats = (value: string | null): Record<string, CarViewStat> => {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, CarViewStat>;
  } catch {
    return {};
  }
};

const getStoredViewCount = (carNumber: string) => {
  const normalizedCarNumber = normalizeCarNumber(carNumber);
  const storedStats = parseStoredStats(
    localStorage.getItem(carViewStatsStorageKey)
  );
  const storedCount = storedStats[normalizedCarNumber]?.sevenDayViewCount;

  if (typeof storedCount === "number") {
    return storedCount;
  }

  const sevenDayViewCount = getMockViewCount(normalizedCarNumber);

  try {
    localStorage.setItem(
      carViewStatsStorageKey,
      JSON.stringify({
        ...storedStats,
        [normalizedCarNumber]: { sevenDayViewCount },
      })
    );
  } catch {
    return sevenDayViewCount;
  }

  return sevenDayViewCount;
};

const getToastMessage = (viewCount: number) => {
  if (viewCount <= 5) {
    return "최근 이 차량을 찾는 사람이 조금씩 늘고 있어요 👀";
  }

  if (viewCount <= 9) {
    return (
      <>
        최근 7일간{" "}
        <strong className="font-semibold text-white">{viewCount}명</strong>이 이
        차량 후기를 확인했어요 👀
      </>
    );
  }

  return (
    <>
      최근 7일간{" "}
      <strong className="font-semibold text-white">{viewCount}명</strong>이 이
      차량 이야기를 확인하고 있어요 🔥
    </>
  );
};

export function CarViewEventToast({
  carNumber,
  className,
}: CarViewEventToastProps) {
  const [viewCount, setViewCount] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const normalizedCarNumber = useMemo(
    () => normalizeCarNumber(carNumber),
    [carNumber]
  );

  useEffect(() => {
    if (!normalizedCarNumber) {
      return;
    }

    const showTimer = window.setTimeout(() => {
      try {
        setViewCount(getStoredViewCount(normalizedCarNumber));
      } catch {
        setViewCount(getMockViewCount(normalizedCarNumber));
      }

      setIsVisible(true);
    }, 0);

    const fadeOutTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, fadeOutDelayMs);
    const removeTimer = window.setTimeout(() => {
      setViewCount(null);
    }, removeDelayMs);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(fadeOutTimer);
      window.clearTimeout(removeTimer);
    };
  }, [normalizedCarNumber]);

  if (viewCount === null) {
    return null;
  }

  const toastMessage = getToastMessage(viewCount);

  return (
    <div
      aria-live="polite"
      className={cn(
        toastClassName,
        isVisible ? visibleToastClassName : hiddenToastClassName,
        className
      )}
    >
      <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]" />
      <span>{toastMessage}</span>
    </div>
  );
}
