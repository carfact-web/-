import { NextRequest, NextResponse } from "next/server";
import {
  getClientIpFromRequest,
  isRequestIpBlocked,
  recordApiNotFound,
} from "@/lib/server/kotsa/securityMonitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handleMissingApiRoute = async (request: NextRequest) => {
  const requestIp = getClientIpFromRequest(request);

  if (await isRequestIpBlocked(requestIp)) {
    return NextResponse.json({ error: "차단된 IP입니다." }, { status: 403 });
  }

  await recordApiNotFound({
    endpoint: request.nextUrl.pathname,
    requestIp,
  });

  return NextResponse.json({ error: "API route not found." }, { status: 404 });
};

export const GET = handleMissingApiRoute;
export const POST = handleMissingApiRoute;
export const PUT = handleMissingApiRoute;
export const PATCH = handleMissingApiRoute;
export const DELETE = handleMissingApiRoute;
