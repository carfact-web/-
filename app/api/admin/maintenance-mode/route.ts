import { NextRequest, NextResponse } from "next/server";
import {
  getClientIpFromRequest,
  getKotsaMaintenanceMode,
  logSecurityAlert,
  setKotsaMaintenanceMode,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/maintenance-mode";
const defaultMaintenanceMessage =
  "현재 서비스 점검 중입니다. 잠시 후 다시 이용해주세요.";

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  return NextResponse.json({ maintenanceMode: await getKotsaMaintenanceMode() });
}

export async function PATCH(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: {
    enabled?: unknown;
    expectedEndAt?: unknown;
    message?: unknown;
    reason?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof payload.enabled !== "boolean") {
    return NextResponse.json({ error: "점검모드 값이 올바르지 않습니다." }, { status: 400 });
  }

  const expectedEndAt =
    typeof payload.expectedEndAt === "string" && payload.expectedEndAt.trim()
      ? payload.expectedEndAt.trim()
      : null;
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim().slice(0, 240)
      : defaultMaintenanceMessage;
  const reason =
    typeof payload.reason === "string" && payload.reason.trim()
      ? payload.reason.trim().slice(0, 240)
      : null;

  if (expectedEndAt && Number.isNaN(new Date(expectedEndAt).getTime())) {
    return NextResponse.json({ error: "예상 종료 시간이 올바르지 않습니다." }, { status: 400 });
  }

  await setKotsaMaintenanceMode({
    enabled: payload.enabled,
    expectedEndAt,
    message,
    reason,
  });
  await logSecurityAlert({
    alertType: payload.enabled
      ? "maintenance_mode_enabled"
      : "maintenance_mode_disabled",
    endpoint,
    metadata: {
      maintenance_expected_end_at: expectedEndAt,
      maintenance_reason: reason,
    },
    requestIp: getClientIpFromRequest(request),
    severity: "high",
    statusCode: 200,
    userId: adminResult.userId,
  });

  return NextResponse.json({ maintenanceMode: await getKotsaMaintenanceMode() });
}
