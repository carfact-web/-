import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";

export type KotsaAuditStatus =
  | "cache_hit"
  | "circuit_open"
  | "configuration_error"
  | "error"
  | "emergency_stop"
  | "ip_blocked"
  | "maintenance_mode"
  | "quota_reset"
  | "rate_limited"
  | "success"
  | "unauthorized"
  | "validation_error";

interface WriteKotsaAuditLogInput {
  countedAgainstQuota?: boolean;
  endpoint: string;
  errorType?: string | null;
  errorMessage?: string | null;
  requestIp: string | null;
  requestId: string;
  responseCode?: string | null;
  responseTimeMs?: number | null;
  status: KotsaAuditStatus;
  userAgent: string | null;
  userTier?: string | null;
  vehicleNumberHash: string | null;
  userId: string | null;
  vehicleNumberMasked: string | null;
}

export const sanitizeAuditErrorMessage = (message: string | null | undefined) => {
  if (!message) {
    return null;
  }

  return message.replace(/[A-Z0-9]{4,}(?:-[A-Z0-9]{4,}){2,}/gi, "[redacted]");
};

export const writeKotsaAuditLog = async ({
  countedAgainstQuota,
  endpoint,
  errorMessage,
  errorType,
  requestIp,
  requestId,
  responseCode,
  responseTimeMs,
  status,
  userAgent,
  userId,
  userTier,
  vehicleNumberHash,
  vehicleNumberMasked,
}: WriteKotsaAuditLogInput) => {
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return;
  }

  await clients.admin.from("kotsa_api_audit_logs").insert({
    endpoint,
    counted_against_quota: Boolean(countedAgainstQuota),
    error_type: errorType ?? null,
    error_message: sanitizeAuditErrorMessage(errorMessage),
    query_type: "KOTSA_BUSINESS_VEHICLE_HISTORY",
    request_ip: requestIp,
    request_id: requestId,
    response_code: responseCode ?? null,
    response_time_ms: responseTimeMs ?? null,
    status,
    user_agent: userAgent,
    user_id: userId,
    user_tier: userTier ?? null,
    vehicle_number_hash: vehicleNumberHash,
    vehicle_number_masked: vehicleNumberMasked,
  });
};
