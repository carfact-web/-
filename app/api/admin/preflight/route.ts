import { lookup } from "dns/promises";
import { stat } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import {
  getKotsaMaintenanceMode,
  isKotsaEmergencyStopped,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreflightStatus = "ERROR" | "OK" | "UNKNOWN" | "WARNING";

interface PreflightCheck {
  guide: string;
  key: string;
  message: string;
  status: PreflightStatus;
  title: string;
}

const execFileAsync = promisify(execFile);
const requiredTables = [
  "kotsa_api_audit_logs",
  "security_alert_logs",
  "security_blocked_ips",
  "kotsa_query_limit_policies",
  "kotsa_operation_settings",
  "admin_known_ips",
];

const getMode = async (path: string) => {
  try {
    const fileStat = await stat(path);

    return "0" + (fileStat.mode & 0o777).toString(8);
  } catch {
    return null;
  }
};

const runCommand = async (command: string, args: string[]) => {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: 2000,
      windowsHide: true,
    });

    return stdout;
  } catch {
    return null;
  }
};

const checkEnvPresence = (key: string) => Boolean(process.env[key]?.trim());

const toCheck = ({
  guide,
  key,
  message,
  status,
  title,
}: PreflightCheck): PreflightCheck => ({
  guide,
  key,
  message,
  status,
  title,
});

