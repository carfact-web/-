"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AiSummaryCard } from "@/components/AiSummaryCard";
import { CarViewEventToast } from "@/components/CarViewEventToast";
import { ReviewCard } from "@/components/ReviewCard";
import { useReviews } from "@/hooks/useReviews";
import { useVehicle } from "@/hooks/useVehicle";
import { getAiSummary } from "@/utils/aiSummary";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  getHelpfulCountsSnapshot,
  getServerHelpfulCountsSnapshot,
  parseHelpfulJson,
  subscribeToHelpfulChanges,
} from "@/utils/reviewHelpful";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const panelClassName = cn("max-w-2xl rounded-2xl bg-zinc-900 p-6");
const homeButtonClassName = cn(
  "mb-8 inline-flex items-center rounded-lg bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-gray-200 transition",
  "hover:opacity-75"
);
const actionLinkClassName = cn(
  "block w-full rounded-xl bg-red-500 p-4 text-center font-bold transition",
  "hover:bg-red-600"
);
const editLinkClassName = cn(
  "mt-3 mb-6 block w-full rounded-xl bg-zinc-700 p-3 text-center text-sm font-bold transition",
  "hover:bg-zinc-600"
);
const timelineSectionClassName = cn("mb-8");
const timelineListClassName = cn("relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-zinc-700");
const timelineItemClassName = cn("relative pl-9");
const timelineDotClassName = cn("absolute top-2 left-1.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-red-500");
const timelineCardClassName = cn("rounded-xl border border-zinc-800 bg-zinc-800/70 p-4");
const timelineTagClassName = cn(
  "rounded-full bg-zinc-700 px-2.5 py-1 text-xs text-gray-300"
);
const reviewPaginationClassName = cn(
  "mb-8 flex flex-wrap items-center justify-center gap-2"
);
const reviewPageButtonClassName = cn(
  "rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-800 hover:text-white active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:bg-transparent disabled:hover:text-gray-300"
);
const activeReviewPageButtonClassName = cn(
  "border-red-500 bg-red-500 text-white hover:border-red-500 hover:bg-red-500"
);
const reviewHeaderClassName = cn(
  "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
);
const sortControlClassName = cn(
  "inline-flex rounded-lg border border-zinc-700 bg-zinc-950 p-1"
);
const sortButtonClassName = cn(
  "rounded-md px-3 py-2 text-sm font-semibold text-gray-400 transition",
  "hover:bg-zinc-800 hover:text-white active:scale-[0.98]"
);
const activeSortButtonClassName = cn("bg-red-500 text-white hover:bg-red-500");

type VehicleSnapshotWithCreatedAt = Vehicle & {
  createdAt?: string;
};

interface TimelineItem {
  review: Review;
  dateLabel: string;
  mileageLabel: string;
  snapshotLabel: string;
  sortTime: number;
}

const reviewsPerPage = 5;
type ReviewSortOption = "latest" | "helpful";

const getParsedTime = (dateLabel: string, fallbackTime: number) => {
  const parsedTime = Date.parse(dateLabel);

  return Number.isNaN(parsedTime) ? fallbackTime : parsedTime;
};

const getVehicleSnapshotLabel = (snapshot?: Vehicle) => {
  if (!snapshot) {
    return "";
  }

  return [
    snapshot.brand,
    snapshot.model,
    snapshot.generation,
    snapshot.year && `${snapshot.year}년`,
    snapshot.fuelType,
    snapshot.mileage && `${Number(snapshot.mileage).toLocaleString()}km`,
  ]
    .filter(Boolean)
    .join(" · ");
};

const getTimelineItems = (reviews: Review[]): TimelineItem[] =>
  reviews
    .map((review) => {
      const snapshot = review.vehicleSnapshot as
        | VehicleSnapshotWithCreatedAt
        | undefined;
      const dateLabel = snapshot?.createdAt || review.createdAt;

      return {
        review,
        dateLabel,
        mileageLabel: snapshot?.mileage
          ? `${Number(snapshot.mileage).toLocaleString()}km`
          : "주행거리 정보 없음",
        snapshotLabel: getVehicleSnapshotLabel(snapshot),
        sortTime: getParsedTime(dateLabel, review.id),
      };
    })
    .sort((left, right) => right.sortTime - left.sortTime);

