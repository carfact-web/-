import type { KotsaDetailedHistory } from "@/types/kotsa";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";

export async function localVehicleFixture(request: NextRequest) {
  const clients = getSupabaseAdminClients();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!clients || !token) return NextResponse.json({ ok: false, error: "로컬 로그인이 필요합니다." }, { status: 401 });
  const { data, error } = await clients.auth.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ ok: false, error: "로컬 세션이 만료되었습니다." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.vehicleNumber !== "123가4567") return NextResponse.json({ ok: false, error: "합성 테스트 차량 123가4567만 조회할 수 있습니다." }, { status: 404 });
  const detailedHistory = { inspection: [], maintenance: [], performance: [] } satisfies KotsaDetailedHistory;
  return NextResponse.json({
    ok: true, mock: true, cached: false, businessVehicle: false,
    requestId: "local-synthetic-fixture",
    data: { carName: "테스트 세단", firstRegistrationDate: "2020-01-01", inspectionRecords: [], insuranceActive: true, insuranceYn: "Y", mortgageCount: 0, overdueTaxCount: 0, performanceCheckCount: 0, responseCode: "LOCAL_MOCK", responseMessage: "합성 테스트 데이터", scrapped: false, scrappedYn: "N", seizureCount: 0, transferDate: null, usage: "자가용", vehicleType: "승용", maintenanceHistoryCount: 0, businessStatus: "비사업용", detailedHistory },
    display: { brand: "테스트", manufacturer: "테스트", carName: "테스트 세단", year: "2020", generation: "테스트 세대", fuelType: "가솔린", latestPerformanceMileage: "10000", usage: "자가용", vehicleType: "승용", firstRegistrationDate: "2020-01-01", maintenanceHistoryCount: 0, performanceCheckCount: 0, inspectionHistoryCount: 0, scrapped: false, detailedHistory },
  });
}
