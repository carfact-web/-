export const reviewReportChangeEventName = "review-report-change";
export const hiddenReviewReportThreshold = 3;

const reportCountsStorageKey = "reviewReportCounts";
const reportVotesStorageKey = "reviewReportVotes";
const reportReasonsStorageKey = "reviewReportReasons";

export const reviewReportReasons = [
  "욕설/비방",
  "허위 정보 의심",
  "광고/홍보",
  "개인정보 노출",
  "기타",
] as const;

export type ReviewReportReason = (typeof reviewReportReasons)[number];

export interface ReviewReportSnapshot {
  count: number;
  isReported: boolean;
}

const parseReportJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getReportCounts = () =>
  parseReportJson<Record<string, number>>(
    localStorage.getItem(reportCountsStorageKey),
    {}
  );

const getReportVotes = () =>
  parseReportJson<Record<string, boolean>>(
    localStorage.getItem(reportVotesStorageKey),
    {}
  );

const getReportReasons = () =>
  parseReportJson<Record<string, ReviewReportReason>>(
    localStorage.getItem(reportReasonsStorageKey),
    {}
  );

export const getReviewReportSnapshot = (
  storageKey: string,
  initialCount: number
): ReviewReportSnapshot => {
  const reportCounts = getReportCounts();
  const reportVotes = getReportVotes();

  return {
    count: reportCounts[storageKey] ?? initialCount,
    isReported: Boolean(reportVotes[storageKey]),
  };
};

export const getServerReviewReportSnapshot = (
  initialCount: number
): ReviewReportSnapshot => ({
  count: initialCount,
  isReported: false,
});

export const addReviewReport = (
  storageKey: string,
  initialCount: number,
  reason: ReviewReportReason
) => {
  const currentSnapshot = getReviewReportSnapshot(storageKey, initialCount);

  if (currentSnapshot.isReported) {
    return currentSnapshot;
  }

  const reportCounts = getReportCounts();
  const reportVotes = getReportVotes();
  const reportReasons = getReportReasons();
  const nextCount = (reportCounts[storageKey] ?? initialCount) + 1;

  localStorage.setItem(
    reportCountsStorageKey,
    JSON.stringify({
      ...reportCounts,
      [storageKey]: nextCount,
    })
  );
  localStorage.setItem(
    reportVotesStorageKey,
    JSON.stringify({
      ...reportVotes,
      [storageKey]: true,
    })
  );
  localStorage.setItem(
    reportReasonsStorageKey,
    JSON.stringify({
      ...reportReasons,
      [storageKey]: reason,
    })
  );
  window.dispatchEvent(new Event(reviewReportChangeEventName));

  return {
    count: nextCount,
    isReported: true,
  };
};

export const subscribeToReviewReports = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(reviewReportChangeEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(reviewReportChangeEventName, onStoreChange);
  };
};
