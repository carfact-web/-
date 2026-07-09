import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeKotsaAuditLog } from "@/lib/server/kotsa/audit";
import { evaluateKotsaFailureAlerts } from "@/lib/server/kotsa/alerts";
import { fetchKotsaVehicleHistory, KotsaApiError } from "@/lib/server/kotsa/client";
import { KotsaCircuitOpenError } from "@/lib/server/kotsa/circuitBreaker";
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
  type KotsaVehicleHistory,
} from "@/types/kotsa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ ok: false, error: message }, { status });

const createSuccessPayload = (
  result: KotsaVehicleHistory,
  cached: boolean,
  requestId: string,
) => ({
  ok: true,
  businessVehicle: isKotsaBusinessVehicle(result),
  cached,
  data: result,
  display: getKotsaVehicleDisplayInfo(result),
  requestId,
});

interface HandleKotsaVehicleHistoryOptions {
  commercialPlateQuota?: boolean;
}

const commercialPlateQuotaLimit = 5;
const commercialPlateQuotaWindowMs = 24 * 60 * 60 * 1000;
const commercialPlateQuotaExceededMessage =
  "24시간 조회 가능 횟수를 초과했습니다.\n동일 번호 재조회는 가능하며, 신규 번호 조회는 24시간 후 다시 이용해주세요.";

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

    if (cachedResult) {
      setCachedVehicleHistory(vehicleNumber, cachedResult);

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
        createSuccessPayload(cachedResult, true, requestId),
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

    const result = await fetchKotsaVehicleHistory({ vehicleNumber });
    setCachedVehicleHistory(vehicleNumber, result);
    await setCachedVehicleHistoryInDb(vehicleNumber, result);

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
      createSuccessPayload(result, false, requestId),
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