const scoreChecks = (checks: PreflightCheck[]) => {
  const penalty = checks.reduce((sum, check) => {
    if (check.status === "ERROR") return sum + 12;
    if (check.status === "WARNING") return sum + 5;
    if (check.status === "UNKNOWN") return sum + 3;
    return sum;
  }, 0);

  return Math.max(100 - penalty, 0);
};

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const checks: PreflightCheck[] = [];
  checks.push(
    toCheck({
      guide: "/docs/supabase-migration-runbook.md",
      key: "supabase_connection",
      message: "관리자 service role 연결이 확인됐습니다.",
      status: "OK",
      title: "Supabase 연결",
    }),
  );

  const tableResults = await Promise.all(
    requiredTables.map(async (tableName) => {
      const { error } = await adminResult.clients.admin
        .from(tableName)
        .select("*", { count: "exact", head: true })
        .limit(1);

      return { ok: !error, tableName };
    }),
  );
  const missingTables = tableResults
    .filter((result) => !result.ok)
    .map((result) => result.tableName);
  checks.push(
    toCheck({
      guide: "/docs/supabase-migration-runbook.md",
      key: "db_migration",
      message: missingTables.length
        ? "미적용 테이블: " + missingTables.join(", ")
        : "필수 테이블 접근이 확인됐습니다.",
      status: missingTables.length ? "ERROR" : "OK",
      title: "DB Migration 적용 여부",
    }),
  );

  let pitrEnabled: boolean | null = null;
  let backupLastCheckedAt: string | null = null;
  let uptimeConfigured = false;
  const { data: settings } = await adminResult.clients.admin
    .from("kotsa_operation_settings")
    .select("setting_key,numeric_value,text_value")
    .in("setting_key", [
      "supabase_pitr_enabled",
      "supabase_backup_last_checked_at",
      "uptime_monitor_configured",
    ]);

  for (const row of
    (settings as {
      numeric_value: number | null;
      setting_key: string;
      text_value: string | null;
    }[]) ?? []) {
    if (row.setting_key === "supabase_pitr_enabled") {
      pitrEnabled =
        row.numeric_value === null ? null : Number(row.numeric_value) === 1;
    }

    if (row.setting_key === "supabase_backup_last_checked_at") {
      backupLastCheckedAt = row.text_value;
    }

    if (row.setting_key === "uptime_monitor_configured") {
      uptimeConfigured = Number(row.numeric_value ?? 0) === 1;
    }
  }

  checks.push(
    toCheck({
      guide: "/docs/supabase-migration-runbook.md",
      key: "pitr",
      message:
        pitrEnabled === null
          ? "PITR 상태가 기록되지 않았습니다."
          : pitrEnabled
            ? "PITR 활성으로 기록되어 있습니다."
            : "PITR 비활성으로 기록되어 있습니다.",
      status: pitrEnabled === null ? "UNKNOWN" : pitrEnabled ? "OK" : "WARNING",
      title: "PITR 활성 여부",
    }),
  );

  checks.push(
    toCheck({
      guide: "/docs/incident-response.md",
      key: "telegram",
      message:
        checkEnvPresence("KOTSA_ALERT_TELEGRAM_BOT_TOKEN") &&
        checkEnvPresence("KOTSA_ALERT_TELEGRAM_CHAT_ID")
          ? "Telegram 알림 env가 존재합니다."
          : "Telegram 알림 env가 없습니다.",
      status:
        checkEnvPresence("KOTSA_ALERT_TELEGRAM_BOT_TOKEN") &&
        checkEnvPresence("KOTSA_ALERT_TELEGRAM_CHAT_ID")
          ? "OK"
          : "WARNING",
      title: "Telegram Alert 설정",
    }),
  );

  checks.push(
    toCheck({
      guide: "/docs/deployment-checklist.md",
      key: "kotsa_api_key",
      message: checkEnvPresence("KOTSA_API_KEY")
        ? "KOTSA API Key env가 존재합니다."
        : "KOTSA API Key env가 없습니다.",
      status: checkEnvPresence("KOTSA_API_KEY") ? "OK" : "ERROR",
      title: "KOTSA API Key 존재 여부",
    }),
  );

  const certificateMode = process.env.KOTSA_CERT_PATH
    ? await getMode(process.env.KOTSA_CERT_PATH)
    : null;
  const privateKeyMode = process.env.KOTSA_PRIVATE_KEY_PATH
    ? await getMode(process.env.KOTSA_PRIVATE_KEY_PATH)
    : null;
  checks.push(
    toCheck({
      guide: "/docs/deployment-checklist.md",
      key: "kotsa_certificate",
      message: certificateMode
        ? "인증서 파일 권한: " + certificateMode
        : "인증서 파일을 확인하지 못했습니다.",
      status: certificateMode === "0600" ? "OK" : certificateMode ? "WARNING" : "ERROR",
      title: "KOTSA 인증서 파일",
    }),
  );
  checks.push(
    toCheck({
      guide: "/docs/deployment-checklist.md",
      key: "kotsa_private_key",
      message: privateKeyMode
        ? "Private Key 파일 권한: " + privateKeyMode
        : "Private Key 파일을 확인하지 못했습니다.",
      status: privateKeyMode === "0600" ? "OK" : privateKeyMode ? "WARNING" : "ERROR",
      title: "Private Key 파일",
    }),
  );

  checks.push(
    toCheck({
      guide: "/docs/cloudflare-waf.md",
      key: "cloudflare",
      message:
        process.env.TRUST_CLOUDFLARE === "true"
          ? "Cloudflare 신뢰 모드가 활성화되어 있습니다."
          : "TRUST_CLOUDFLARE가 true가 아닙니다.",
      status: process.env.TRUST_CLOUDFLARE === "true" ? "OK" : "WARNING",
      title: "Cloudflare 설정",
    }),
  );

  const ufwStatus = await runCommand("ufw", ["status"]);
  checks.push(
    toCheck({
      guide: "/docs/hetzner-firewall.md",
      key: "firewall",
      message: ufwStatus?.includes("Status: active")
        ? "UFW active 상태입니다."
        : "Firewall 상태를 확인하지 못했거나 비활성입니다.",
      status: ufwStatus?.includes("Status: active") ? "OK" : "UNKNOWN",
      title: "Hetzner Firewall 상태",
    }),
  );

  const fail2banStatus = await runCommand("fail2ban-client", ["status"]);
  checks.push(
    toCheck({
      guide: "/docs/fail2ban.md",
      key: "fail2ban",
      message: fail2banStatus?.includes("Jail list")
        ? "Fail2Ban 상태가 확인됐습니다."
        : "Fail2Ban 상태를 확인하지 못했습니다.",
      status: fail2banStatus?.includes("Jail list") ? "OK" : "UNKNOWN",
      title: "Fail2Ban 상태",
    }),
  );

  const [emergencyStop, maintenanceMode] = await Promise.all([
    isKotsaEmergencyStopped(),
    getKotsaMaintenanceMode(),
  ]);
  checks.push(
    toCheck({
      guide: "/docs/incident-response.md",
      key: "emergency_stop",
      message: emergencyStop
        ? "Emergency Stop이 ON입니다."
        : "Emergency Stop이 OFF입니다.",
      status: emergencyStop ? "WARNING" : "OK",
      title: "Emergency Stop 상태",
    }),
  );
  checks.push(
    toCheck({
      guide: "/docs/deployment-checklist.md",
      key: "maintenance_mode",
      message: maintenanceMode.enabled
        ? "Maintenance Mode가 ON입니다."
        : "Maintenance Mode가 OFF입니다.",
      status: maintenanceMode.enabled ? "WARNING" : "OK",
      title: "Maintenance Mode 상태",
    }),
  );

  checks.push(
    toCheck({
      guide: "/docs/backup-guide.md",
      key: "backup_checked",
      message: backupLastCheckedAt
        ? "마지막 백업 확인 기록이 있습니다."
        : "백업 확인 기록이 없습니다.",
      status: backupLastCheckedAt ? "OK" : "WARNING",
      title: "Backup 최근 확인일",
    }),
  );

  checks.push(
    toCheck({
      guide: "/docs/sentry.md",
      key: "sentry",
      message: checkEnvPresence("SENTRY_DSN")
        ? "Sentry DSN env가 존재합니다."
        : "Sentry DSN은 미설정 상태입니다.",
      status: checkEnvPresence("SENTRY_DSN") ? "OK" : "UNKNOWN",
      title: "Sentry 설정",
    }),
  );

  checks.push(
    toCheck({
      guide: "/docs/uptime-monitoring.md",
      key: "uptime",
      message: uptimeConfigured
        ? "Uptime monitor 설정 완료로 기록되어 있습니다."
        : "Uptime monitor 설정 기록이 없습니다.",
      status: uptimeConfigured ? "OK" : "UNKNOWN",
      title: "UptimeRobot 설정",
    }),
  );

  const [dnsResult, sslResult] = await Promise.allSettled([
    lookup("carfact.kr"),
    fetch("https://carfact.kr", {
      method: "HEAD",
      signal: AbortSignal.timeout(2500),
    }),
  ]);
  const sslOk = sslResult.status === "fulfilled" && sslResult.value.ok;
  checks.push(
    toCheck({
      guide: "/docs/cloudflare-waf.md",
      key: "ssl_dns",
      message:
        dnsResult.status === "fulfilled" && sslOk
          ? "DNS와 HTTPS 응답이 확인됐습니다."
          : "DNS 또는 HTTPS 상태 확인이 불완전합니다.",
      status: dnsResult.status === "fulfilled" && sslOk ? "OK" : "WARNING",
      title: "SSL/DNS 상태",
    }),
  );

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    checks,
    score: scoreChecks(checks),
  });
}
