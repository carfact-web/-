"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { mockReviews } from "@/data/mockReviews";
import {
  fetchSupabaseReviews,
  saveSupabaseReview,
} from "@/lib/supabaseData";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  filterValidReviews,
  validateReviewContent,
  type ReviewValidationResult,
} from "@/utils/reviewValidation";
import type { Review } from "@/types/review";

interface UseReviewsResult {
  reviews: Review[];
  addReview: (review: Review) => Promise<ReviewValidationResult>;
}

const fallbackReviewsJson = JSON.stringify(mockReviews);
export const reviewsChangeEventName = "reviews-change";

export const getReviewStorageKey = (carNumber: string) =>
  "reviews-" + sanitizeVehiclePlateNumber(carNumber);

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

const cacheReviews = (storageKey: string, reviews: Review[]) => {
  localStorage.setItem(storageKey, JSON.stringify(reviews));
  window.dispatchEvent(new Event(reviewsChangeEventName));
};

export function useReviews(carNumber: string): UseReviewsResult {
  const sanitizedCarNumber = sanitizeVehiclePlateNumber(carNumber);
  const reviewStorageKey = getReviewStorageKey(sanitizedCarNumber);
  const reviewsJson = useSyncExternalStore(
    subscribeToReviews,
    () => localStorage.getItem(reviewStorageKey) || fallbackReviewsJson,
    () => fallbackReviewsJson
  );
  const localReviews = useMemo(() => parseReviews(reviewsJson), [reviewsJson]);
  const [remoteReviewsSnapshot, setRemoteReviewsSnapshot] = useState<{
    carNumber: string;
    reviews: Review[];
  } | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!sanitizedCarNumber) {
      return () => {
        isActive = false;
      };
    }

    fetchSupabaseReviews(sanitizedCarNumber)
      .then((reviews) => {
        if (!isActive || reviews === null) {
          return;
        }

        setRemoteReviewsSnapshot({
          carNumber: sanitizedCarNumber,
          reviews,
        });
        cacheReviews(reviewStorageKey, reviews);
      })
      .catch(() => {
        // Keep localStorage as the active fallback when Supabase is unavailable.
      });

    return () => {
      isActive = false;
    };
  }, [reviewStorageKey, sanitizedCarNumber]);

  const addReview = useCallback(
    async (review: Review) => {
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

      try {
        const savedReview = await saveSupabaseReview(
          sanitizedCarNumber,
          nextReview
        );

        if (savedReview) {
          const nextReviews = [savedReview, ...savedReviews];

          cacheReviews(reviewStorageKey, nextReviews);
          setRemoteReviewsSnapshot({
            carNumber: sanitizedCarNumber,
            reviews: nextReviews,
          });

          return validation;
        }
      } catch {
        // Supabase is the primary path, but localStorage remains the fallback.
      }

      cacheReviews(reviewStorageKey, [nextReview, ...savedReviews]);
      setRemoteReviewsSnapshot((currentReviewsSnapshot) =>
        currentReviewsSnapshot?.carNumber === sanitizedCarNumber
          ? {
              carNumber: sanitizedCarNumber,
              reviews: [nextReview, ...currentReviewsSnapshot.reviews],
            }
          : null
      );

      return validation;
    },
    [reviewStorageKey, sanitizedCarNumber]
  );

  const remoteReviews =
    remoteReviewsSnapshot?.carNumber === sanitizedCarNumber
      ? remoteReviewsSnapshot.reviews
      : null;

  return { reviews: remoteReviews ?? localReviews, addReview };
}
