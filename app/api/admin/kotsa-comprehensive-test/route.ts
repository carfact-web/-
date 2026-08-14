import { NextRequest, NextResponse } from "next/server";
import {
  fetchKotsaComprehensiveInfo,
  getKotsaComprehensiveFirstRow,
  KotsaComprehensiveApiError,
} from "@/lib/server/kotsa-comprehensive/client";
import { checkKotsaRateLimit } from "@/lib/server/kotsa/rateLimit";
import { getClientIpFromRequest } from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";
import {
  maskVehicleNumber,
  normalizeVehicleNumber,
} from "@/lib/server/kotsa/vehicleNumber";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TestRequest {
  vehicleNumber?: unknown;
}

const sensitiveKeyPattern =
  /(api.?key|apikey|cvmis|password|secret|token|cert|private.?key|vin|vhrno|vhclNo|mbrNo|brno|telno|addr)/i;

const groupLabels = {
  carBscInfo: "기본정보",
  imprmnList: "정비이력",
  spcfInfo1: "제원정보1",
  spcfInfo2: "제원정보2",
  sttusList1: "성능점검정보1",
  sttusList2: "성능점검정보2",
} as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const maskSensitiveValue = (key: string, value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  if (/vhrno|vhclNo/i.test(key)) {
    return maskVehicleNumber(value) ?? "****";
  }

  if (sensitiveKeyPattern.test(key)) {
    return value ? "[masked]" : value;
  }

  return value;
};

const maskSensitiveObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveObject(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      typeof entry === "object" && entry !== null
        ? maskSensitiveObject(entry)
        : maskSensitiveValue(key, entry),
    ]),
  );
};

const summarizeValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return {
      arrayLength: value.length,
      firstItemKeys: Object.keys(asRecord(value[0])),
      kind: "array",
      nonNullKeys: Object.entries(asRecord(value[0]))
        .filter(([, entry]) => entry !== null && entry !== "")
        .map(([key]) => key),
      sample: value.length ? maskSensitiveObject(value[0]) : null,
    };
  }

  const record = asRecord(value);

  return {
    kind: value === null ? "null" : typeof value,
    keys: Object.keys(record),
    nonNullKeys: Object.entries(record)
      .filter(([, entry]) => entry !== null && entry !== "")
      .map(([key]) => key),
    nullKeys: Object.entries(record)
      .filter(([, entry]) => entry === null || entry === "")
      .map(([key]) => key),
    sample: maskSensitiveObject(record),
  };
};

const summarizeGroups = (firstRow: Record<string, unknown>) =>
  Object.entries(groupLabels).map(([key, label]) => {
    const value = firstRow[key];
    const hasData = Array.isArray(value)
      ? value.length > 0
      : Boolean(value && typeof value === "object" && Object.keys(value).length);

    return {
      key,
      label,
      hasData,
      ...summarizeValue(value),
    };
  });

export async function POST(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { ok: false, error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const requestIp = getClientIpFromRequest(request);
  const rateLimit = checkKotsaRateLimit(
    `kotsa-comprehensive-test:${adminResult.userId ?? requestIp ?? "unknown"}`,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "조회 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
      { status: 429 },
    );
  }

  let body: TestRequest;

  try {
    body = (await request.json()) as TestRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const vehicleNumber = normalizeVehicleNumber(body.vehicleNumber);

  if (!vehicleNumber) {
    return NextResponse.json(
      { ok: false, error: "차량번호 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchKotsaComprehensiveInfo({ vehicleNumber });
    const firstRow = getKotsaComprehensiveFirstRow(result.payload);

    return NextResponse.json({
      ok: true,
      groups: summarizeGroups(firstRow),
      request: {
        vehicleNumberMasked: maskVehicleNumber(vehicleNumber),
      },
      response: {
        firstRowKeys: Object.keys(firstRow),
        maskedPayload: maskSensitiveObject(result.payload),
        responseCode: result.responseCode,
        responseMessage: result.responseMessage,
        responseTimeMs: result.responseTimeMs,
      },
    });
  } catch (error) {
    const status =
      error instanceof KotsaComprehensiveApiError ? error.status : 500;

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "KOTSA comprehensive API 처리 중 오류가 발생했습니다.",
        responseCode:
          error instanceof KotsaComprehensiveApiError
            ? error.responseCode
            : null,
      },
      { status },
    );
  }
}
