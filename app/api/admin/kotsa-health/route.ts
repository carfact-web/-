import { NextRequest, NextResponse } from "next/server";
import { getKotsaHealth, runKotsaStartupChecks } from "@/lib/server/kotsa/health";
import {
  getClientIpInfoFromRequest,
  getKotsaSecuritySummary,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  if (request.nextUrl.searchParams.get("refresh") === "1") {
    await runKotsaStartupChecks();
  }

  const security = await getKotsaSecuritySummary();
  const clientIpInfo = getClientIpInfoFromRequest(request);

  return NextResponse.json({
    health: {
      ...getKotsaHealth(),
      security: {
        ...security,
        cloudflare: {
          clientIp: clientIpInfo.clientIp || null,
          enabled: clientIpInfo.cloudflareEnabled,
          proxyDetected: clientIpInfo.proxyDetected,
        },
      },
    },
  });
}
