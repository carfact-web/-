import { NextResponse } from "next/server";
import { isKotsaEmergencyStopped } from "@/lib/server/kotsa/securityMonitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const emergencyStop = await isKotsaEmergencyStopped();

  return NextResponse.json({
    emergencyStop,
    message: emergencyStop ? "현재 점검 중입니다." : null,
  });
}
