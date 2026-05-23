"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { mockReviews } from "@/data/mockReviews";
import type { Review } from "@/types/review";

interface UseReviewsResult {
  reviews: Review[];
  addReview: (review: Review) => void;
}

const fallbackReviewsJson = JSON.stringify(mockReviews);
export const reviewsChangeEventName = "reviews-change";

export const getReviewStorageKey = (carNumber: string) =>
  `reviews-${carNumber}`;

const parseReviews = (reviewsJson: string): Review[] => {
  try {
    return JSON.parse(reviewsJson) as Review[];
  } catch {
    return mockReviews;
  }
};

const subscribeToReviews = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(reviewsChangeEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(reviewsChangeEventName, onStoreChange);
  };
};

export function useReviews(carNumber: string): UseReviewsResult {
  const reviewStorageKey = getReviewStorageKey(carNumber);
  const reviewsJson = useSyncExternalStore(
    subscribeToReviews,
    () => localStorage.getItem(reviewStorageKey) || fallbackReviewsJson,
    () => fallbackReviewsJson
  );
  const reviews = useMemo(() => parseReviews(reviewsJson), [reviewsJson]);

  const addReview = useCallback(
    (review: Review) => {
      const savedReviews = parseReviews(
        localStorage.getItem(reviewStorageKey) || fallbackReviewsJson
      );

      localStorage.setItem(
        reviewStorageKey,
        JSON.stringify([review, ...savedReviews])
      );
      window.dispatchEvent(new Event(reviewsChangeEventName));
    },
    [reviewStorageKey]
  );

  return { reviews, addReview };
}
