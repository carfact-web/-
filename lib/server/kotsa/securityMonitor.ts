import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getKotsaHealth } from "@/lib/server/kotsa/health";

type SecurityAlertSeverity = "critical" | "high" | "warning";

interface SecurityAlertInput {
  alertType: string;
  blocked?: boolean;
  endpoint: string;
  metadata?: Record<string, string | number | boolean | null>;
  recentFailureCount?: number;
  requestId?: string | null;
  requestIp: string | null;
  severity?: SecurityAlertSeverity;
  statusCode?: number | null;
  userId?: string | null;
}

export interface KotsaMaintenanceMode {
  enabled: boolean;
  expectedEndAt: string | null;
  message: string;
  reason: string | null;
  startedAt: string | null;
  updatedAt: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const alertCooldownMs = 5 * 60 * 1000;
const lastSecurityAlertAt = new Map<string, number>();

const getSecuritySupabaseAdmin = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
};

const shouldNotify = (key: string) => {
  const now = Date.now();
  const lastSentAt = lastSecurityAlertAt.get(key) ?? 0;

  if (now - lastSentAt < alertCooldownMs) {
    return false;
  }

  lastSecurityAlertAt.set(key, now);
  return true;
};

const sendTelegramSecurityAlert = async ({
  alertType,
  blocked,
  endpoint,
  metadata,
  recentFailureCount,
  requestId,
  requestIp,
  severity,
  statusCode,
  userId,
}: SecurityAlertInput) => {
  const token = process.env.KOTSA_ALERT_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.KOTSA_ALERT_TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      disable_web_page_preview: true,
      text: [
        "[Carfact Security Alert]",
        `type: ${alertType}`,
        `severity: ${severity ?? "warning"}`,
        `time: ${new Date().toISOString()}`,
        `ip: ${requestIp ?? "-"}`,
        `user_id: ${userId ?? "-"}`,
        `request_id: ${requestId ?? "-"}`,
        `endpoint: ${endpoint}`,
        `status_code: ${statusCode ?? "-"}`,
        `recent_5m_failures: ${recentFailureCount ?? 0}`,
        `blocked: ${blocked ? "yes" : "no"}`,
        `circuit_state: ${getKotsaHealth().circuitState}`,
        ...(metadata?.maintenance_expected_end_at
          ? [`maintenance_expected_end_at: ${metadata.maintenance_expected_end_at}`]
          : []),
        ...(metadata?.maintenance_reason
          ? [`maintenance_reason: ${String(metadata.maintenance_reason).slice(0, 120)}`]
          : []),
      ].join("\n"),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
};

export const getClientIpFromRequest = (request: Request) => {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  const trustCloudflare = process.env.TRUST_CLOUDFLARE === "true";

  if (trustCloudflare && cloudflareIp) {
    return cloudflareIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "";
  }

  return request.headers.get("x-real-ip") ?? "";
};

export const getClientIpInfoFromRequest = (request: Request) => {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const trustCloudflare = process.env.TRUST_CLOUDFLARE === "true";
  const clientIp = getClientIpFromRequest(request);

  return {
    clientIp,
    cloudflareEnabled: trustCloudflare,
    proxyDetected: Boolean(cloudflareIp || forwardedFor),
  };
};

export const isRequestIpBlocked = async (requestIp: string | null) => {
  if (!requestIp) {
    return false;
  }

  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return false;
  }

  const { data } = await admin
    .from("security_blocked_ips")
    .select("ip,expires_at")
    .eq("ip", requestIp)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return false;
  }

  return !data.expires_at || new Date(data.expires_at).getTime() > Date.now();
};

export const isKotsaEmergencyStopped = async () => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return false;
  }

  const { data } = await admin
    .from("kotsa_operation_settings")
    .select("numeric_value")
    .eq("setting_key", "kotsa_emergency_stop")
    .maybeSingle();

  return Number(data?.numeric_value ?? 0) === 1;
};

