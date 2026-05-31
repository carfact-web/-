"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

type OAuthProvider = "google" | "kakao";

const kakaoOAuthScope = "profile_nickname profile_image";
const googleOAuthRedirectTo = "https://www.carfact.kr/auth/callback";
export const authRedirectStorageKey = "carfact-auth-redirect-to";

interface UseAuthResult {
  authError: string;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isSupabaseConfigured: boolean;
  session: Session | null;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInWithKakao: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  user: User | null;
  userLabel: string;
}

const getStringMetadata = (
  metadata: User["user_metadata"] | undefined,
  key: string
) => {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value : null;
};

const getUserLabel = (user: User | null) => {
  if (!user) {
    return "";
  }

  const label =
    getStringMetadata(user.user_metadata, "full_name") ??
    getStringMetadata(user.user_metadata, "name") ??
    getStringMetadata(user.user_metadata, "nickname") ??
    getStringMetadata(user.user_metadata, "preferred_username");

  if (label) {
    return label;
  }

  return user.email ?? "로그인 사용자";
};

const getProviderUserId = (user: User | null, provider: OAuthProvider) => {
  const identity = user?.identities?.find((item) => item.provider === provider);
  const identityData = identity?.identity_data;
  const providerId = identityData?.provider_id;
  const sub = identityData?.sub;

  if (typeof providerId === "string" && providerId.trim()) {
    return providerId;
  }

  if (typeof sub === "string" && sub.trim()) {
    return sub;
  }

  return identity?.id ?? null;
};

const syncUserProfile = async (user: User | null) => {
  if (!supabase || !user) {
    return;
  }

  const provider =
    typeof user.app_metadata.provider === "string"
      ? user.app_metadata.provider
      : null;
  const kakaoProviderId = getProviderUserId(user, "kakao");
  const googleProviderId = getProviderUserId(user, "google");
  const providerUserId =
    provider === "kakao"
      ? kakaoProviderId
      : provider === "google"
        ? googleProviderId
        : null;

  await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      display_name: getUserLabel(user),
      auth_provider: provider,
      provider_user_id: providerUserId,
      kakao_provider_id: kakaoProviderId,
      google_provider_id: googleProviderId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
};

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  const user = session?.user ?? null;
  const userLabel = useMemo(() => getUserLabel(user), [user]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) {
          return;
        }

        if (error) {
          setAuthError(error.message);
        }

        setSession(data.session);
        setIsAuthReady(true);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setAuthError(
          error instanceof Error ? error.message : "로그인 상태를 확인하지 못했습니다."
        );
        setIsAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthReady(true);
      setAuthError("");
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    syncUserProfile(user).catch(() => {
      // Profile persistence is additive for Kakao channel/AlimTalk readiness.
      // Auth must continue even if the table has not been applied yet.
    });
  }, [user]);

  const signInWithProvider = useCallback(async (
    provider: OAuthProvider,
    redirectTo?: string
  ) => {
    if (!supabase) {
      setAuthError("Supabase Auth 설정이 필요합니다.");
      return;
    }

    setAuthError("");

    if (provider === "google") {
      localStorage.setItem(
        authRedirectStorageKey,
        redirectTo ?? window.location.href
      );
    }

    const queryParams: Record<string, string> =
      provider === "google"
        ? {
            prompt: "select_account",
          }
        : {
            scope: kakaoOAuthScope,
          };

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          provider === "google"
            ? googleOAuthRedirectTo
            : redirectTo ?? window.location.href,
        queryParams,
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const signInWithGoogle = useCallback(
    async (redirectTo?: string) => signInWithProvider("google", redirectTo),
    [signInWithProvider]
  );

  const signInWithKakao = useCallback(
    async (redirectTo?: string) => signInWithProvider("kakao", redirectTo),
    [signInWithProvider]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      return;
    }

    setAuthError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSession(null);
  }, []);

  return {
    authError,
    isAuthenticated: Boolean(user),
    isAuthReady,
    isSupabaseConfigured,
    session,
    signInWithGoogle,
    signInWithKakao,
    signOut,
    user,
    userLabel,
  };
}
