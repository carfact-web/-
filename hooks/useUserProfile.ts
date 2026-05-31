"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createRandomNickname } from "@/lib/nickname";
import { supabase } from "@/lib/supabase";
import { sanitizeUserText } from "@/utils/inputSanitizer";
import type { Database } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

const minimumNicknameLength = 2;
const maximumNicknameLength = 20;

const normalizeNickname = (value: string) =>
  sanitizeUserText(value).replace(/\s+/g, " ").trim();

const validateNickname = (value: string) => {
  const nickname = normalizeNickname(value);
  const nicknameLength = Array.from(nickname).length;

  if (!nickname) {
    return { nickname, message: "닉네임을 입력해주세요." };
  }

  if (nicknameLength < minimumNicknameLength) {
    return { nickname, message: "닉네임은 2자 이상 입력해주세요." };
  }

  if (nicknameLength > maximumNicknameLength) {
    return { nickname, message: "닉네임은 20자 이하로 입력해주세요." };
  }

  return { nickname, message: "" };
};

interface UseUserProfileResult {
  canChangeNickname: boolean;
  ensureReviewNickname: () => Promise<string>;
  isProfileReady: boolean;
  nickname: string;
  nicknameChanged: boolean;
  profileError: string;
  reviewNickname: string;
  updateNickname: (value: string) => Promise<boolean>;
}

export function useUserProfile(user: User | null): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileReady, setIsProfileReady] = useState(!user);
  const [profileError, setProfileError] = useState("");

  const ensureReviewNickname = useCallback(async () => {
    if (!supabase || !user) {
      setProfileError("로그인이 필요합니다.");
      return "";
    }

    if (profile?.id === user.id && profile.nickname?.trim()) {
      return profile.nickname.trim();
    }

    const client = supabase;

    try {
      const { data, error } = await client
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setProfileError(error.message);
        setProfile(null);
        return "";
      }

      if (data?.nickname?.trim()) {
        setProfile(data);
        setProfileError("");
        return data.nickname.trim();
      }

      const nextNickname = createRandomNickname();
      const now = new Date().toISOString();

      if (data) {
        const { data: updatedProfile, error: updateError } = await client
          .from("user_profiles")
          .update({
            nickname: nextNickname,
            nickname_changed: false,
            updated_at: now,
          })
          .eq("id", user.id)
          .select("*")
          .single();

        if (updateError) {
          setProfileError(updateError.message);
          setProfile(data);
          return "";
        }

        setProfile(updatedProfile);
        setProfileError("");
        return updatedProfile.nickname?.trim() ?? nextNickname;
      }

      const { data: createdProfile, error: createError } = await client
        .from("user_profiles")
        .insert({
          id: user.id,
          nickname: nextNickname,
          nickname_changed: false,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (createError) {
        const { data: reloadedProfile, error: reloadError } = await client
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (reloadError) {
          setProfileError(reloadError.message);
          setProfile(null);
          return "";
        }

        setProfile(reloadedProfile);
        setProfileError("");
        return reloadedProfile?.nickname?.trim() ?? "";
      }

      setProfile(createdProfile);
      setProfileError("");
      return createdProfile.nickname?.trim() ?? nextNickname;
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "프로필을 저장하지 못했습니다."
      );
      return "";
    }
  }, [profile, user]);

  useEffect(() => {
    let isActive = true;

    if (!supabase || !user) {
      void Promise.resolve().then(() => {
        if (!isActive) {
          return;
        }

        setProfile(null);
        setIsProfileReady(true);
      });

      return () => {
        isActive = false;
      };
    }

    const loadProfile = async () => {
      setIsProfileReady(false);
      setProfileError("");

      try {
        await ensureReviewNickname();

        if (!isActive) {
          return;
        }

        setIsProfileReady(true);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setProfileError(
          error instanceof Error ? error.message : "프로필을 불러오지 못했습니다."
        );
        setProfile(null);
        setIsProfileReady(true);
      }
    };

    void Promise.resolve().then(loadProfile);

    return () => {
      isActive = false;
    };
  }, [ensureReviewNickname, user]);

  const nickname = profile?.nickname?.trim() ?? "";
  const nicknameChanged = profile?.nickname_changed ?? false;
  const reviewNickname = useMemo(() => nickname, [nickname]);

  const updateNickname = useCallback(
    async (value: string) => {
      if (!supabase || !user) {
        setProfileError("로그인이 필요합니다.");
        return false;
      }

      if (nicknameChanged) {
        setProfileError("닉네임은 최초 1회만 변경할 수 있습니다.");
        return false;
      }

      const validation = validateNickname(value);

      if (validation.message) {
        setProfileError(validation.message);
        return false;
      }

      setProfileError("");

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_profiles")
        .upsert(
          {
            id: user.id,
            nickname: validation.nickname,
            nickname_changed: true,
            updated_at: now,
          },
          { onConflict: "id" }
        )
        .select("*")
        .single();

      if (error) {
        setProfileError(error.message);
        return false;
      }

      setProfile(data);
      return true;
    },
    [nicknameChanged, user]
  );

  return {
    canChangeNickname: Boolean(user) && !nicknameChanged,
    ensureReviewNickname,
    isProfileReady,
    nickname,
    nicknameChanged,
    profileError,
    reviewNickname,
    updateNickname,
  };
}
