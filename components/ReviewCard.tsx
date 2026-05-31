"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Review } from "@/types/review";
import { updateSupabaseReviewHelpfulCount } from "@/lib/supabaseData";
import { cn } from "@/utils/cn";
import {
  addHelpfulVote,
  getHelpfulSnapshot,
  getServerHelpfulSnapshot,
  parseHelpfulJson,
  subscribeToHelpfulChanges,
  type HelpfulSnapshot,
} from "@/utils/reviewHelpful";
import {
  addReviewReport,
  getReviewReportSnapshot,
  getServerReviewReportSnapshot,
  hiddenReviewReportThreshold,
  reviewReportReasons,
  subscribeToReviewReports,
  type ReviewReportReason,
  type ReviewReportSnapshot,
} from "@/utils/reviewReports";

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
  "relative aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 transition",
  "hover:border-zinc-500 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-500/50"
);
const modalOverlayClassName = cn(
  "fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
);
const modalContentClassName = cn(
  "relative flex max-h-full w-full max-w-5xl flex-col items-center gap-4"
);
const modalImageWrapClassName = cn(
  "relative h-[72vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60"
);
const modalCloseButtonClassName = cn(
  "absolute right-0 top-0 z-10 rounded-lg border border-white/10 bg-zinc-900/90 px-3 py-2 text-sm font-semibold text-zinc-100 transition",
  "hover:bg-zinc-800 active:scale-[0.98]"
);
const modalNavButtonClassName = cn(
  "inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 px-3 text-lg font-bold text-zinc-100 transition",
  "hover:bg-zinc-800 active:scale-[0.96] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-zinc-900/90"
);
const modalCounterClassName = cn(
  "rounded-full border border-white/10 bg-zinc-900/90 px-3 py-1 text-sm font-semibold text-zinc-200"
);
const modalControlsClassName = cn(
  "flex items-center justify-center gap-3"
);
const snapshotClassName = cn(
  "border-t border-zinc-700 pt-3 text-xs leading-5 text-gray-500"
);
const footerClassName = cn(
  "mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-700 pt-3"
);
const helpfulButtonClassName = cn(
  "inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-700 hover:text-white active:scale-[0.98]",
  "disabled:cursor-default disabled:border-zinc-700 disabled:bg-zinc-900/70 disabled:text-gray-500 disabled:hover:text-gray-500"
);
const reportButtonClassName = cn(
  "inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-300 transition",
  "hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 active:scale-[0.98]",
  "disabled:cursor-default disabled:border-zinc-700 disabled:bg-zinc-900/70 disabled:text-gray-500 disabled:hover:text-gray-500"
);
const reportModalPanelClassName = cn(
  "w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/60"
);
const reportReasonButtonClassName = cn(
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-left text-sm font-semibold text-zinc-200 transition",
  "hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.99]"
);
const activeReportReasonButtonClassName = cn(
  "border-red-500 bg-red-500/15 text-red-100"
);
const reportSubmitButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition",
  "hover:bg-red-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:hover:bg-zinc-700"
);
const reportCancelButtonClassName = cn(
  "mt-2 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-300 transition",
  "hover:bg-zinc-800 active:scale-[0.99]"
);
const successToastClassName = cn(
  "fixed left-1/2 top-4 z-[10001] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-white/10",
  "bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 shadow-lg shadow-black/25",
  "backdrop-blur transition-all duration-500 ease-out sm:top-6 sm:inline-flex sm:w-auto sm:items-center"
);
const hiddenReviewClassName = cn(
  "rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 text-sm text-zinc-400"
);

