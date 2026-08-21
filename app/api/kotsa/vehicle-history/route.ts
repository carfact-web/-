import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeKotsaAuditLog } from "@/lib/server/kotsa/audit";
import { evaluateKotsaFailureAlerts } from "@/lib/server/kotsa/alerts";
import { fetchKotsaVehicleHistory, KotsaApiError } from "@/lib/server/kotsa/client";
import { KotsaCircuitOpenError } from "@/lib/server/kotsa/circuitBreaker";
import {
  fetchKotsaComprehensiveInfo,
  KotsaComprehensiveApiError,
} from "@/lib/server/kotsa-comprehensive/client";
import {
  getCachedVehicleHistory,
  getCachedVehicleHistoryFromDb,
  hashVehicleNumber,
  setCachedVehicleHistory,
  setCachedVehicleHistoryInDb,
} from "@/lib/server/kotsa/cache";
import {
  checkKotsaDailyQuota,
  getKotsaUserTier,
} from "@/lib/server/kotsa/quota";
import {
  evaluateKotsaSecuritySignals,
  getClientIpFromRequest,
  getKotsaMaintenanceMode,
  isKotsaEmergencyStopped,
} from "@/lib/server/kotsa/securityMonitor";
import {
  getSupabaseAdminClients,
  resolveKotsaAuthenticatedUser,
} from "@/lib/server/kotsa/supabaseAdmin";
import {
  maskVehicleNumber,
  normalizeVehicleNumber,
} from "@/lib/server/kotsa/vehicleNumber";
import {
  getKotsaVehicleDisplayInfo,
  isKotsaBusinessVehicle,
  toPublicKotsaVehicleHistory,
  type KotsaVehicleDisplayInfo,
  type KotsaVehicleHistory,
} from "@/types/kotsa";
import { normalizeKotsaVehicleHistory } from "@/lib/server/kotsa/normalize";
import { normalizeVehicleBrandName } from "@/utils/vehicleDisplayName";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ ok: false, error: message }, { status });

interface VehicleMasterMatch {
  candidates: Array<{
    brand: string;
    model: string;
    generation: string;
  }>;
  status: "matched" | "multiple_candidates" | "unmatched";
  vehicle: {
    id?: string;
    brand: string;
    fuelType: string;
    generation: string;
    mileage: string;
    model: string;
    year: string;
  } | null;
}

const createSuccessPayload = (
  result: KotsaVehicleHistory,
  cached: boolean,
  requestId: string,
  match: VehicleMasterMatch | null,
  vehicle: VehicleMasterMatch["vehicle"],
) => ({
  ok: true,
  businessVehicle: isKotsaBusinessVehicle(result),
  cached,
  data: toPublicKotsaVehicleHistory(result),
  display: getKotsaVehicleDisplayInfo(result),
  match,
  requestId,
  vehicle,
});

interface HandleKotsaVehicleHistoryOptions {
  commercialPlateQuota?: boolean;
}

const commercialPlateQuotaLimit = 5;
const commercialPlateQuotaWindowMs = 24 * 60 * 60 * 1000;
const commercialPlateQuotaExceededMessage =
  "24시간 조회 가능 횟수를 초과했습니다.\n동일 번호 재조회는 가능하며, 신규 번호 조회는 24시간 후 다시 이용해주세요.";

const normalizeMatchText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/mercedesbenz|mercedes|benz/g, "벤츠")
    .replace(/bmw/g, "비엠더블유")
    .replace(/[^0-9a-z가-힣]/g, "");

const getYearFromDetail = (detail: string) =>
  [...detail.matchAll(/\d{2,4}/g)]
    .map((match) => {
      const value = Number(match[0]);

      if (!Number.isFinite(value)) {
        return null;
      }

      return value >= 1000 ? value : value <= 29 ? 2000 + value : 1900 + value;
    })
    .filter((value): value is number => Boolean(value));

const buildMatchTokens = (display: KotsaVehicleDisplayInfo | null) =>
  [
    display?.manufacturer,
    display?.brand,
    display?.carName,
    display?.vehicleType,
    display?.generation,
  ]
    .flatMap((value) => (value ?? "").split(/[\s/()·,]+/))
    .map(normalizeMatchText)
    .filter((value) => value.length >= 2);

