"use client";

import { supabase } from "@/lib/supabase";
import { sendGaEvent } from "@/lib/gaEvents";

interface RecordPageViewInput {
  eventType?:
    | "ai_analysis_complete"
    | "login"
    | "page_view"
    | "post_view"
    | "vehicle_view"
    | "review_view"
    | "vehicle_search"
    | "review_create"
    | "sign_up";
  path?: string | null;
  referrer?: string | null;
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
  path,
  referrer,
  reviewId,
  vehicleId,
}: RecordPageViewInput) => {
  const normalizedVehicleId =
    vehicleId && uuidPattern.test(vehicleId) ? vehicleId : null;
  const normalizedReviewId =
    reviewId && uuidPattern.test(reviewId) ? reviewId : null;
  const normalizedPath = path ?? window.location.pathname + window.location.search;
  const normalizedReferrer = referrer ?? (document.referrer || null);

  sendGaEvent(eventType, {
    page_location: window.location.href,
    page_path: normalizedPath,
    page_referrer: normalizedReferrer,
  });

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
      path: normalizedPath,
      referrer: normalizedReferrer,
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
