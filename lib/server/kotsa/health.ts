import { X509Certificate } from "crypto";
import { readFile, stat } from "fs/promises";
import { getKotsaConfig } from "@/lib/server/kotsa/config";

type CertificateStatus = "expired" | "missing_config" | "ok" | "warning";
type ConnectionStatus = "degraded" | "not_configured" | "ok" | "unknown";

interface KotsaHealthState {
  averageResponseMs: number | null;
  certificateCheckedAt: string | null;
  certificateDaysUntilExpiration: number | null;
  certificateExpiresAt: string | null;
  certificateFileMode: string | null;
  certificatePermissionOk: boolean | null;
  certificateStatus: CertificateStatus;
  circuitOpenedUntil: string | null;
  circuitState: "closed" | "half_open" | "open";
  consecutiveFailures: number;
  connectionStatus: ConnectionStatus;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  lastSuccessAt: string | null;
  startupWarnings: string[];
}

const defaultHealthState: KotsaHealthState = {
  averageResponseMs: null,
  certificateCheckedAt: null,
  certificateDaysUntilExpiration: null,
  certificateExpiresAt: null,
  certificateFileMode: null,
  certificatePermissionOk: null,
  certificateStatus: "missing_config",
  circuitOpenedUntil: null,
  circuitState: "closed",
  consecutiveFailures: 0,
  connectionStatus: "unknown",
  lastFailureAt: null,
  lastFailureMessage: null,
  lastSuccessAt: null,
  startupWarnings: [],
};

const globalForKotsa = globalThis as typeof globalThis & {
  __carfactKotsaHealth?: KotsaHealthState;
};

const state = globalForKotsa.__carfactKotsaHealth ?? defaultHealthState;
globalForKotsa.__carfactKotsaHealth = state;

const toFileMode = (mode: number) => "0" + (mode & 0o777).toString(8);

const setStartupWarnings = (warnings: string[]) => {
  state.startupWarnings = warnings;

  for (const warning of warnings) {
    console.warn("[kotsa] " + warning);
  }
};

export const runKotsaStartupChecks = async () => {
  const warnings: string[] = [];

  try {
    const config = getKotsaConfig();
    const [certificateBuffer, certificateStat, privateKeyStat] =
      await Promise.all([
        readFile(config.certificatePath),
        stat(config.certificatePath),
        stat(config.privateKeyPath),
      ]);
    const certificate = new X509Certificate(certificateBuffer);
    const expiresAt = new Date(certificate.validTo);
    const now = Date.now();
    const daysUntilExpiration = Math.ceil(
      (expiresAt.getTime() - now) / (24 * 60 * 60 * 1000),
    );
    const certificateMode = toFileMode(certificateStat.mode);
    const privateKeyMode = toFileMode(privateKeyStat.mode);
    const permissionOk = certificateMode === "0600" && privateKeyMode === "0600";

    if (daysUntilExpiration < 0) {
      warnings.push("KOTSA certificate is expired.");
    } else if (daysUntilExpiration <= 30) {
      warnings.push("KOTSA certificate expires within 30 days.");
    }

    if (!permissionOk) {
      warnings.push("KOTSA certificate/private key file mode should be 0600.");
    }

    state.certificateCheckedAt = new Date().toISOString();
    state.certificateDaysUntilExpiration = daysUntilExpiration;
    state.certificateExpiresAt = expiresAt.toISOString();
    state.certificateFileMode = `${certificateMode}/${privateKeyMode}`;
    state.certificatePermissionOk = permissionOk;
    state.certificateStatus =
      daysUntilExpiration < 0
        ? "expired"
        : daysUntilExpiration <= 30 || !permissionOk
          ? "warning"
          : "ok";
    state.connectionStatus =
      state.lastFailureAt && !state.lastSuccessAt ? "degraded" : "unknown";
  } catch {
    warnings.push("KOTSA server configuration or certificate files are missing.");
    state.certificateCheckedAt = new Date().toISOString();
    state.certificateStatus = "missing_config";
    state.connectionStatus = "not_configured";
  }

  setStartupWarnings(warnings);
};

export const setCircuitHealth = (
  circuitState: KotsaHealthState["circuitState"],
  openedUntil: number | null,
  consecutiveFailures: number,
) => {
  state.circuitState = circuitState;
  state.circuitOpenedUntil = openedUntil
    ? new Date(openedUntil).toISOString()
    : null;
  state.consecutiveFailures = consecutiveFailures;
};

export const recordKotsaCallSuccess = (responseTimeMs: number) => {
  state.lastSuccessAt = new Date().toISOString();
  state.lastFailureMessage = null;
  state.connectionStatus = "ok";
  state.averageResponseMs =
    state.averageResponseMs === null
      ? responseTimeMs
      : Math.round(state.averageResponseMs * 0.8 + responseTimeMs * 0.2);
};

export const recordKotsaCallFailure = (
  responseTimeMs: number | null,
  message: string,
) => {
  state.lastFailureAt = new Date().toISOString();
  state.lastFailureMessage = message;
  state.connectionStatus = "degraded";

  if (responseTimeMs !== null) {
    state.averageResponseMs =
      state.averageResponseMs === null
        ? responseTimeMs
        : Math.round(state.averageResponseMs * 0.8 + responseTimeMs * 0.2);
  }
};

export const getKotsaHealth = () => ({ ...state });
