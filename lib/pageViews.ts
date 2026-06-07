"use client";

import { supabase } from "@/lib/supabase";

interface RecordPageViewInput {
  eventType?: "page_view" | "vehicle_view" | "review_view";
  vehicleId?: string | null;
  reviewId?: string | null;
}

const pageViewSessionStorageKey = "carfact_page_view_session_id";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
};

const getPageViewSessionId = () => {
  const existingSessionId = localStorage.getItem(pageViewSessionStorageKey);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createSessionId();
  localStorage.setItem(pageViewSessionStorageKey, nextSessionId);

  return nextSessionId;
};

export const recordPageView = async ({
  eventType = "page_view",
  reviewId,
  vehicleId,
}: RecordPageViewInput) => {
  const normalizedVehicleId =
    vehicleId && uuidPattern.test(vehicleId) ? vehicleId : null;
  const normalizedReviewId =
    reviewId && uuidPattern.test(reviewId) ? reviewId : null;

  if (!normalizedVehicleId && !normalizedReviewId) {
    return false;
  }

  const sessionResult = await supabase?.auth.getSession();
  const accessToken = sessionResult?.data.session?.access_token;
  const response = await fetch("/api/page-views", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
    },
    body: JSON.stringify({
      vehicleId: normalizedVehicleId,
      reviewId: normalizedReviewId,
      eventType,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      sessionId: getPageViewSessionId(),
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as { recorded?: boolean };

  return Boolean(result.recorded);
};
