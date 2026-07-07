import { NextRequest, NextResponse } from "next/server";
import {
  deleteCachedVehicleHistory,
  flushKotsaVehicleHistoryCache,
  hashVehicleNumber,
} from "@/lib/server/kotsa/cache";
import {
  getClientIpFromRequest,
  logSecurityAlert,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";
import { normalizeVehicleNumber } from "@/lib/server/kotsa/vehicleNumber";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/kotsa-cache";

const toIsoOrNull = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const nowIso = new Date().toISOString();
  const [{ count: totalCount }, { count: validCount }, { count: expiredCount }] =
    await Promise.all([
      adminResult.clients.admin
        .from("kotsa_vehicle_history_cache")
        .select("vehicle_number_hash", { count: "exact", head: true }),
      adminResult.clients.admin
        .from("kotsa_vehicle_history_cache")
        .select("vehicle_number_hash", { count: "exact", head: true })
        .gt("expires_at", nowIso),
      adminResult.clients.admin
        .from("kotsa_vehicle_history_cache")
        .select("vehicle_number_hash", { count: "exact", head: true })
        .lte("expires_at", nowIso),
    ]);
  const { data: recentRows, error: recentError } =
    await adminResult.clients.admin
      .from("kotsa_vehicle_history_cache")
      .select(
        "vehicle_number_hash,vehicle_number_masked,response_code,created_at,expires_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(20);
  const { data: latestCreatedRows } = await adminResult.clients.admin
    .from("kotsa_vehicle_history_cache")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: nearestExpiryRows } = await adminResult.clients.admin
    .from("kotsa_vehicle_history_cache")
    .select("expires_at")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(1);

  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 500 });
  }

  return NextResponse.json({
    cache: {
      expiredRows: expiredCount ?? 0,
      latestCreatedAt: toIsoOrNull(latestCreatedRows?.[0]?.created_at),
      nearestExpiresAt: toIsoOrNull(nearestExpiryRows?.[0]?.expires_at),
      recentRows: (recentRows ?? []).map((row) => ({
        createdAt: toIsoOrNull(row.created_at),
        expiresAt: toIsoOrNull(row.expires_at),
        hashPrefix:
          typeof row.vehicle_number_hash === "string"
            ? row.vehicle_number_hash.slice(0, 12)
            : "",
        masked: row.vehicle_number_masked ?? null,
        responseCode: row.response_code ?? null,
        updatedAt: toIsoOrNull(row.updated_at),
      })),
      totalRows: totalCount ?? 0,
      validRows: validCount ?? 0,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: {
    mode?: unknown;
    vehicleNumber?: unknown;
    vehicleNumberHash?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (payload.mode === "all") {
    const { count, error } = await adminResult.clients.admin
      .from("kotsa_vehicle_history_cache")
      .delete({ count: "exact" })
      .neq("vehicle_number_hash", "");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const memoryCount = flushKotsaVehicleHistoryCache();

    await logSecurityAlert({
      alertType: "kotsa_db_cache_flushed",
      endpoint,
      metadata: { db_cache_count: count ?? 0, memory_cache_count: memoryCount },
      requestIp: getClientIpFromRequest(request),
      severity: "high",
      statusCode: 200,
      userId: adminResult.userId,
    });

    return NextResponse.json({ deletedCount: count ?? 0, ok: true });
  }

  const vehicleNumber = normalizeVehicleNumber(payload.vehicleNumber);
  const vehicleNumberHash =
    typeof payload.vehicleNumberHash === "string" && payload.vehicleNumberHash.trim()
      ? payload.vehicleNumberHash.trim()
      : vehicleNumber
        ? hashVehicleNumber(vehicleNumber)
        : "";

  if (!vehicleNumberHash) {
    return NextResponse.json(
      { error: "삭제할 cache 식별자가 필요합니다." },
      { status: 400 },
    );
  }

  const { count, error } = await adminResult.clients.admin
    .from("kotsa_vehicle_history_cache")
    .delete({ count: "exact" })
    .eq("vehicle_number_hash", vehicleNumberHash);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (vehicleNumber) {
    deleteCachedVehicleHistory(vehicleNumber);
  }

  await logSecurityAlert({
    alertType: "kotsa_vehicle_cache_deleted",
    endpoint,
    metadata: {
      deleted_count: count ?? 0,
      vehicle_hash_prefix: vehicleNumberHash.slice(0, 12),
    },
    requestIp: getClientIpFromRequest(request),
    severity: "warning",
    statusCode: 200,
    userId: adminResult.userId,
  });

  return NextResponse.json({ deletedCount: count ?? 0, ok: true });
}