export const getKotsaMaintenanceMode = async (): Promise<KotsaMaintenanceMode> => {
  const admin = getSecuritySupabaseAdmin();
  const fallbackMessage =
    "현재 서비스 점검 중입니다. 잠시 후 다시 이용해주세요.";

  if (!admin) {
    return {
      enabled: false,
      expectedEndAt: null,
      message: fallbackMessage,
      reason: null,
      startedAt: null,
      updatedAt: null,
    };
  }

  const { data } = await admin
    .from("kotsa_operation_settings")
    .select("setting_key,numeric_value,text_value,updated_at")
    .in("setting_key", [
      "maintenance_mode_enabled",
      "maintenance_expected_end_at",
      "maintenance_message",
      "maintenance_reason",
      "maintenance_started_at",
    ]);

  const settings = new Map(
    ((data as {
      numeric_value: number | null;
      setting_key: string;
      text_value: string | null;
      updated_at: string | null;
    }[]) ?? []).map((row) => [row.setting_key, row]),
  );
  const enabledRow = settings.get("maintenance_mode_enabled");

  return {
    enabled: Number(enabledRow?.numeric_value ?? 0) === 1,
    expectedEndAt: settings.get("maintenance_expected_end_at")?.text_value ?? null,
    message: settings.get("maintenance_message")?.text_value || fallbackMessage,
    reason: settings.get("maintenance_reason")?.text_value ?? null,
    startedAt: settings.get("maintenance_started_at")?.text_value ?? null,
    updatedAt: enabledRow?.updated_at ?? null,
  };
};

export const setKotsaMaintenanceMode = async ({
  enabled,
  expectedEndAt,
  message,
  reason,
}: {
  enabled: boolean;
  expectedEndAt?: string | null;
  message?: string | null;
  reason?: string | null;
}) => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    throw new Error("Supabase server configuration is missing.");
  }

  const now = new Date().toISOString();
  const rows = [
    {
      label: "Maintenance Mode 활성화 여부",
      numeric_value: enabled ? 1 : 0,
      setting_key: "maintenance_mode_enabled",
      text_value: null,
      updated_at: now,
    },
    {
      label: "Maintenance Mode 시작 시간",
      numeric_value: null,
      setting_key: "maintenance_started_at",
      text_value: enabled ? now : null,
      updated_at: now,
    },
    {
      label: "Maintenance Mode 예상 종료 시간",
      numeric_value: null,
      setting_key: "maintenance_expected_end_at",
      text_value: enabled ? expectedEndAt ?? null : null,
      updated_at: now,
    },
    {
      label: "Maintenance Mode 안내 문구",
      numeric_value: null,
      setting_key: "maintenance_message",
      text_value:
        message?.trim() ||
        "현재 서비스 점검 중입니다. 잠시 후 다시 이용해주세요.",
      updated_at: now,
    },
    {
      label: "Maintenance Mode 사유",
      numeric_value: null,
      setting_key: "maintenance_reason",
      text_value: enabled ? reason?.trim() || null : null,
      updated_at: now,
    },
  ];
  const { error } = await admin
    .from("kotsa_operation_settings")
    .upsert(rows, { onConflict: "setting_key" });

  if (error) {
    throw new Error(error.message);
  }
};

export const setKotsaEmergencyStop = async (enabled: boolean) => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    throw new Error("Supabase server configuration is missing.");
  }

  const { error } = await admin
    .from("kotsa_operation_settings")
    .update({
      numeric_value: enabled ? 1 : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("setting_key", "kotsa_emergency_stop");

  if (error) {
    throw new Error(error.message);
  }
};

export const logSecurityAlert = async (input: SecurityAlertInput) => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return;
  }

  await admin.from("security_alert_logs").insert({
    alert_type: input.alertType,
    blocked: Boolean(input.blocked),
    endpoint: input.endpoint,
    metadata: input.metadata ?? {},
    recent_failure_count: input.recentFailureCount ?? 0,
    request_id: input.requestId ?? null,
    request_ip: input.requestIp,
    severity: input.severity ?? "warning",
    status_code: input.statusCode ?? null,
    user_id: input.userId ?? null,
  });

  if (shouldNotify(input.alertType + ":" + (input.requestIp ?? "global"))) {
    await sendTelegramSecurityAlert(input);
  }
};

