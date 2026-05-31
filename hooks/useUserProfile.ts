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

    const client = supabase;
    const loadProfile = async () => {
      setIsProfileReady(false);
      setProfileError("");

      try {
        const { data, error } = await client
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isActive) {
          return;
        }

        if (error) {
          setProfileError(error.message);
          setProfile(null);
        } else if (!data) {
          const now = new Date().toISOString();
          const { data: createdProfile, error: createError } = await client
            .from("user_profiles")
            .insert({
              user_id: user.id,
              nickname: createRandomNickname(),
              nickname_changed: false,
              created_at: now,
              updated_at: now,
            })
            .select("*")
            .single();

          if (!isActive) {
            return;
          }

          if (createError) {
            const { data: reloadedProfile, error: reloadError } = await client
              .from("user_profiles")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle();

            if (!isActive) {
              return;
            }

            if (reloadError) {
              setProfileError(reloadError.message);
              setProfile(null);
            } else {
              setProfile(reloadedProfile);
            }
          } else {
            setProfile(createdProfile);
          }
        } else if (!data.nickname?.trim()) {
          const { data: updatedProfile, error: updateError } = await client
            .from("user_profiles")
            .update({
              nickname: createRandomNickname(),
              nickname_changed: false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .select("*")
            .single();

          if (!isActive) {
            return;
          }

          if (updateError) {
            setProfileError(updateError.message);
            setProfile(data);
          } else {
            setProfile(updatedProfile);
          }
        } else {
          setProfile(data);
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
  }, [user]);

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
            user_id: user.id,
            nickname: validation.nickname,
            nickname_changed: true,
            updated_at: now,
          },
          { onConflict: "user_id" }
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
    isProfileReady,
    nickname,
    nicknameChanged,
    profileError,
    reviewNickname,
    updateNickname,
  };
}
