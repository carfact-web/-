import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeKotsaAuditLog } from "@/lib/server/kotsa/audit";
import { getClientIpFromRequest } from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/kotsa-user-quota-reset";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getTodayStartIso = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
};

export async function POST(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: { targetUserId?: unknown };

  try {
    payload = (await request.json()) as { targetUserId?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (
    typeof payload.targetUserId !== "string" ||
    !uuidPattern.test(payload.targetUserId)
  ) {
    return NextResponse.json({ error: "대상 회원 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const { count, error } = await adminResult.clients.admin
    .from("kotsa_api_audit_logs")
    .update({ counted_against_quota: false }, { count: "exact" })
    .eq("user_id", payload.targetUserId)
    .eq("counted_against_quota", true)
    .gte("created_at", getTodayStartIso())
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeKotsaAuditLog({
    endpoint,
    errorMessage: `quota reset by admin ${adminResult.userId ?? "service_role"}`,
    requestIp: getClientIpFromRequest(request),
    requestId: randomUUID(),
    responseCode: "RESET",
    status: "quota_reset",
    userAgent: request.headers.get("user-agent"),
    userId: payload.targetUserId,
    vehicleNumberHash: null,
    vehicleNumberMasked: null,
  });

  return NextResponse.json({ ok: true, resetCount: count ?? 0 });
}
