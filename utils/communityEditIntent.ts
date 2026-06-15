const communityEditIntentStorageKey = "carfact-community-edit-intent";
const maxCommunityEditIntentAgeMs = 15_000;

const legacyCommunityEditingStorageKeys = [
  "editPostId",
  "editingPost",
  "selectedPost",
  "isEditing",
  "community-editing-post",
  "community-edit-draft",
];

interface CommunityEditIntent {
  createdAt: number;
  postId: string;
}

export const clearCommunityEditIntentStorage = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(communityEditIntentStorageKey);

    legacyCommunityEditingStorageKeys.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
  } catch {
    // Storage access can fail in restricted browser modes.
  }
};

export const markCommunityPostEditIntent = (postId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      communityEditIntentStorageKey,
      JSON.stringify({ createdAt: Date.now(), postId } satisfies CommunityEditIntent),
    );
  } catch {
    // The query param still carries the post id, but without this marker it is ignored.
  }
};

export const consumeCommunityPostEditIntent = (postId: string) => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const rawIntent = window.sessionStorage.getItem(communityEditIntentStorageKey);

    window.sessionStorage.removeItem(communityEditIntentStorageKey);

    if (!rawIntent) {
      return false;
    }

    const intent = JSON.parse(rawIntent) as Partial<CommunityEditIntent>;

    return (
      intent.postId === postId &&
      typeof intent.createdAt === "number" &&
      Date.now() - intent.createdAt <= maxCommunityEditIntentAgeMs
    );
  } catch {
    return false;
  }
};