const getRecentKotsaAuditCount = async ({
  requestIp,
  statuses,
}: {
  requestIp?: string | null;
  statuses?: string[];
}) => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return 0;
  }

  let query = admin
    .from("kotsa_api_audit_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if (requestIp) {
    query = query.eq("request_ip", requestIp);
  }

  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  const { count } = await query;

  return count ?? 0;
};

export const evaluateKotsaSecuritySignals = async ({
  endpoint,
  requestId,
  requestIp,
  status,
  statusCode,
  userId,
}: {
  endpoint: string;
  requestId: string;
  requestIp: string | null;
  status: string;
  statusCode?: number | null;
  userId: string | null;
}) => {
  const failedStatuses = [
    "configuration_error",
    "circuit_open",
    "emergency_stop",
    "error",
    "ip_blocked",
    "rate_limited",
    "unauthorized",
    "validation_error",
  ];
  const [ipAttemptCount, ipFailureCount, rateLimitedCount, authErrorCount, serverErrorCount] =
    await Promise.all([
      getRecentKotsaAuditCount({ requestIp }),
      getRecentKotsaAuditCount({ requestIp, statuses: failedStatuses }),
      getRecentKotsaAuditCount({ requestIp, statuses: ["rate_limited"] }),
      getRecentKotsaAuditCount({
        statuses: ["ip_blocked", "rate_limited", "unauthorized"],
      }),
      getRecentKotsaAuditCount({ statuses: ["configuration_error"] }),
    ]);

  if (requestIp && ipAttemptCount >= 20) {
    await logSecurityAlert({
      alertType: "kotsa_ip_attempt_spike",
      endpoint,
      recentFailureCount: ipFailureCount,
      requestId,
      requestIp,
      statusCode,
      userId,
    });
  }

  if (requestIp && ipFailureCount >= 5) {
    await logSecurityAlert({
      alertType: "kotsa_ip_failure_repeat",
      endpoint,
      recentFailureCount: ipFailureCount,
      requestId,
      requestIp,
      statusCode,
      userId,
    });
  }

  if (requestIp && rateLimitedCount >= 3) {
    await logSecurityAlert({
      alertType: "rate_limit_repeat",
      endpoint,
      recentFailureCount: rateLimitedCount,
      requestId,
      requestIp,
      statusCode: 429,
      userId,
    });
  }

  if (authErrorCount >= 10) {
    await logSecurityAlert({
      alertType: "auth_error_spike",
      endpoint,
      recentFailureCount: authErrorCount,
      requestId,
      requestIp,
      statusCode,
      userId,
    });
  }

  if (serverErrorCount >= 5) {
    await logSecurityAlert({
      alertType: "server_500_spike",
      endpoint,
      recentFailureCount: serverErrorCount,
      requestId,
      requestIp,
      severity: "critical",
      statusCode: 500,
      userId,
    });
  }

  if (status === "circuit_open") {
    await logSecurityAlert({
      alertType: "circuit_breaker_open",
      endpoint,
      recentFailureCount: ipFailureCount,
      requestId,
      requestIp,
      severity: "critical",
      statusCode: 503,
      userId,
    });
  }
};

