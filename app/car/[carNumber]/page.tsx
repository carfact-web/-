"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AiSummaryCard } from "@/components/AiSummaryCard";
import { ReviewCard } from "@/components/ReviewCard";
import { useReviews } from "@/hooks/useReviews";
import { useVehicle } from "@/hooks/useVehicle";
import { getAiSummary } from "@/utils/aiSummary";
import { cn } from "@/utils/cn";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const panelClassName = cn("max-w-2xl rounded-2xl bg-zinc-900 p-6");
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
  const carNumber = decodeURIComponent(params.carNumber as string);

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

  return (
    <main className={pageClassName}>
      <h1 className="text-5xl font-bold mb-6">카팩트 리포트</h1>

      <p className="text-2xl text-gray-300 mb-10">
        차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
      </p>

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
                  {timelineItems.map((item) => {
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

            <h2 className="text-3xl font-bold mb-6">등록된 팩트</h2>

            {reviews.length === 0 ? (
              <p className="text-gray-400 mb-8">아직 등록된 후기가 없습니다.</p>
            ) : (
              <div className="space-y-4 mb-8">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
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
