"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface UseAuthResult {
  authError: string;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isSupabaseConfigured: boolean;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  user: User | null;
  userLabel: string;
}

const getUserLabel = (user: User | null) => {
  if (!user) {
    return "";
  }

  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName;
  }

  if (typeof name === "string" && name.trim()) {
    return name;
  }

  return user.email ?? "로그인 사용자";
};

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState("");

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

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setAuthError("Supabase Auth 설정이 필요합니다.");
      return;
    }

    setAuthError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }, []);

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

  const user = session?.user ?? null;
  const userLabel = useMemo(() => getUserLabel(user), [user]);

  return {
    authError,
    isAuthenticated: Boolean(user),
    isAuthReady,
    isSupabaseConfigured,
    session,
    signInWithGoogle,
    signOut,
    user,
    userLabel,
  };
}
