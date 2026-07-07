import { NextRequest, NextResponse } from "next/server";
import {
  getClientIpFromRequest,
  isKotsaEmergencyStopped,
  logSecurityAlert,
  setKotsaEmergencyStop,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/kotsa-emergency-stop";

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  return NextResponse.json({ emergencyStop: await isKotsaEmergencyStopped() });
}

export async function PATCH(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: { enabled?: unknown };

  try {
    payload = (await request.json()) as { enabled?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof payload.enabled !== "boolean") {
    return NextResponse.json({ error: "비상정지 값이 올바르지 않습니다." }, { status: 400 });
  }

  await setKotsaEmergencyStop(payload.enabled);
  await logSecurityAlert({
    alertType: payload.enabled
      ? "kotsa_emergency_stop_enabled"
      : "kotsa_emergency_stop_disabled",
    endpoint,
    metadata: { enabled: payload.enabled },
    requestIp: getClientIpFromRequest(request),
    severity: payload.enabled ? "critical" : "high",
    statusCode: 200,
    userId: adminResult.userId,
  });

  return NextResponse.json({ emergencyStop: payload.enabled });
}
