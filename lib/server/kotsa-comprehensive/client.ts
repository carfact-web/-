import { getKotsaComprehensiveConfig } from "@/lib/server/kotsa-comprehensive/config";
import {
  decryptKotsaPayload,
  encryptKotsaPayload,
} from "@/lib/server/kotsa/security";

interface KotsaComprehensiveRequest {
  vehicleNumber: string;
}

export class KotsaComprehensiveApiError extends Error {
  responseCode: string | null;
  status: number;

  constructor(message: string, status = 502, responseCode: string | null = null) {
    super(message);
    this.name = "KotsaComprehensiveApiError";
    this.responseCode = responseCode;
    this.status = status;
  }
}

const requestTimeoutMs = 30 * 1000;
const max5xxRetries = 2;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const createRequestPayload = ({ vehicleNumber }: KotsaComprehensiveRequest) =>
  JSON.stringify({
    data: [
      {
        vhclNo: vehicleNumber,
      },
    ],
  });

const parseEncryptedResponseBody = async (response: Response) => {
  const text = (await response.text()).trim();

  if (!text) {
    throw new KotsaComprehensiveApiError("KOTSA comprehensive response body is empty.");
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
      throw new KotsaComprehensiveApiError(
        "KOTSA comprehensive request timed out.",
        504,
      );
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
    throw new KotsaComprehensiveApiError(
      "KOTSA comprehensive request failed before receiving response.",
    );
  }

  return lastResponse;
};

export const getKotsaComprehensiveFirstRow = (payload: unknown) => {
  const root = asRecord(payload);
  const data = Array.isArray(root.data) ? root.data : [];

  return asRecord(data[0]);
};

export const fetchKotsaComprehensiveInfo = async ({
  vehicleNumber,
}: KotsaComprehensiveRequest) => {
  const config = getKotsaComprehensiveConfig();
  const encryptedRequest = await encryptKotsaPayload(
    createRequestPayload({ vehicleNumber }),
    config,
  );
  const startedAt = Date.now();

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
    throw new KotsaComprehensiveApiError(
      `KOTSA comprehensive HTTP ${response.status}`,
      502,
    );
  }

  const encryptedResponse = await parseEncryptedResponseBody(response);
  const decryptedResponse = await decryptKotsaPayload(encryptedResponse, config);
  const payload = JSON.parse(decryptedResponse) as unknown;
  const first = getKotsaComprehensiveFirstRow(payload);
  const responseCode = asString(first.rsltCd);
  const responseMessage = asString(first.rsltMsg);

  if (responseCode && responseCode !== "S") {
    throw new KotsaComprehensiveApiError(
      responseMessage ?? "KOTSA comprehensive business response failed.",
      502,
      responseCode,
    );
  }

  return {
    payload,
    responseCode,
    responseMessage,
    responseTimeMs: Date.now() - startedAt,
  };
};
