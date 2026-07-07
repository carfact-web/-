import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getTodayStartIso = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
};

const getDaysAgoStartIso = (daysAgo: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);

  return date.toISOString();
};

const toDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getResponsePercentile = (values: number[], percentile: number) => {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    Math.max(Math.ceil((percentile / 100) * sorted.length) - 1, 0),
    sorted.length - 1,
  );

  return sorted[index];
};

const getUnitCostKrw = async (admin: SupabaseClient) => {
  const envUnitCost = Number(process.env.KOTSA_API_UNIT_COST_KRW ?? 0);

  const { data } = await admin
    .from("kotsa_operation_settings")
    .select("numeric_value")
    .eq("setting_key", "api_unit_cost_krw")
    .maybeSingle();

  const dbUnitCost = Number(data?.numeric_value);

  return Number.isFinite(dbUnitCost)
    ? dbUnitCost
    : Number.isFinite(envUnitCost)
      ? envUnitCost
      : 0;
};

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const todayStartIso = getTodayStartIso();
  const thirtyDaysStartIso = getDaysAgoStartIso(29);
  const { data, error } = await adminResult.clients.admin
    .from("kotsa_api_audit_logs")
    .select(
      "created_at,status,response_time_ms,error_type,user_tier,counted_against_quota,vehicle_number_masked,vehicle_number_hash",
    )
    .gte("created_at", thirtyDaysStartIso)
    .limit(20000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows =
    (data as {
      counted_against_quota: boolean | null;
      created_at: string;
      error_type: string | null;
      response_time_ms: number | null;
      status: string;
      user_tier: string | null;
      vehicle_number_hash: string | null;
      vehicle_number_masked: string | null;
    }[]) ?? [];
  const todayRows = rows.filter((row) => row.created_at >= todayStartIso);
  const actualCalls = todayRows.filter(
    (row) => row.status === "success" || row.status === "error",
  );
  const responseTimes = todayRows
    .map((row) => row.response_time_ms)
    .filter((value): value is number => typeof value === "number");
  const tierCounts = todayRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.user_tier ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const cacheHits = todayRows.filter((row) => row.status === "cache_hit").length;
  const totalQueries = todayRows.filter((row) =>
    ["cache_hit", "success", "error", "circuit_open"].includes(row.status),
  ).length;
  const successCount = todayRows.filter(
    (row) => row.status === "success" || row.status === "cache_hit",
  ).length;
  const failureCount = todayRows.filter((row) =>
    ["error", "circuit_open"].includes(row.status),
  ).length;
  const dailyMap = new Map<
    string,
    {
      actualCalls: number;
      cacheHits: number;
      date: string;
      failures: number;
      totalQueries: number;
    }
  >();

  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = toDateKey(date.toISOString());
    dailyMap.set(key, {
      actualCalls: 0,
      cacheHits: 0,
      date: key,
      failures: 0,
      totalQueries: 0,
    });
  }

  const topVehicleBuckets = new Map<
    string,
    { count7d: number; count30d: number; hash: string; masked: string | null }
  >();
  const sevenDaysStartMs = new Date(getDaysAgoStartIso(6)).getTime();

  for (const row of rows) {
    if (!["cache_hit", "success", "error", "circuit_open"].includes(row.status)) {
      continue;
    }

    const key = toDateKey(row.created_at);
    const daily = dailyMap.get(key);

    if (daily) {
      daily.totalQueries += 1;

      if (row.status === "success" || row.status === "error") {
        daily.actualCalls += 1;
      }

      if (row.status === "cache_hit") {
        daily.cacheHits += 1;
      }

      if (row.status === "error" || row.status === "circuit_open") {
        daily.failures += 1;
      }
    }

    if (row.vehicle_number_hash) {
      const current = topVehicleBuckets.get(row.vehicle_number_hash) ?? {
        count7d: 0,
        count30d: 0,
        hash: row.vehicle_number_hash,
        masked: row.vehicle_number_masked,
      };
      current.count30d += 1;
      current.masked = current.masked ?? row.vehicle_number_masked;

      if (new Date(row.created_at).getTime() >= sevenDaysStartMs) {
        current.count7d += 1;
      }

      topVehicleBuckets.set(row.vehicle_number_hash, current);
    }
  }

  const topVehicles = [...topVehicleBuckets.values()];
  const toTopVehicle = (
    item: { count7d: number; count30d: number; hash: string; masked: string | null },
    days: 7 | 30,
  ) => ({
    label: item.masked ?? `hash:${item.hash.slice(0, 10)}`,
    vehicleHashPrefix: item.hash.slice(0, 12),
    viewCount: days === 7 ? item.count7d : item.count30d,
  });
  const unitCostKrw = await getUnitCostKrw(adminResult.clients.admin);
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).getDate();
  const estimatedMonthlyCalls = actualCalls.length * daysInMonth;

  return NextResponse.json({
    stats: {
      actualCalls: actualCalls.length,
      averageResponseMs: responseTimes.length
        ? Math.round(
            responseTimes.reduce((sum, value) => sum + value, 0) /
              responseTimes.length,
          )
        : null,
      cacheHitRate: totalQueries ? Math.round((cacheHits / totalQueries) * 1000) / 10 : 0,
      cacheHits,
      circuitOpenCount: todayRows.filter((row) => row.status === "circuit_open").length,
      dailySeries: [...dailyMap.values()],
      estimatedMonthlyCalls,
      estimatedMonthlyCostKrw: estimatedMonthlyCalls * unitCostKrw,
      failureCount,
      maxResponseMs: responseTimes.length ? Math.max(...responseTimes) : null,
      p95ResponseMs: getResponsePercentile(responseTimes, 95),
      successCount,
      successRate: totalQueries
        ? Math.round((successCount / totalQueries) * 1000) / 10
        : 0,
      tierCounts,
      timeoutCount: todayRows.filter((row) => row.error_type === "timeout").length,
      topVehicles7d: topVehicles
        .filter((item) => item.count7d > 0)
        .sort((a, b) => b.count7d - a.count7d)
        .slice(0, 10)
        .map((item) => toTopVehicle(item, 7)),
      topVehicles30d: topVehicles
        .filter((item) => item.count30d > 0)
        .sort((a, b) => b.count30d - a.count30d)
        .slice(0, 10)
        .map((item) => toTopVehicle(item, 30)),
      totalQueries,
      unitCostKrw,
    },
  });
}