export default function CarReportPage() {
  const params = useParams();
  const router = useRouter();
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>("latest");
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string)
  );

  const { reviews } = useReviews(carNumber);
  const { vehicle } = useVehicle(carNumber);
  const brand = vehicle?.brand ?? "";
  const model = vehicle?.model ?? "";
  const generation = vehicle?.generation ?? "";
  const year = vehicle?.year ?? "";
  const mileage = vehicle?.mileage ?? "";
  const fuelType = vehicle?.fuelType ?? "";
  const hasVehicleInfo = Boolean(brand && model && generation && year);

  const aiSummaries = getAiSummary(brand, model, year, mileage, {
    generation,
    fuelType,
  });
  const timelineItems = getTimelineItems(reviews);
  const visibleTimelineItems = timelineItems.slice(0, 3);
  const helpfulCountsSnapshot = useSyncExternalStore(
    subscribeToHelpfulChanges,
    getHelpfulCountsSnapshot,
    getServerHelpfulCountsSnapshot
  );
  const helpfulCounts = useMemo(
    () => parseHelpfulJson<Record<string, number>>(helpfulCountsSnapshot, {}),
    [helpfulCountsSnapshot]
  );
  const sortedReviews = useMemo(
    () =>
      [...reviews].sort((left, right) => {
        const leftHelpfulCount =
          helpfulCounts[`${carNumber}-${left.id}`] ?? left.helpfulCount ?? 0;
        const rightHelpfulCount =
          helpfulCounts[`${carNumber}-${right.id}`] ??
          right.helpfulCount ??
          0;
        const leftCreatedTime = getParsedTime(left.createdAt, left.id);
        const rightCreatedTime = getParsedTime(right.createdAt, right.id);

        if (reviewSort === "helpful") {
          return (
            rightHelpfulCount - leftHelpfulCount ||
            rightCreatedTime - leftCreatedTime
          );
        }

        return rightCreatedTime - leftCreatedTime;
      }),
    [carNumber, helpfulCounts, reviewSort, reviews]
  );
  const totalReviewPages = Math.max(
    1,
    Math.ceil(sortedReviews.length / reviewsPerPage)
  );
  const currentReviewPage = Math.min(reviewPage, totalReviewPages);
  const visibleReviews = sortedReviews.slice(
    (currentReviewPage - 1) * reviewsPerPage,
    currentReviewPage * reviewsPerPage
  );
  const changeReviewSort = (nextSort: ReviewSortOption) => {
    setReviewSort(nextSort);
    setReviewPage(1);
  };

  return (
    <main className={pageClassName}>
      <button
        type="button"
        onClick={() => router.push("/")}
        className={homeButtonClassName}
      >
        ← 홈으로
      </button>

      <h1 className="text-5xl font-bold mb-6">카플래닛 리포트</h1>

      <p className="text-2xl text-gray-300 mb-10">
        차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
      </p>

      <CarViewEventToast carNumber={carNumber} />

      <div className={panelClassName}>
        {!hasVehicleInfo ? (
          <>
            <p className="text-gray-300 mb-6">
              등록된 차량 정보가 없습니다. 차량 정보를 먼저 입력해주세요.
            </p>

            <Link
              href={`/car/${encodeURIComponent(carNumber)}/setup`}
              className={actionLinkClassName}
            >
              차량 정보 등록하기
            </Link>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-zinc-800 p-4 mb-6">
              <p className="text-gray-300">
                {[brand, model, generation, year && `${year}년`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(fuelType || mileage) && (
                <p className="text-sm text-gray-500 mt-2">
                  {[
                    fuelType,
                    mileage &&
                      `주행거리: ${Number(mileage).toLocaleString()}km`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <Link
              href={`/car/${encodeURIComponent(carNumber)}/edit`}
              className={editLinkClassName}
            >
              차량정보가 바뀌었나요?
            </Link>

            <AiSummaryCard summaries={aiSummaries} />

            <section className={timelineSectionClassName}>
              <h2 className="mb-4 text-2xl font-bold">차량 이력 타임라인</h2>

              {timelineItems.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-800/70 p-4 text-sm text-gray-400">
                  아직 차량 이력이 없습니다.
                </p>
              ) : (
                <div className={timelineListClassName}>
                  {visibleTimelineItems.map((item) => {
                    const tags = item.review.tags ?? [];

                    return (
                      <article
                        key={item.review.id}
                        className={timelineItemClassName}
                      >
                        <span className={timelineDotClassName} />

                        <div className={timelineCardClassName}>
                          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span>{item.dateLabel}</span>
                            <span aria-hidden>·</span>
                            <span>{item.mileageLabel}</span>
                          </div>

                          {tags.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {tags.map((tag) => (
                                <span key={tag} className={timelineTagClassName}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="line-clamp-2 text-sm leading-6 text-gray-200">
                            {item.review.content}
                          </p>

                          <p className="mt-3 border-t border-zinc-700 pt-3 text-xs leading-5 text-gray-500">
                            {item.snapshotLabel ||
                              "작성 당시 차량 스냅샷 정보 없음"}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className={reviewHeaderClassName}>
              <h2 className="text-3xl font-bold">등록된 팩트</h2>
              <div className={sortControlClassName} aria-label="후기 정렬">
                <button
                  type="button"
                  onClick={() => changeReviewSort("latest")}
                  aria-pressed={reviewSort === "latest"}
                  className={cn(
                    sortButtonClassName,
                    reviewSort === "latest" && activeSortButtonClassName
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
                    reviewSort === "helpful" && activeSortButtonClassName
                  )}
                >
                  도움순
                </button>
              </div>
            </div>

            {reviews.length === 0 ? (
              <p className="text-gray-400 mb-8">아직 등록된 후기가 없습니다.</p>
            ) : (
              <div className="space-y-4 mb-8">
                {visibleReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    reviewKey={`${carNumber}-${review.id}`}
                  />
                ))}
              </div>
            )}

            {reviews.length > reviewsPerPage && (
              <div className={reviewPaginationClassName} aria-label="후기 페이지">
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
                          activeReviewPageButtonClassName
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
                      Math.min(totalReviewPages, currentReviewPage + 1)
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
              href={`/car/${encodeURIComponent(carNumber)}/review`}
              className={actionLinkClassName}
            >
              이 차량 후기 남기기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