const getVehicleMasterMatch = async (
  clients: ReturnType<typeof getSupabaseAdminClients>,
  display: KotsaVehicleDisplayInfo | null,
): Promise<VehicleMasterMatch | null> => {
  if (!clients || !display) {
    return null;
  }

  const tokens = [...new Set(buildMatchTokens(display))].slice(0, 6);
  const fullQuery = normalizeMatchText(
    [display.manufacturer, display.carName, display.vehicleType]
      .filter(Boolean)
      .join(" "),
  );

  if (!fullQuery || tokens.length === 0) {
    return {
      candidates: [],
      status: "unmatched",
      vehicle: null,
    };
  }

  const selectFields =
    "id, manufacturer, model, model_detail, aliases, search_text, search_text_normalized, active_car_count";
  const runTokenQuery = () =>
    clients.admin
      .from("vehicle_master")
      .select(selectFields)
      .or(tokens.map((token) => `search_text_normalized.ilike.%${token}%`).join(","))
      .limit(80);
  const { data, error } =
    fullQuery.length >= 4
      ? await clients.admin
          .from("vehicle_master")
          .select(selectFields)
          .ilike("search_text_normalized", `%${fullQuery}%`)
          .limit(80)
      : await runTokenQuery();

  if (error) {
    return null;
  }

  let rows = data ?? [];

  if (rows.length === 0 && tokens.length > 0 && fullQuery.length >= 4) {
    const fallback = await runTokenQuery();

    if (!fallback.error) {
      rows = fallback.data ?? [];
    }
  }
  const rawYear = display.year ? Number(display.year) : null;
  const scored = rows
    .map((row) => {
      const aliases = Array.isArray(row.aliases) ? row.aliases.join(" ") : "";
      const haystack = normalizeMatchText(
        [
          row.manufacturer,
          row.model,
          row.model_detail,
          row.search_text,
          row.search_text_normalized,
          aliases,
        ].join(" "),
      );
      const score =
        (fullQuery && haystack.includes(fullQuery) ? 80 : 0) +
        tokens.reduce((total, token) => total + (haystack.includes(token) ? 12 : 0), 0) +
        (rawYear && getYearFromDetail(row.model_detail).includes(rawYear) ? 10 : 0) +
        Math.min(Number(row.active_car_count ?? 0), 20) / 10;

      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const candidates = scored.slice(0, 5).map(({ row }) => ({
    brand: row.manufacturer,
    model: row.model,
    generation: row.model_detail,
  }));
  const [best, second] = scored;
  const isConfident =
    Boolean(best) &&
    (best.score >= 55 || (best.score >= 30 && (!second || best.score - second.score >= 8)));

  if (!best || !isConfident) {
    return {
      candidates,
      status: candidates.length > 1 ? "multiple_candidates" : "unmatched",
      vehicle: null,
    };
  }

  return {
    candidates,
    status: "matched",
    vehicle: {
      brand: best.row.manufacturer,
      fuelType: display.fuelType ?? "",
      generation: best.row.model_detail,
      mileage: display.latestPerformanceMileage ?? "",
      model: best.row.model,
      year: display.year ?? "",
    },
  };
};

const getYearFromDisplay = (display: KotsaVehicleDisplayInfo | null) =>
  display?.year ||
  display?.firstRegistrationDate?.replace(/\D/g, "").slice(0, 4) ||
  "";

const upsertReviewVehicleFromKotsa = async ({
  clients,
  display,
  match,
  vehicleNumber,
}: {
  clients: ReturnType<typeof getSupabaseAdminClients>;
  display: KotsaVehicleDisplayInfo | null;
  match: VehicleMasterMatch | null;
  vehicleNumber: string;
}): Promise<VehicleMasterMatch["vehicle"]> => {
  if (!clients || !display) {
    return null;
  }

  const matchedVehicle = match?.vehicle;
  const year = matchedVehicle?.year || getYearFromDisplay(display);
  const model =
    matchedVehicle?.model ||
    display.carName ||
    display.vehicleType ||
    display.generation ||
    "";

  if (!vehicleNumber || !model || !year) {
    return null;
  }

  const brand = normalizeVehicleBrandName(
    matchedVehicle?.brand ||
      display.manufacturer ||
      display.brand ||
      "제조사 확인 필요",
  );
  const generation =
    matchedVehicle?.generation ||
    display.generation ||
    display.vehicleType ||
    "";
  const mileage =
    matchedVehicle?.mileage || display.latestPerformanceMileage || "";
  const fuelType = matchedVehicle?.fuelType || display.fuelType || "";
  const now = new Date().toISOString();
  const { data, error } = await clients.admin
    .from("vehicles")
    .upsert(
      {
        car_number: vehicleNumber,
        fuel_type: fuelType || null,
        generation: generation || null,
        manufacturer: brand,
        mileage: mileage || null,
        model,
        updated_at: now,
        year,
      },
      { onConflict: "car_number" },
    )
    .select("id,manufacturer,model,generation,year,mileage,fuel_type")
    .single();

  if (error || !data) {
    return null;
  }

  const persistedVehicle = {
    brand: data.manufacturer,
    fuelType: data.fuel_type ?? "",
    generation: data.generation ?? "",
    id: data.id,
    mileage: data.mileage ?? "",
    model: data.model,
    year: data.year,
  };

  if (match?.vehicle) {
    match.vehicle = persistedVehicle;
  }

  return persistedVehicle;
};

const checkCommercialPlateRollingQuota = async ({
  endpoint,
  tier,
  userId,
  vehicleNumberHash,
}: {
  endpoint: string;
  tier: string;
  userId: string;
  vehicleNumberHash: string;
}) => {
  if (tier === "admin") {
    return {
      allowed: true,
      limit: null,
      remaining: null,
      sameVehicleWithinWindow: false,
      used: 0,
    };
  }

  const since = new Date(Date.now() - commercialPlateQuotaWindowMs).toISOString();
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return {
      allowed: false,
      limit: commercialPlateQuotaLimit,
      remaining: 0,
      sameVehicleWithinWindow: false,
      used: 0,
    };
  }

  const { data: sameVehicleRows, error: sameVehicleError } = await clients.admin
    .from("kotsa_api_audit_logs")
    .select("id")
    .eq("endpoint", endpoint)
    .eq("user_id", userId)
    .eq("vehicle_number_hash", vehicleNumberHash)
    .gte("created_at", since)
    .in("status", ["success", "cache_hit"])
    .limit(1);

  if (sameVehicleError) {
    return {
      allowed: false,
      limit: commercialPlateQuotaLimit,
      remaining: 0,
      sameVehicleWithinWindow: false,
      used: 0,
    };
  }

  if (sameVehicleRows?.length) {
    return {
      allowed: true,
      limit: commercialPlateQuotaLimit,
      remaining: null,
      sameVehicleWithinWindow: true,
      used: null,
    };
  }

  const { data, error } = await clients.admin
    .from("kotsa_api_audit_logs")
    .select("vehicle_number_hash")
    .eq("endpoint", endpoint)
    .eq("user_id", userId)
    .eq("counted_against_quota", true)
    .gte("created_at", since);

  if (error) {
    return {
      allowed: false,
      limit: commercialPlateQuotaLimit,
      remaining: 0,
      sameVehicleWithinWindow: false,
      used: 0,
    };
  }

  const used = new Set(
    (data ?? [])
      .map((row) => row.vehicle_number_hash)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  ).size;
  const remaining = Math.max(commercialPlateQuotaLimit - used, 0);

  return {
    allowed: remaining > 0,
    limit: commercialPlateQuotaLimit,
    remaining,
    sameVehicleWithinWindow: false,
    used,
  };
};

export async function handleKotsaVehicleHistoryRequest(
  request: NextRequest,
  options: HandleKotsaVehicleHistoryOptions = {},
) {
  const endpoint = request.nextUrl.pathname;
  const requestId = randomUUID();
  const startedAt = Date.now();
  const requestIp = getClientIpFromRequest(request);
  const userAgent = request.headers.get("user-agent");
  const [authResult, maintenanceMode, emergencyStop] = await Promise.all([
    resolveKotsaAuthenticatedUser(request),
    getKotsaMaintenanceMode(),
    isKotsaEmergencyStopped(),
  ]);

  if ("error" in authResult) {
    const authError = authResult.error ?? "로그인 세션을 확인하지 못했습니다.";

    if (emergencyStop) {
      await writeKotsaAuditLog({
        endpoint,
        errorMessage: "KOTSA emergency stop is enabled.",
        requestIp,
        requestId,
        responseTimeMs: Date.now() - startedAt,
        status: "emergency_stop",
        userAgent,
        userId: null,
        vehicleNumberHash: null,
        vehicleNumberMasked: null,
      });

      const response = NextResponse.json(
        {
          ok: false,
          code: "KOTSA_EMERGENCY_STOP",
          error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요.",
          requestId,
        },
        { status: 503 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    if (maintenanceMode.enabled) {
      await writeKotsaAuditLog({
        endpoint,
        errorMessage: "Maintenance mode is enabled.",
        requestIp,
        requestId,
        responseTimeMs: Date.now() - startedAt,
        status: "maintenance_mode",
        userAgent,
        userId: null,
        vehicleNumberHash: null,
        vehicleNumberMasked: null,
      });

      const response = NextResponse.json(
        {
          ok: false,
          code: "MAINTENANCE_MODE",
          error: maintenanceMode.message,
          requestId,
        },
        { status: 503 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const auditStatus = authResult.status === 403 ? "ip_blocked" : "unauthorized";

    await writeKotsaAuditLog({
      endpoint,
      errorMessage: authError,
      requestIp,
      requestId,
      status: auditStatus,
      userAgent,
      userId: null,
      vehicleNumberHash: null,
      vehicleNumberMasked: null,
    });
    await evaluateKotsaSecuritySignals({
      endpoint,
      requestId,
      requestIp,
      status: auditStatus,
      statusCode: authResult.status ?? 401,
      userId: null,
    });

    const response = NextResponse.json(
      {
        ok: false,
        code: "LOGIN_REQUIRED",
        error: authError,
        loginPrompt: {
          adSlot: "kotsa-login-required",
          message: "KOTSA 차량 이력 조회는 회원만 사용할 수 있습니다.",
        },
      },
      { status: authResult.status ?? 401 },
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const userTier = getKotsaUserTier({
    isAdmin: authResult.isAdmin,
    isVerifiedDealer: authResult.isVerifiedDealer,
  });

  let payload: { vehicleNumber?: unknown };

  try {
    payload = (await request.json()) as { vehicleNumber?: unknown };
  } catch {
    await writeKotsaAuditLog({
      endpoint,
      errorMessage: "Invalid JSON request body.",
      requestIp,
      requestId,
      status: "validation_error",
      userAgent,
      userId: authResult.userId,
      userTier,
      vehicleNumberHash: null,
      vehicleNumberMasked: null,
    });
    await evaluateKotsaSecuritySignals({
      endpoint,
      requestId,
      requestIp,
      status: "validation_error",
      statusCode: 400,
      userId: authResult.userId,
    });

    const response = jsonError("요청 형식이 올바르지 않습니다.", 400);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const vehicleNumber = normalizeVehicleNumber(payload.vehicleNumber);
  const vehicleNumberMasked = maskVehicleNumber(vehicleNumber);
  const vehicleNumberHash = vehicleNumber ? hashVehicleNumber(vehicleNumber) : null;

  if (!vehicleNumber) {
    await writeKotsaAuditLog({
      endpoint,
      errorMessage: "Invalid vehicle number.",
      requestIp,
      requestId,
      status: "validation_error",
      userAgent,
      userId: authResult.userId,
      userTier,
      vehicleNumberHash,
      vehicleNumberMasked,
    });

    const response = jsonError("차량번호 형식이 올바르지 않습니다.", 400);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const cachedResult =
      (await getCachedVehicleHistoryFromDb(vehicleNumber)) ??
      getCachedVehicleHistory(vehicleNumber);

    const cachedDisplay = getKotsaVehicleDisplayInfo(cachedResult);
    const hasUsefulCachedDisplay = Boolean(
      cachedDisplay?.carName ||
        cachedDisplay?.year ||
        cachedDisplay?.fuelType ||
        cachedDisplay?.latestPerformanceMileage,
    );

    if (cachedResult && hasUsefulCachedDisplay) {
      setCachedVehicleHistory(vehicleNumber, cachedResult);
      const cachedMatch = await getVehicleMasterMatch(
        authResult.clients,
        cachedDisplay,
      );
      const cachedVehicle = await upsertReviewVehicleFromKotsa({
        clients: authResult.clients,
        display: cachedDisplay,
        match: cachedMatch,
        vehicleNumber,
      });

      await writeKotsaAuditLog({
        endpoint,
        requestIp,
        requestId,
        responseCode: cachedResult.responseCode ?? "CACHE_HIT",
        responseTimeMs: Date.now() - startedAt,
        status: "cache_hit",
        userAgent,
        userId: authResult.userId,
        userTier,
        vehicleNumberHash,
        vehicleNumberMasked,
      });
      await evaluateKotsaSecuritySignals({
        endpoint,
        requestId,
        requestIp,
        status: "cache_hit",
        statusCode: 200,
        userId: authResult.userId,
      });

      const response = NextResponse.json(
        createSuccessPayload(
          cachedResult,
          true,
          requestId,
          cachedMatch,
          cachedVehicle,
        ),
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    if (emergencyStop) {
      await writeKotsaAuditLog({
        endpoint,
        errorMessage: "KOTSA emergency stop is enabled. Cache miss.",
        requestIp,
        requestId,
        responseTimeMs: Date.now() - startedAt,
        status: "emergency_stop",
        userAgent,
        userId: authResult.userId,
        userTier,
        vehicleNumberHash,
        vehicleNumberMasked,
      });
      await evaluateKotsaSecuritySignals({
        endpoint,
        requestId,
        requestIp,
        status: "emergency_stop",
        statusCode: 503,
        userId: authResult.userId,
      });

      const response = NextResponse.json(
        {
          ok: false,
          code: "KOTSA_EMERGENCY_STOP",
          error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요.",
          requestId,
        },
        { status: 503 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    if (maintenanceMode.enabled) {
      await writeKotsaAuditLog({
        endpoint,
        errorMessage: "Maintenance mode is enabled. Cache miss.",
        requestIp,
        requestId,
        responseTimeMs: Date.now() - startedAt,
        status: "maintenance_mode",
        userAgent,
        userId: authResult.userId,
        userTier,
        vehicleNumberHash,
        vehicleNumberMasked,
      });

      const response = NextResponse.json(
        {
          ok: false,
          code: "MAINTENANCE_MODE",
          error: maintenanceMode.message,
          requestId,
        },
        { status: 503 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    let countedAgainstQuota = true;

    if (options.commercialPlateQuota && vehicleNumberHash) {
      const quota = await checkCommercialPlateRollingQuota({
        endpoint,
        tier: userTier,
        userId: authResult.userId,
        vehicleNumberHash,
      });

      countedAgainstQuota = !quota.sameVehicleWithinWindow;

      if (!quota.allowed) {
        await writeKotsaAuditLog({
          endpoint,
          errorMessage: "Commercial plate rolling quota exceeded.",
          requestIp,
          requestId,
          responseTimeMs: Date.now() - startedAt,
          status: "rate_limited",
          userAgent,
          userId: authResult.userId,
          userTier,
          vehicleNumberHash,
          vehicleNumberMasked,
        });
        await evaluateKotsaSecuritySignals({
          endpoint,
          requestId,
          requestIp,
          status: "rate_limited",
          statusCode: 429,
          userId: authResult.userId,
        });

        const response = NextResponse.json(
          {
            ok: false,
            code: "COMMERCIAL_PLATE_LIMIT_EXCEEDED",
            error: commercialPlateQuotaExceededMessage,
            quota,
            requestId,
          },
          { status: 429 },
        );
        response.headers.set("x-request-id", requestId);
        return response;
      }
    } else {
      const quota = await checkKotsaDailyQuota({
        requestIp,
        tier: userTier,
        userId: authResult.userId,
      });

      if (!quota.allowed) {
        await writeKotsaAuditLog({
          endpoint,
          errorMessage: "KOTSA daily quota exceeded.",
          requestIp,
          requestId,
          responseTimeMs: Date.now() - startedAt,
          status: "rate_limited",
          userAgent,
          userId: authResult.userId,
          userTier,
          vehicleNumberHash,
          vehicleNumberMasked,
        });
        await evaluateKotsaSecuritySignals({
          endpoint,
          requestId,
          requestIp,
          status: "rate_limited",
          statusCode: 429,
          userId: authResult.userId,
        });

        const response = NextResponse.json(
          {
            ok: false,
            code: "KOTSA_DAILY_LIMIT_EXCEEDED",
            error: "오늘 조회 가능 횟수를 모두 사용했습니다.",
            quota,
            requestId,
          },
          { status: 429 },
        );
        response.headers.set("x-request-id", requestId);
        return response;
      }
    }

    let result: KotsaVehicleHistory;

    try {
      const comprehensive = await fetchKotsaComprehensiveInfo({ vehicleNumber });
      result = normalizeKotsaVehicleHistory(comprehensive.payload);
    } catch (error) {
      if (error instanceof KotsaComprehensiveApiError && error.status < 500) {
        throw new KotsaApiError(error.message, error.status, error.responseCode);
      }

      result = await fetchKotsaVehicleHistory({ vehicleNumber });
    }

    setCachedVehicleHistory(vehicleNumber, result);
    await setCachedVehicleHistoryInDb(vehicleNumber, result);
    const display = getKotsaVehicleDisplayInfo(result);
    const match = await getVehicleMasterMatch(authResult.clients, display);
    const reviewVehicle = await upsertReviewVehicleFromKotsa({
      clients: authResult.clients,
      display,
      match,
      vehicleNumber,
    });

    await writeKotsaAuditLog({
      endpoint,
      requestIp,
      requestId,
      responseCode: result.responseCode,
      responseTimeMs: Date.now() - startedAt,
      status: "success",
      countedAgainstQuota,
      userAgent,
      userId: authResult.userId,
      userTier,
      vehicleNumberHash,
      vehicleNumberMasked,
    });
    await evaluateKotsaSecuritySignals({
      endpoint,
      requestId,
      requestIp,
      status: "success",
      statusCode: 200,
      userId: authResult.userId,
    });

    const response = NextResponse.json(
      createSuccessPayload(result, false, requestId, match, reviewVehicle),
    );
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const isCircuitOpen = error instanceof KotsaCircuitOpenError;
    const status = isCircuitOpen
      ? 503
      : error instanceof KotsaApiError
        ? error.status
        : 500;
    const responseCode =
      error instanceof KotsaApiError ? error.responseCode : null;
    const errorType = isCircuitOpen
      ? "circuit_open"
      : error instanceof KotsaApiError && error.status === 504
        ? "timeout"
        : error instanceof KotsaApiError
          ? "kotsa_error"
          : "unknown";
    const message =
      error instanceof KotsaCircuitOpenError
        ? "공단 API 장애 보호 회로가 열려 잠시 후 다시 시도해야 합니다."
        : error instanceof KotsaApiError
          ? error.message
          : "KOTSA API 처리 중 오류가 발생했습니다.";

    const auditStatus = isCircuitOpen
      ? "circuit_open"
      : status === 500
        ? "configuration_error"
        : "error";

    await writeKotsaAuditLog({
      endpoint,
      errorMessage: message,
      requestIp,
      requestId,
      responseCode,
      responseTimeMs: Date.now() - startedAt,
      errorType,
      status: auditStatus,
      userAgent,
      userId: authResult.userId,
      userTier,
      vehicleNumberHash,
      vehicleNumberMasked,
    });
    await evaluateKotsaSecuritySignals({
      endpoint,
      requestId,
      requestIp,
      status: auditStatus,
      statusCode: status,
      userId: authResult.userId,
    });
    await evaluateKotsaFailureAlerts({
      errorType,
      requestId,
      status: auditStatus,
    });

    const response = jsonError(message, status);
    response.headers.set("x-request-id", requestId);

    if (error instanceof KotsaCircuitOpenError) {
      response.headers.set(
        "Retry-After",
        String(Math.max(Math.ceil(error.retryAfterMs / 1000), 1)),
      );
    }

    return response;
  }
}

export async function POST(request: NextRequest) {
  return handleKotsaVehicleHistoryRequest(request);
}
