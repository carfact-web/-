import { supabase } from "@/lib/supabase";

export const verifiedDealerColor = "#2563EB";

export const fetchVerifiedDealerMap = async (userIds: Array<string | null | undefined>) => {
  if (!supabase) {
    return {};
  }

  const targetUserIds = Array.from(
    new Set(userIds.filter((userId): userId is string => Boolean(userId)))
  );

  if (targetUserIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase.rpc("list_verified_dealer_profiles", {
    target_user_ids: targetUserIds,
  });

  if (error) {
    console.warn("verified-dealer-profile-error", error);
    return {};
  }

  return (data ?? []).reduce<Record<string, boolean>>((verifiedDealers, row) => {
    if (row.is_verified_dealer) {
      verifiedDealers[row.id] = true;
    }

    return verifiedDealers;
  }, {});
};