export function ReviewCard({ review, reviewKey }: ReviewCardProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportReason, setSelectedReportReason] =
    useState<ReviewReportReason | null>(null);
  const [isReportToastMounted, setIsReportToastMounted] = useState(false);
  const [showReportToast, setShowReportToast] = useState(false);
  const authorNickname = review.authorNickname || "익명 사용자";
  const storageKey = reviewKey ?? String(review.id);
  const initialHelpfulCount = review.helpfulCount ?? 0;
  const initialReportCount = review.reportCount ?? 0;
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
  const reportSnapshotJson = useSyncExternalStore(
    subscribeToReviewReports,
    () =>
      JSON.stringify(getReviewReportSnapshot(storageKey, initialReportCount)),
    () => JSON.stringify(getServerReviewReportSnapshot(initialReportCount))
  );
  const reportSnapshot = useMemo(
    () =>
      parseHelpfulJson<ReviewReportSnapshot>(reportSnapshotJson, {
        count: initialReportCount,
        isReported: false,
      }),
    [reportSnapshotJson, initialReportCount]
  );
  const vehicleSnapshot = review.vehicleSnapshot;
  const reviewImages = review.images ?? [];
  const selectedImage =
    selectedImageIndex === null ? null : reviewImages[selectedImageIndex];
  const selectedImagePosition =
    selectedImageIndex === null ? 0 : selectedImageIndex + 1;
  const hasMultipleImages = reviewImages.length > 1;
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

    const nextSnapshot = addHelpfulVote(storageKey, initialHelpfulCount);
    void updateSupabaseReviewHelpfulCount(
      String(review.id),
      nextSnapshot.count
    ).catch(() => {
      // Keep local helpful state when remote persistence is unavailable.
    });
  };
  const openReportModal = () => {
    if (reportSnapshot.isReported) {
      return;
    }

    setSelectedReportReason(null);
    setIsReportModalOpen(true);
  };
  const closeReportModal = () => {
    setIsReportModalOpen(false);
    setSelectedReportReason(null);
  };
  const submitReport = () => {
    if (!selectedReportReason || reportSnapshot.isReported) {
      return;
    }

    addReviewReport(storageKey, initialReportCount, selectedReportReason);
    closeReportModal();
    setIsReportToastMounted(true);
    setShowReportToast(true);

    window.setTimeout(() => {
      setShowReportToast(false);
    }, 2000);
    window.setTimeout(() => {
      setIsReportToastMounted(false);
    }, 2500);
  };
  const closeImageModal = useCallback(() => {
    setSelectedImageIndex(null);
  }, []);

  const showPreviousImage = useCallback(() => {
    setSelectedImageIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return currentIndex === 0 ? reviewImages.length - 1 : currentIndex - 1;
    });
  }, [reviewImages.length]);

  const showNextImage = useCallback(() => {
    setSelectedImageIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return currentIndex === reviewImages.length - 1 ? 0 : currentIndex + 1;
    });
  }, [reviewImages.length]);

  useEffect(() => {
    if (selectedImageIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeImageModal();
      }

      if (event.key === "ArrowLeft" && hasMultipleImages) {
        showPreviousImage();
      }

      if (event.key === "ArrowRight" && hasMultipleImages) {
        showNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasMultipleImages, selectedImageIndex, closeImageModal, showNextImage, showPreviousImage]);

  useEffect(() => {
    if (!isReportModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReportModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isReportModalOpen]);

  const reportToast = isReportToastMounted ? (
    <div
      aria-live="polite"
      className={cn(
        successToastClassName,
        showReportToast
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      )}
    >
      <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]" />
      <span>신고가 접수되었어요.</span>
    </div>
  ) : null;

  if (reportSnapshot.count >= hiddenReviewReportThreshold) {
    return (
      <>
        {reportToast}
        <div className={hiddenReviewClassName}>
          신고 누적으로 숨겨진 후기입니다.
        </div>
      </>
    );
  }

  return (
    <div className={cardClassName}>
      {reportToast}

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
          {reviewImages.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedImageIndex(imageIndex)}
              className={imageThumbnailClassName}
              aria-label={image.name + " 이미지 확대"}
            >
              {(image.url || image.dataUrl) && (
                <Image
                  src={image.url ?? image.dataUrl ?? ""}
                  alt={image.name}
                  fill
                  unoptimized
                  sizes="120px"
                  className="object-cover"
                />
              )}
            </button>
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
        <button
          type="button"
          onClick={openReportModal}
          disabled={reportSnapshot.isReported}
          className={reportButtonClassName}
        >
          {reportSnapshot.isReported ? "신고됨" : "🚨 신고"}
        </button>
      </div>

      {isReportModalOpen && (
        <div
          className={modalOverlayClassName}
          onClick={closeReportModal}
          role="dialog"
          aria-modal="true"
          aria-label="후기 신고"
        >
          <div
            className={reportModalPanelClassName}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">후기 신고</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  신고 사유를 선택해주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReportModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                닫기
              </button>
            </div>

            <div className="space-y-2">
              {reviewReportReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReportReason(reason)}
                  aria-pressed={selectedReportReason === reason}
                  className={cn(
                    reportReasonButtonClassName,
                    selectedReportReason === reason &&
                      activeReportReasonButtonClassName
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={submitReport}
              disabled={!selectedReportReason}
              className={reportSubmitButtonClassName}
            >
              신고하기
            </button>
            <button
              type="button"
              onClick={closeReportModal}
              className={reportCancelButtonClassName}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          className={modalOverlayClassName}
          onClick={closeImageModal}
          role="dialog"
          aria-modal="true"
          aria-label="첨부 이미지 확대"
        >
          <div
            className={modalContentClassName}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeImageModal}
              className={modalCloseButtonClassName}
            >
              닫기
            </button>

            <div className={modalImageWrapClassName}>
              <Image
                src={selectedImage.url ?? selectedImage.dataUrl ?? ""}
                alt={selectedImage.name}
                fill
                unoptimized
                sizes="100vw"
                className="object-contain"
              />
            </div>

            <div className={modalControlsClassName}>
              {hasMultipleImages && (
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className={modalNavButtonClassName}
                  aria-label="이전 이미지"
                >
                  ←
                </button>
              )}

              <span className={modalCounterClassName}>
                {selectedImagePosition} / {reviewImages.length}
              </span>

              {hasMultipleImages && (
                <button
                  type="button"
                  onClick={showNextImage}
                  className={modalNavButtonClassName}
                  aria-label="다음 이미지"
                >
                  →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
