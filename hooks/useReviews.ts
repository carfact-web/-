"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { mockReviews } from "@/data/mockReviews";
import {
  filterValidReviews,
  validateReviewContent,
  type ReviewValidationResult,
} from "@/utils/reviewValidation";
import type { Review } from "@/types/review";

interface UseReviewsResult {
  reviews: Review[];
  addReview: (review: Review) => ReviewValidationResult;
}

const fallbackReviewsJson = JSON.stringify(mockReviews);
export const reviewsChangeEventName = "reviews-change";

export const getReviewStorageKey = (carNumber: string) =>
  `reviews-${carNumber}`;

const parseReviews = (reviewsJson: string): Review[] => {
  try {
    return filterValidReviews(JSON.parse(reviewsJson) as Review[]);
  } catch {
    return filterValidReviews(mockReviews);
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
      const validation = validateReviewContent(review.content);

      if (!validation.isValid) {
        return validation;
      }

      const savedReviews = parseReviews(
        localStorage.getItem(reviewStorageKey) || fallbackReviewsJson
      );
      const nextReview = {
        ...review,
        content: validation.content,
      };

      localStorage.setItem(
        reviewStorageKey,
        JSON.stringify([nextReview, ...savedReviews])
      );
      window.dispatchEvent(new Event(reviewsChangeEventName));

      return validation;
    },
    [reviewStorageKey]
  );

  return { reviews, addReview };
}
