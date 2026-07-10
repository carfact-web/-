"use client";

type AnalyticsEventName =
  | "ai_analysis_complete"
  | "login"
  | "post_view"
  | "page_view"
  | "review_create"
  | "review_view"
  | "sign_up"
  | "vehicle_search"
  | "vehicle_view";

type AnalyticsEventParams = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      eventParams?: AnalyticsEventParams,
    ) => void;
  }
}

const gaEventNameMap: Record<AnalyticsEventName, string> = {
  ai_analysis_complete: "ai_analysis_complete",
  login: "login",
  page_view: "page_view",
  post_view: "post_view",
  review_create: "review_create",
  review_view: "review_view",
  sign_up: "sign_up",
  vehicle_search: "vehicle_search",
  vehicle_view: "vehicle_search",
};

export const sendGaEvent = (
  eventName: AnalyticsEventName,
  eventParams: AnalyticsEventParams = {},
) => {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return false;
  }

  window.gtag("event", gaEventNameMap[eventName], {
    ...eventParams,
    event_source: "carfact_web",
  });

  return true;
};
