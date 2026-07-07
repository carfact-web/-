import { NextRequest, NextResponse } from "next/server";
import {
  getClientIpFromRequest,
  logSecurityAlert,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/security-ip-blocks";
const ipPattern =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.|$)){4}$|^[0-9a-f:]{3,45}$/i;

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const { data, error } = await adminResult.clients.admin
    .from("security_blocked_ips")
    .select("ip,reason,is_active,expires_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blockedIps: data ?? [] });
}

export async function POST(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: {
    expiresAt?: unknown;
    ip?: unknown;
    isActive?: unknown;
    reason?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const ip = typeof payload.ip === "string" ? payload.ip.trim() : "";

  if (!ip || !ipPattern.test(ip)) {
    return NextResponse.json({ error: "IP 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const expiresAt =
    typeof payload.expiresAt === "string" && payload.expiresAt.trim()
      ? payload.expiresAt.trim()
      : null;

  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
    return NextResponse.json({ error: "만료 시각이 올바르지 않습니다." }, { status: 400 });
  }

  const { data, error } = await adminResult.clients.admin
    .from("security_blocked_ips")
    .upsert({
      created_by: adminResult.userId,
      expires_at: expiresAt,
      ip,
      is_active:
        typeof payload.isActive === "boolean" ? payload.isActive : true,
      reason:
        typeof payload.reason === "string" ? payload.reason.slice(0, 300) : null,
      updated_at: new Date().toISOString(),
    })
    .select("ip,reason,is_active,expires_at,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSecurityAlert({
    alertType: data.is_active ? "ip_block_enabled" : "ip_block_disabled",
    blocked: data.is_active,
    endpoint,
    metadata: { target_ip: ip },
    requestIp: getClientIpFromRequest(request),
    severity: data.is_active ? "critical" : "warning",
    statusCode: 200,
    userId: adminResult.userId,
  });

  return NextResponse.json({ blockedIp: data });
}
