"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createRandomNickname } from "@/lib/nickname";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

type OAuthProvider = "google" | "kakao";

const kakaoOAuthScope = "profile_nickname profile_image";
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

const syncUserProfile = async (user: User | null) => {
  if (!supabase || !user) {
    return;
  }

  const now = new Date().toISOString();
  const { data: existingProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,nickname,nickname_changed")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!existingProfile) {
    const { error } = await supabase.from("user_profiles").insert({
      id: user.id,
      nickname: createRandomNickname(),
      nickname_changed: false,
      updated_at: now,
      created_at: now,
    });

    if (error) {
      throw error;
    }

    return;
  }

  const nextProfile =
    existingProfile.nickname?.trim()
      ? {
          updated_at: now,
        }
      : {
          nickname: createRandomNickname(),
          nickname_changed: false,
          updated_at: now,
        };

  const { error } = await supabase
    .from("user_profiles")
    .update(nextProfile)
    .eq("id", user.id);

  if (error) {
    throw error;
  }
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

        console.log("supabase-auth-get-session", {
          sessionUserId: data.session?.user.id ?? null,
          hasSession: Boolean(data.session),
        });
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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log("supabase-auth-state-change", {
        event,
        sessionUserId: nextSession?.user.id ?? null,
        hasSession: Boolean(nextSession),
      });
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

    supabase?.auth
      .getUser()
      .then(({ data, error }) => {
        console.log("supabase-auth-get-user", {
          error: error?.message ?? null,
          userId: data.user?.id ?? null,
          hookUserId: user.id,
          userIdMatches: data.user?.id === user.id,
        });
      })
      .catch((error) => {
        console.log("supabase-auth-get-user", {
          error:
            error instanceof Error ? error.message : "getUser failed",
          userId: null,
          hookUserId: user.id,
          userIdMatches: false,
        });
      });

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

    localStorage.setItem(
      authRedirectStorageKey,
      redirectTo ?? window.location.href
    );

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
        redirectTo: window.location.origin + "/auth/callback",
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
