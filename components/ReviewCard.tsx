import type { Review } from "@/types/review";
import { cn } from "@/utils/cn";

interface ReviewCardProps {
  review: Review;
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

export function ReviewCard({ review }: ReviewCardProps) {
  const authorNickname = review.authorNickname || "익명 사용자";
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
    </div>
  );
}
