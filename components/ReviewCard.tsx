"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Review } from "@/types/review";
import { cn } from "@/utils/cn";

interface ReviewCardProps {
  review: Review;
  reviewKey?: string;
}

const cardClassName = cn("rounded-xl bg-zinc-800 p-4");
const headerClassName = cn("mb-3 flex items-start justify-between gap-4");
const nicknameClassName = cn("text-sm font-bold text-gray-100");
const createdAtClassName = cn("shrink-0 text-xs text-gray-500");
const tagListClassName = cn("mb-3 flex flex-wrap gap-2");
const tagClassName = cn(
  "rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300",
  "ring-1 ring-red-500/25"
);
const contentClassName = cn("mb-4 whitespace-pre-wrap text-sm leading-6 text-gray-100");
const snapshotClassName = cn(
  "border-t border-zinc-700 pt-3 text-xs leading-5 text-gray-500"
);
const footerClassName = cn(
  "mt-4 flex items-center border-t border-zinc-700 pt-3"
);
const helpfulButtonClassName = cn(
  "inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-700 hover:text-white active:scale-[0.98]",
  "disabled:cursor-default disabled:border-zinc-700 disabled:bg-zinc-900/70 disabled:text-gray-500 disabled:hover:text-gray-500"
);

const helpfulCountsStorageKey = "reviewHelpfulCounts";
const helpfulVotesStorageKey = "reviewHelpfulVotes";
const helpfulChangeEventName = "review-helpful-change";

interface HelpfulSnapshot {
  count: number;
  isVoted: boolean;
}

const parseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getHelpfulSnapshot = (
  storageKey: string,
  initialCount: number
): HelpfulSnapshot => {
  const helpfulCounts = parseJson<Record<string, number>>(
    localStorage.getItem(helpfulCountsStorageKey),
    {}
  );
  const helpfulVotes = parseJson<Record<string, boolean>>(
    localStorage.getItem(helpfulVotesStorageKey),
    {}
  );

  return {
    count: helpfulCounts[storageKey] ?? initialCount,
    isVoted: Boolean(helpfulVotes[storageKey]),
  };
};

const getServerHelpfulSnapshot = (initialCount: number): HelpfulSnapshot => ({
  count: initialCount,
  isVoted: false,
});

const subscribeToHelpfulChanges = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(helpfulChangeEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(helpfulChangeEventName, onStoreChange);
  };
};

export function ReviewCard({ review, reviewKey }: ReviewCardProps) {
  const authorNickname = review.authorNickname || "익명 사용자";
  const storageKey = reviewKey ?? String(review.id);
  const initialHelpfulCount = review.helpfulCount ?? 0;
  const helpfulSnapshotJson = useSyncExternalStore(
    subscribeToHelpfulChanges,
    () => JSON.stringify(getHelpfulSnapshot(storageKey, initialHelpfulCount)),
    () => JSON.stringify(getServerHelpfulSnapshot(initialHelpfulCount))
  );
  const helpfulSnapshot = useMemo(
    () => parseJson<HelpfulSnapshot>(helpfulSnapshotJson, {
      count: initialHelpfulCount,
      isVoted: false,
    }),
    [helpfulSnapshotJson, initialHelpfulCount]
  );
  const vehicleSnapshot = review.vehicleSnapshot;
  const vehicleSnapshotText = vehicleSnapshot
    ? [
        vehicleSnapshot.brand,
        vehicleSnapshot.model,
        vehicleSnapshot.generation,
        vehicleSnapshot.year && `${vehicleSnapshot.year}년`,
        vehicleSnapshot.fuelType,
        vehicleSnapshot.mileage &&
          `${Number(vehicleSnapshot.mileage).toLocaleString()}km`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const addHelpful = () => {
    if (helpfulSnapshot.isVoted) {
      return;
    }

    const helpfulCounts = parseJson<Record<string, number>>(
      localStorage.getItem(helpfulCountsStorageKey),
      {}
    );
    const helpfulVotes = parseJson<Record<string, boolean>>(
      localStorage.getItem(helpfulVotesStorageKey),
      {}
    );

    localStorage.setItem(
      helpfulCountsStorageKey,
      JSON.stringify({
        ...helpfulCounts,
        [storageKey]: (helpfulCounts[storageKey] ?? initialHelpfulCount) + 1,
      })
    );
    localStorage.setItem(
      helpfulVotesStorageKey,
      JSON.stringify({
        ...helpfulVotes,
        [storageKey]: true,
      })
    );
    window.dispatchEvent(new Event(helpfulChangeEventName));
  };

  return (
    <div className={cardClassName}>
      <div className={headerClassName}>
        <p className={nicknameClassName}>{authorNickname}</p>
        <p className={createdAtClassName}>{review.createdAt}</p>
      </div>

      <div className={tagListClassName}>
        {(review.tags || []).map((tag) => (
          <span key={tag} className={tagClassName}>
            {tag}
          </span>
        ))}
      </div>

      <p className={contentClassName}>{review.content}</p>

      {vehicleSnapshotText && (
        <p className={snapshotClassName}>{vehicleSnapshotText}</p>
      )}

      <div className={footerClassName}>
        <button
          type="button"
          onClick={addHelpful}
          disabled={helpfulSnapshot.isVoted}
          className={helpfulButtonClassName}
          aria-pressed={helpfulSnapshot.isVoted}
        >
          {helpfulSnapshot.isVoted
            ? `도움됨 ✓ ${helpfulSnapshot.count}`
            : `👍 도움돼요 ${helpfulSnapshot.count}`}
        </button>
      </div>
    </div>
  );
}