export const recordAdminAccessFailure = async ({
  endpoint,
  requestIp,
  statusCode,
  userId,
}: {
  endpoint: string;
  requestIp: string | null;
  statusCode: number;
  userId?: string | null;
}) => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return;
  }

  await admin.from("security_alert_logs").insert({
    alert_type: "admin_access_failed",
    endpoint,
    recent_failure_count: 0,
    request_ip: requestIp,
    severity: "warning",
    status_code: statusCode,
    user_id: userId ?? null,
  });

  const { count } = await admin
    .from("security_alert_logs")
    .select("id", { count: "exact", head: true })
    .eq("alert_type", "admin_access_failed")
    .eq("request_ip", requestIp ?? "")
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if ((count ?? 0) >= 5) {
    await logSecurityAlert({
      alertType: "admin_access_failed_repeat",
      endpoint,
      recentFailureCount: count ?? 0,
      requestIp,
      severity: "critical",
      statusCode,
      userId: userId ?? null,
    });
  }

  if (statusCode === 500) {
    const { count: serverErrorCount } = await admin
      .from("security_alert_logs")
      .select("id", { count: "exact", head: true })
      .eq("status_code", 500)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if ((serverErrorCount ?? 0) >= 5) {
      await logSecurityAlert({
        alertType: "server_500_spike",
        endpoint,
        recentFailureCount: serverErrorCount ?? 0,
        requestIp,
        severity: "critical",
        statusCode,
        userId: userId ?? null,
      });
    }
  }
};

export const recordAdminAccessSuccess = async ({
  endpoint,
  requestIp,
  userId,
}: {
  endpoint: string;
  requestIp: string | null;
  userId: string;
}) => {
  if (!requestIp) {
    return;
  }

  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return;
  }

  const { data: existing } = await admin
    .from("admin_known_ips")
    .select("ip")
    .eq("user_id", userId)
    .eq("ip", requestIp)
    .maybeSingle();

  await admin.from("admin_known_ips").upsert({
    ip: requestIp,
    last_seen_at: new Date().toISOString(),
    user_id: userId,
  });

  if (!existing) {
    await logSecurityAlert({
      alertType: "admin_login_success_new_ip",
      endpoint,
      requestIp,
      severity: "high",
      statusCode: 200,
      userId,
    });
  }
};

export const recordApiNotFound = async ({
  endpoint,
  requestIp,
}: {
  endpoint: string;
  requestIp: string | null;
}) => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return;
  }

  await admin.from("security_alert_logs").insert({
    alert_type: "api_not_found_attempt",
    endpoint,
    request_ip: requestIp,
    severity: "warning",
    status_code: 404,
  });

  const { count } = await admin
    .from("security_alert_logs")
    .select("id", { count: "exact", head: true })
    .eq("alert_type", "api_not_found_attempt")
    .eq("request_ip", requestIp ?? "")
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if ((count ?? 0) >= 5) {
    await logSecurityAlert({
      alertType: "api_not_found_repeat",
      endpoint,
      recentFailureCount: count ?? 0,
      requestIp,
      statusCode: 404,
    });
  }
};

const getPercentile = (values: number[], percentile: number) => {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    Math.max(Math.ceil((percentile / 100) * sorted.length) - 1, 0),
    sorted.length - 1,
  );

  return sorted[index];
};

const getSecurityPeriodStats = async (
  admin: SupabaseClient,
  days: number,
) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [alertsResult, auditsResult] = await Promise.all([
    admin
      .from("security_alert_logs")
      .select("alert_type,status_code,created_at")
      .gte("created_at", since)
      .limit(20000),
    admin
      .from("kotsa_api_audit_logs")
      .select("status,response_time_ms,created_at")
      .gte("created_at", since)
      .limit(20000),
  ]);
  const alerts =
    (alertsResult.data as {
      alert_type: string;
      status_code: number | null;
    }[]) ?? [];
  const audits =
    (auditsResult.data as {
      response_time_ms: number | null;
      status: string;
    }[]) ?? [];
  const responseTimes = audits
    .map((row) => row.response_time_ms)
    .filter((value): value is number => typeof value === "number");
  const countStatus = (statusCode: number) =>
    alerts.filter((row) => row.status_code === statusCode).length;
  const countAlert = (alertType: string) =>
    alerts.filter((row) => row.alert_type === alertType).length;

  return {
    averageResponseMs: responseTimes.length
      ? Math.round(
          responseTimes.reduce((sum, value) => sum + value, 0) /
            responseTimes.length,
        )
      : null,
    blockedIp: alerts.filter((row) => row.alert_type.includes("ip_block"))
      .length,
    circuitOpen:
      countAlert("circuit_breaker_open") +
      audits.filter((row) => row.status === "circuit_open").length,
    cloudflareBlock: countAlert("cloudflare_block"),
    emergencyStop:
      countAlert("kotsa_emergency_stop_enabled") +
      audits.filter((row) => row.status === "emergency_stop").length,
    fail2ban: countAlert("fail2ban_block"),
    http401: countStatus(401),
    http403: countStatus(403),
    http404: countStatus(404),
    http429: countStatus(429),
    http500: countStatus(500),
    p95ResponseMs: getPercentile(responseTimes, 95),
    p99ResponseMs: getPercentile(responseTimes, 99),
  };
};

