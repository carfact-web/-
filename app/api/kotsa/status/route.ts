import { NextRequest, NextResponse } from "next/server";
import {
  getKotsaMaintenanceMode,
  isKotsaEmergencyStopped,
} from "@/lib/server/kotsa/securityMonitor";
import { resolveOptionalAdminUser } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const [emergencyStop, maintenanceMode, adminUser] = await Promise.all([
    isKotsaEmergencyStopped(),
    getKotsaMaintenanceMode(),
    resolveOptionalAdminUser(request),
  ]);

  return NextResponse.json({
    emergencyStop,
    isAdmin: adminUser.isAdmin,
    maintenanceMode,
    message: emergencyStop
      ? "현재 점검 중입니다."
      : maintenanceMode.enabled
        ? maintenanceMode.message
        : null,
  });
}
