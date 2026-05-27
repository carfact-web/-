"use client";

import Image from "next/image";
import { useMemo, useSyncExternalStore } from "react";
import type { Review } from "@/types/review";
import { cn } from "@/utils/cn";
import {
  addHelpfulVote,
  getHelpfulSnapshot,
  getServerHelpfulSnapshot,
  parseHelpfulJson,
  subscribeToHelpfulChanges,
  type HelpfulSnapshot,
} from "@/utils/reviewHelpful";

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
const imageGridClassName = cn("mb-4 grid grid-cols-3 gap-2 sm:max-w-sm");
const imageThumbnailClassName = cn(
  "relative aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
);
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
    () => parseHelpfulJson<HelpfulSnapshot>(helpfulSnapshotJson, {
      count: initialHelpfulCount,
      isVoted: false,
    }),
    [helpfulSnapshotJson, initialHelpfulCount]
  );
  const vehicleSnapshot = review.vehicleSnapshot;
  const reviewImages = review.images ?? [];
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

    addHelpfulVote(storageKey, initialHelpfulCount);
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

      {reviewImages.length > 0 && (
        <div className={imageGridClassName}>
          {reviewImages.map((image) => (
            <div key={image.id} className={imageThumbnailClassName}>
              <Image
                src={image.dataUrl}
                alt={image.name}
                fill
                unoptimized
                sizes="120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

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
