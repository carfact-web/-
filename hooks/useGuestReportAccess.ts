"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

const guestViewedReportKey = "guestViewedReport";
const guestViewedReportCarNumberKey = "guestViewedReportCarNumber";
const guestReportAccessEventName = "guest-report-access-change";

interface GuestReportSnapshot {
  viewed: boolean;
  carNumber: string;
}

const getGuestReportSnapshot = () =>
  JSON.stringify({
    viewed: localStorage.getItem(guestViewedReportKey) === "true",
    carNumber: sanitizeVehiclePlateNumber(
      localStorage.getItem(guestViewedReportCarNumberKey) ?? ""
    ),
  });

const getServerGuestReportSnapshot = () =>
  JSON.stringify({ viewed: false, carNumber: "" });

const parseGuestReportSnapshot = (snapshot: string): GuestReportSnapshot => {
  try {
    const parsed = JSON.parse(snapshot) as Partial<GuestReportSnapshot>;

    return {
      viewed: parsed.viewed === true,
      carNumber: sanitizeVehiclePlateNumber(parsed.carNumber ?? ""),
    };
  } catch {
    return { viewed: false, carNumber: "" };
  }
};

const subscribeToGuestReportAccess = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(guestReportAccessEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(guestReportAccessEventName, onStoreChange);
  };
};

const markGuestReportViewed = (carNumber: string) => {
  localStorage.setItem(guestViewedReportKey, "true");
  localStorage.setItem(
    guestViewedReportCarNumberKey,
    sanitizeVehiclePlateNumber(carNumber)
  );
  window.dispatchEvent(new Event(guestReportAccessEventName));
};

export const useGuestReportAccess = (carNumber: string) => {
  const {
    isAuthenticated,
    isAuthReady,
    signInWithKakao,
  } = useAuth();
  const sanitizedCarNumber = sanitizeVehiclePlateNumber(carNumber);
  const snapshot = useSyncExternalStore(
    subscribeToGuestReportAccess,
    getGuestReportSnapshot,
    getServerGuestReportSnapshot
  );
  const guestReport = useMemo(
    () => parseGuestReportSnapshot(snapshot),
    [snapshot]
  );
  const hasViewedOtherReport =
    guestReport.viewed &&
    Boolean(guestReport.carNumber) &&
    guestReport.carNumber !== sanitizedCarNumber;
  const isBlocked =
    isAuthReady && !isAuthenticated && hasViewedOtherReport;
  const isAllowed =
    isAuthReady &&
    (isAuthenticated || !hasViewedOtherReport);

  useEffect(() => {
    if (
      !isAuthReady ||
      isAuthenticated ||
      isBlocked ||
      !sanitizedCarNumber ||
      (guestReport.viewed && guestReport.carNumber === sanitizedCarNumber)
    ) {
      return;
    }

    markGuestReportViewed(sanitizedCarNumber);
  }, [
    guestReport.carNumber,
    guestReport.viewed,
    isAuthReady,
    isAuthenticated,
    isBlocked,
    sanitizedCarNumber,
  ]);

  return {
    isAllowed,
    isBlocked,
    isChecking: !isAuthReady,
    signInWithKakao,
  };
};
