import { NextRequest, NextResponse } from "next/server";
import { flushKotsaVehicleHistoryCache } from "@/lib/server/kotsa/cache";
import { resetKotsaCircuitBreaker } from "@/lib/server/kotsa/circuitBreaker";
import {
  getClientIpFromRequest,
  logSecurityAlert,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/security-actions";

export async function POST(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: { action?: unknown };

  try {
    payload = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (payload.action === "flush_cache") {
    const flushedCount = flushKotsaVehicleHistoryCache();

    await logSecurityAlert({
      alertType: "kotsa_cache_flushed",
      endpoint,
      metadata: { flushed_count: flushedCount },
      requestIp: getClientIpFromRequest(request),
      severity: "high",
      statusCode: 200,
      userId: adminResult.userId,
    });

    return NextResponse.json({ flushedCount, ok: true });
  }

  if (payload.action === "reset_circuit") {
    resetKotsaCircuitBreaker();

    await logSecurityAlert({
      alertType: "kotsa_circuit_reset",
      endpoint,
      requestIp: getClientIpFromRequest(request),
      severity: "high",
      statusCode: 200,
      userId: adminResult.userId,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
}
