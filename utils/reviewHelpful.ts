export const helpfulChangeEventName = "review-helpful-change";

const helpfulCountsStorageKey = "reviewHelpfulCounts";
const helpfulVotesStorageKey = "reviewHelpfulVotes";

export interface HelpfulSnapshot {
  count: number;
  isVoted: boolean;
}

export const parseHelpfulJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const getHelpfulCounts = () =>
  parseHelpfulJson<Record<string, number>>(
    localStorage.getItem(helpfulCountsStorageKey),
    {}
  );

export const getHelpfulCountsSnapshot = () =>
  JSON.stringify(getHelpfulCounts());

export const getServerHelpfulCountsSnapshot = () => "{}";

export const getHelpfulSnapshot = (
  storageKey: string,
  initialCount: number
): HelpfulSnapshot => {
  const helpfulCounts = getHelpfulCounts();
  const helpfulVotes = parseHelpfulJson<Record<string, boolean>>(
    localStorage.getItem(helpfulVotesStorageKey),
    {}
  );

  return {
    count: helpfulCounts[storageKey] ?? initialCount,
    isVoted: Boolean(helpfulVotes[storageKey]),
  };
};

export const getServerHelpfulSnapshot = (
  initialCount: number
): HelpfulSnapshot => ({
  count: initialCount,
  isVoted: false,
});

export const addHelpfulVote = (storageKey: string, initialCount: number) => {
  const helpfulSnapshot = getHelpfulSnapshot(storageKey, initialCount);

  if (helpfulSnapshot.isVoted) {
    return helpfulSnapshot;
  }

  const helpfulCounts = getHelpfulCounts();
  const helpfulVotes = parseHelpfulJson<Record<string, boolean>>(
    localStorage.getItem(helpfulVotesStorageKey),
    {}
  );
  const nextCount = (helpfulCounts[storageKey] ?? initialCount) + 1;

  localStorage.setItem(
    helpfulCountsStorageKey,
    JSON.stringify({
      ...helpfulCounts,
      [storageKey]: nextCount,
    })
  );
  localStorage.setItem(
    helpfulVotesStorageKey,
    JSON.stringify({
      ...helpfulVotes,
      [storageKey]: true,
    })
  );
  window.dispatchEvent(new Event(helpfulChangeEventName));

  return {
    count: nextCount,
    isVoted: true,
  };
};

export const subscribeToHelpfulChanges = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(helpfulChangeEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(helpfulChangeEventName, onStoreChange);
  };
};
