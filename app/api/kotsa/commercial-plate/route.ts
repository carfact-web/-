export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { handleKotsaVehicleHistoryRequest } from "../vehicle-history/route";

export async function POST(request: NextRequest) {
  return handleKotsaVehicleHistoryRequest(request, {
    commercialPlateQuota: true,
  });
}
