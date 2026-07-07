import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";

export type KotsaUserTier = "admin" | "general" | "verified_dealer";

interface KotsaLimitPolicies {
  general: number;
  ip: number;
  verifiedDealer: number;
}

const defaultPolicies: KotsaLimitPolicies = {
  general: 5,
  ip: 100,
  verifiedDealer: 20,
};

const getTodayStartIso = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
};

export const getKotsaUserTier = ({
  isAdmin,
  isVerifiedDealer,
}: {
  isAdmin: boolean;
  isVerifiedDealer: boolean;
}): KotsaUserTier => {
  if (isAdmin) {
    return "admin";
  }

  return isVerifiedDealer ? "verified_dealer" : "general";
};

export const getKotsaLimitPolicies = async (): Promise<KotsaLimitPolicies> => {
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return defaultPolicies;
  }

  const { data, error } = await clients.admin
    .from("kotsa_query_limit_policies")
    .select("policy_key,daily_limit,temporary_daily_limit,temporary_expires_at");

  if (error || !data) {
    return defaultPolicies;
  }

  const policies = { ...defaultPolicies };

  const now = Date.now();

  for (const row of data as {
    daily_limit: number | null;
    policy_key: string;
    temporary_daily_limit: number | null;
    temporary_expires_at: string | null;
  }[]) {
    const temporaryLimit =
      row.temporary_daily_limit !== null &&
      row.temporary_expires_at &&
      new Date(row.temporary_expires_at).getTime() > now
        ? row.temporary_daily_limit
        : null;
    const effectiveLimit = temporaryLimit ?? row.daily_limit;

    if (row.policy_key === "general" && effectiveLimit !== null) {
      policies.general = effectiveLimit;
    }

    if (row.policy_key === "verified_dealer" && effectiveLimit !== null) {
      policies.verifiedDealer = effectiveLimit;
    }

    if (row.policy_key === "ip" && effectiveLimit !== null) {
      policies.ip = effectiveLimit;
    }
  }

  return policies;
};

export const checkKotsaDailyQuota = async ({
  requestIp,
  tier,
  userId,
}: {
  requestIp: string | null;
  tier: KotsaUserTier;
  userId: string;
}) => {
  const clients = getSupabaseAdminClients();
  const policies = await getKotsaLimitPolicies();

  if (!clients || tier === "admin") {
    return {
      allowed: true,
      limit: null,
      remaining: null,
      used: 0,
    };
  }

  const todayStart = getTodayStartIso();
  const tierLimit =
    tier === "verified_dealer" ? policies.verifiedDealer : policies.general;
  const [{ count: userCount }, { count: ipCount }] = await Promise.all([
    clients.admin
      .from("kotsa_api_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("counted_against_quota", true)
      .gte("created_at", todayStart),
    requestIp
      ? clients.admin
          .from("kotsa_api_audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("request_ip", requestIp)
          .eq("counted_against_quota", true)
          .gte("created_at", todayStart)
      : Promise.resolve({ count: 0 }),
  ]);
  const userUsed = userCount ?? 0;
  const ipUsed = ipCount ?? 0;
  const userRemaining = Math.max(tierLimit - userUsed, 0);
  const ipRemaining = Math.max(policies.ip - ipUsed, 0);
  const allowed = userRemaining > 0 && ipRemaining > 0;

  return {
    allowed,
    ipLimit: policies.ip,
    ipRemaining,
    ipUsed,
    limit: tierLimit,
    remaining: Math.min(userRemaining, ipRemaining),
    used: userUsed,
  };
};