export const getKotsaSecuritySummary = async () => {
  const admin = getSecuritySupabaseAdmin();

  if (!admin) {
    return {
      backupLastCheckedAt: null,
      backupStatus: {
        certificateBackupLastAt: null,
        databaseBackupLastAt: null,
        isBackupFresh: false,
        lastSuccess: false,
        pitrEnabled: null,
        storageBackupLastAt: null,
      },
      blockedIps: [],
      cloudflare: {
        clientIp: null,
        enabled: process.env.TRUST_CLOUDFLARE === "true",
        proxyDetected: false,
      },
    emergencyStop: false,
    maintenanceMode: {
      enabled: false,
      expectedEndAt: null,
      message: "현재 서비스 점검 중입니다. 잠시 후 다시 이용해주세요.",
      reason: null,
      startedAt: null,
      updatedAt: null,
    },
      fail2banRecentBlocks: 0,
      firewallStatus: "22 SSH / 80 HTTP / 443 HTTPS / others DROP",
      recentAlerts: [],
      recentStatusCounts: { unauthorized: 0, forbidden: 0, serverError: 0 },
      securityScore: { deductions: ["Supabase unavailable"], value: 0 },
      securityStats: {
        last30d: null,
        last7d: null,
        today: null,
      },
      timeline: [],
    };
  }

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const [
    emergencyStop,
    maintenanceMode,
    alertsResult,
    blockedIpsResult,
    backupResult,
    pitrResult,
    dbBackupResult,
    storageBackupResult,
    certificateBackupResult,
    backupSuccessResult,
    unauthorizedResult,
    forbiddenResult,
    serverErrorResult,
    todayStats,
    last7dStats,
    last30dStats,
  ] = await Promise.all([
    isKotsaEmergencyStopped(),
    getKotsaMaintenanceMode(),
    admin
      .from("security_alert_logs")
      .select("alert_type,severity,endpoint,request_ip,blocked,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("security_blocked_ips")
      .select("ip,reason,is_active,expires_at,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("kotsa_operation_settings")
      .select("text_value,updated_at")
      .eq("setting_key", "supabase_backup_last_checked_at")
      .maybeSingle(),
    admin
      .from("kotsa_operation_settings")
      .select("numeric_value")
      .eq("setting_key", "supabase_pitr_enabled")
      .maybeSingle(),
    admin
      .from("kotsa_operation_settings")
      .select("text_value")
      .eq("setting_key", "database_backup_last_at")
      .maybeSingle(),
    admin
      .from("kotsa_operation_settings")
      .select("text_value")
      .eq("setting_key", "storage_backup_last_at")
      .maybeSingle(),
    admin
      .from("kotsa_operation_settings")
      .select("text_value")
      .eq("setting_key", "certificate_backup_last_at")
      .maybeSingle(),
    admin
      .from("kotsa_operation_settings")
      .select("numeric_value")
      .eq("setting_key", "backup_last_success")
      .maybeSingle(),
    admin
      .from("security_alert_logs")
      .select("id", { count: "exact", head: true })
      .eq("status_code", 401)
      .gte("created_at", since),
    admin
      .from("security_alert_logs")
      .select("id", { count: "exact", head: true })
      .eq("status_code", 403)
      .gte("created_at", since),
    admin
      .from("security_alert_logs")
      .select("id", { count: "exact", head: true })
      .eq("status_code", 500)
      .gte("created_at", since),
    getSecurityPeriodStats(admin, 1),
    getSecurityPeriodStats(admin, 7),
    getSecurityPeriodStats(admin, 30),
  ]);
  const databaseBackupLastAt =
    dbBackupResult.data?.text_value ??
    backupResult.data?.text_value ??
    backupResult.data?.updated_at ??
    null;
  const storageBackupLastAt = storageBackupResult.data?.text_value ?? null;
  const certificateBackupLastAt =
    certificateBackupResult.data?.text_value ?? null;
  const backupTimes = [
    databaseBackupLastAt,
    storageBackupLastAt,
    certificateBackupLastAt,
  ].filter((value): value is string => Boolean(value));
  const oldestBackupAt = backupTimes.length
    ? Math.min(...backupTimes.map((value) => new Date(value).getTime()))
    : 0;
  const isBackupFresh =
    oldestBackupAt > 0 && Date.now() - oldestBackupAt <= 24 * 60 * 60 * 1000;
  const pitrEnabled =
    pitrResult.data?.numeric_value === null ||
    pitrResult.data?.numeric_value === undefined
      ? null
      : Number(pitrResult.data.numeric_value) === 1;
  const backupLastSuccess =
    Number(backupSuccessResult.data?.numeric_value ?? 0) === 1;
  const deductions: string[] = [];

  if (getKotsaHealth().certificateStatus !== "ok") deductions.push("인증서 점검");
  if (!process.env.KOTSA_ALERT_TELEGRAM_BOT_TOKEN) deductions.push("Telegram 미설정");
  if (!isBackupFresh || !backupLastSuccess) deductions.push("Backup 미확인");
  if (!pitrEnabled) deductions.push("PITR 미확인");
  if (process.env.TRUST_CLOUDFLARE !== "true") deductions.push("Cloudflare 미신뢰");
  if (emergencyStop) deductions.push("Emergency Stop ON");
  if (maintenanceMode.enabled) deductions.push("Maintenance Mode ON");
  if (!alertsResult.data) deductions.push("Audit 확인 실패");
  const securityScore = Math.max(100 - deductions.length * 2, 0);

  if (!isBackupFresh || !backupLastSuccess) {
    await logSecurityAlert({
      alertType: "backup_check_stale",
      endpoint: "/api/admin/kotsa-health",
      recentFailureCount: 1,
      requestIp: null,
      severity: "high",
      statusCode: 200,
    });
  }

  return {
    backupLastCheckedAt:
      backupResult.data?.text_value ?? backupResult.data?.updated_at ?? null,
    backupStatus: {
      certificateBackupLastAt,
      databaseBackupLastAt,
      isBackupFresh,
      lastSuccess: backupLastSuccess,
      pitrEnabled,
      storageBackupLastAt,
    },
    blockedIps: blockedIpsResult.data ?? [],
    cloudflare: {
      clientIp: null,
      enabled: process.env.TRUST_CLOUDFLARE === "true",
      proxyDetected: false,
    },
    emergencyStop,
    maintenanceMode,
    fail2banRecentBlocks: todayStats.fail2ban,
    firewallStatus: "22 SSH / 80 HTTP / 443 HTTPS / others DROP",
    recentAlerts: alertsResult.data ?? [],
    recentStatusCounts: {
      forbidden: forbiddenResult.count ?? 0,
      serverError: serverErrorResult.count ?? 0,
      unauthorized: unauthorizedResult.count ?? 0,
    },
    securityScore: { deductions, value: securityScore },
    securityStats: {
      last30d: last30dStats,
      last7d: last7dStats,
      today: todayStats,
    },
    timeline: (alertsResult.data ?? []).map((alert) => ({
      at: alert.created_at,
      label: alert.alert_type,
    })),
  };
};
