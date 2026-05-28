"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Vehicle } from "@/types/vehicle";

export interface RecentView {
  carNumber: string;
  title: string;
  lastViewedAt: string;
  vehicleSnapshot?: Vehicle;
}

export const recentViewsStorageKey = "carfact_recent_views";
export const recentViewsChangeEventName = "recent-views-change";

const parseRecentViews = (json: string | null): RecentView[] => {
  if (!json) {
    return [];
  }

  try {
    return JSON.parse(json) as RecentView[];
  } catch {
    return [];
  }
};

const sortRecentViews = (views: RecentView[]) =>
  [...views].sort(
    (left, right) =>
      Date.parse(right.lastViewedAt) - Date.parse(left.lastViewedAt)
  );

const getRecentViewsSnapshot = () =>
  JSON.stringify(sortRecentViews(parseRecentViews(localStorage.getItem(recentViewsStorageKey))));

const getServerRecentViewsSnapshot = () => "[]";

const subscribeToRecentViews = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(recentViewsChangeEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(recentViewsChangeEventName, onStoreChange);
  };
};

const writeRecentViews = (views: RecentView[]) => {
  localStorage.setItem(recentViewsStorageKey, JSON.stringify(views));
  window.dispatchEvent(new Event(recentViewsChangeEventName));
};

export const saveRecentView = (
  carNumber: string,
  title: string,
  vehicleSnapshot?: Vehicle
) => {
  const existingViews = parseRecentViews(
    localStorage.getItem(recentViewsStorageKey)
  );

  const nextViews = [
    {
      carNumber,
      title,
      lastViewedAt: new Date().toISOString(),
      vehicleSnapshot,
    },
    ...existingViews.filter((item) => item.carNumber !== carNumber),
  ];

  writeRecentViews(nextViews);
};

export const removeRecentView = (carNumber: string) => {
  const existingViews = parseRecentViews(
    localStorage.getItem(recentViewsStorageKey)
  );

  writeRecentViews(existingViews.filter((item) => item.carNumber !== carNumber));
};

export const clearRecentViews = () => {
  localStorage.removeItem(recentViewsStorageKey);
  window.dispatchEvent(new Event(recentViewsChangeEventName));
};

export function useRecentViews() {
  const recentViewsJson = useSyncExternalStore(
    subscribeToRecentViews,
    getRecentViewsSnapshot,
    getServerRecentViewsSnapshot
  );

  const recentViews = useMemo(
    () => sortRecentViews(parseRecentViews(recentViewsJson)),
    [recentViewsJson]
  );

  const saveView = useCallback(
    (carNumber: string, title: string, vehicleSnapshot?: Vehicle) => {
      saveRecentView(carNumber, title, vehicleSnapshot);
    },
    []
  );

  const removeView = useCallback((carNumber: string) => {
    removeRecentView(carNumber);
  }, []);

  const clearViews = useCallback(() => {
    clearRecentViews();
  }, []);

  return {
    recentViews,
    saveRecentView: saveView,
    removeRecentView: removeView,
    clearRecentViews: clearViews,
  };
}
