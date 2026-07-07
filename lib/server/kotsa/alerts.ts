import { getKotsaHealth } from "@/lib/server/kotsa/health";
import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";

const alertCooldownMs = 5 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

const shouldSendAlert = (key: string) => {
  const now = Date.now();
  const lastSentAt = lastAlertAt.get(key) ?? 0;

  if (now - lastSentAt < alertCooldownMs) {
    return false;
  }

  lastAlertAt.set(key, now);
  return true;
};

const sendTelegramAlert = async (message: string) => {
  const token = process.env.KOTSA_ALERT_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.KOTSA_ALERT_TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      disable_web_page_preview: true,
      text: message,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch(() => undefined);
};

const getRecentMetrics = async () => {
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return {
      averageResponseMs: null,
      failures5m: 0,
      timeouts10m: 0,
    };
  }

  const now = Date.now();
  const since10m = new Date(now - 10 * 60 * 1000).toISOString();
  const since5mMs = now - 5 * 60 * 1000;
  const { data } = await clients.admin
    .from("kotsa_api_audit_logs")
    .select("created_at,status,error_type,response_time_ms")
    .gte("created_at", since10m)
    .limit(1000);

  const rows =
    (data as {
      created_at: string;
      error_type: string | null;
      response_time_ms: number | null;
      status: string;
    }[]) ?? [];
  const failures5m = rows.filter(
    (row) =>
      row.status === "error" &&
      new Date(row.created_at).getTime() >= since5mMs,
  ).length;
  const timeouts10m = rows.filter((row) => row.error_type === "timeout").length;
  const responseTimes = rows
    .map((row) => row.response_time_ms)
    .filter((value): value is number => typeof value === "number");

  return {
    averageResponseMs: responseTimes.length
      ? Math.round(
          responseTimes.reduce((sum, value) => sum + value, 0) /
            responseTimes.length,
        )
      : null,
    failures5m,
    timeouts10m,
  };
};

export const evaluateKotsaFailureAlerts = async ({
  errorType,
  requestId,
  status,
}: {
  errorType: string | null;
  requestId: string;
  status: string;
}) => {
  const health = getKotsaHealth();
  const recentMetrics = await getRecentMetrics();
  const checks = [
    {
      key: "failure-5m",
      label: "5분 내 KOTSA 실패 5건 이상",
      count: recentMetrics.failures5m,
      threshold: 5,
    },
    {
      key: "timeout-10m",
      label: "10분 내 KOTSA timeout 3건 이상",
      count: recentMetrics.timeouts10m,
      threshold: 3,
    },
    {
      key: "circuit-open",
      label: "KOTSA circuit breaker open",
      count: status === "circuit_open" ? 1 : 0,
      threshold: 1,
    },
  ];

  for (const check of checks) {
    if (check.count < check.threshold || !shouldSendAlert(check.key)) {
      continue;
    }

    await sendTelegramAlert(
      [
        "[Carfact KOTSA Alert]",
        `time: ${new Date().toISOString()}`,
        `type: ${check.label}`,
        `count: ${check.count}`,
        `error_type: ${errorType ?? "unknown"}`,
        `recent_request_id: ${requestId}`,
        `circuit_state: ${health.circuitState}`,
        `recent_5m_failures: ${recentMetrics.failures5m}`,
        `recent_10m_timeouts: ${recentMetrics.timeouts10m}`,
        `average_response_ms: ${recentMetrics.averageResponseMs ?? "-"}`,
      ].join("\n"),
    );
  }
};
