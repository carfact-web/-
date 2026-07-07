import { getKotsaConfig } from "@/lib/server/kotsa/config";
import {
  decryptKotsaPayload,
  encryptKotsaPayload,
} from "@/lib/server/kotsa/security";
import {
  normalizeKotsaVehicleHistory,
} from "@/lib/server/kotsa/normalize";
import type { KotsaVehicleHistory } from "@/types/kotsa";
import {
  assertKotsaCircuitAllowsRequest,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "@/lib/server/kotsa/circuitBreaker";

interface VehicleHistoryRequest {
  vehicleNumber: string;
}

export class KotsaApiError extends Error {
  responseCode: string | null;
  status: number;

  constructor(message: string, status = 502, responseCode: string | null = null) {
    super(message);
    this.name = "KotsaApiError";
    this.responseCode = responseCode;
    this.status = status;
  }
}

const linkInfoCd = "AC1_ZA90_01";
const picId = "carfact";
const picIpAddr = "95.217.167.210";
const picNm = "박신";
const requestTimeoutMs = 8 * 1000;
const max5xxRetries = 2;

const parseEncryptedResponseBody = async (response: Response) => {
  const text = (await response.text()).trim();

  if (!text) {
    throw new KotsaApiError("KOTSA response body is empty.");
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // KOTSA returns the encrypted Base64 package as the whole response body.
  }

  return text.replace(/^"|"$/g, "");
};

const createRequestPayload = ({ vehicleNumber }: VehicleHistoryRequest) =>
  JSON.stringify({
    data: [
      {
        linkInfoCd,
        picId,
        picNm,
        picIpAddr,
        vhclNo: vehicleNumber,
      },
    ],
  });

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new KotsaApiError("KOTSA request timed out.", 504);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWith5xxRetry = async (url: string, init: RequestInit) => {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= max5xxRetries; attempt += 1) {
    const response = await fetchWithTimeout(url, init);

    if (response.status < 500 || response.status > 599) {
      return response;
    }

    lastResponse = response;
  }

  if (!lastResponse) {
    throw new KotsaApiError("KOTSA request failed before receiving response.");
  }

  return lastResponse;
};

export const fetchKotsaVehicleHistory = async ({
  vehicleNumber,
}: VehicleHistoryRequest): Promise<KotsaVehicleHistory> => {
  assertKotsaCircuitAllowsRequest();

  const config = getKotsaConfig();
  const encryptedRequest = await encryptKotsaPayload(
    createRequestPayload({ vehicleNumber }),
    config,
  );
  const startedAt = Date.now();

  try {
    const response = await fetchWith5xxRetry(config.apiBaseUrl, {
      body: encryptedRequest,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        cvmis_apikey: config.apiKey,
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new KotsaApiError(`KOTSA HTTP ${response.status}`, 502);
    }

    const encryptedResponse = await parseEncryptedResponseBody(response);
    const decryptedResponse = await decryptKotsaPayload(
      encryptedResponse,
      config,
    );
    const parsed = JSON.parse(decryptedResponse) as unknown;
    const normalized = normalizeKotsaVehicleHistory(parsed);

    if (normalized.responseCode && normalized.responseCode !== "MSG50000") {
      throw new KotsaApiError(
        normalized.responseMessage ?? "KOTSA business response failed.",
        502,
        normalized.responseCode,
      );
    }

    recordCircuitSuccess(Date.now() - startedAt);

    return normalized;
  } catch (error) {
    const responseTimeMs = Date.now() - startedAt;
    const message =
      error instanceof Error ? error.message : "KOTSA request failed.";

    recordCircuitFailure(responseTimeMs, message);
    throw error;
  }
};
