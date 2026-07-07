import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedPolicyKeys = new Set(["general", "verified_dealer", "admin", "ip"]);

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const { data, error } = await adminResult.clients.admin
    .from("kotsa_query_limit_policies")
    .select(
      "policy_key,label,daily_limit,temporary_daily_limit,temporary_expires_at,updated_at",
    )
    .order("policy_key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policies: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: {
    dailyLimit?: unknown;
    policyKey?: unknown;
    temporaryDailyLimit?: unknown;
    temporaryExpiresAt?: unknown;
  };

  try {
    payload = (await request.json()) as {
      dailyLimit?: unknown;
      policyKey?: unknown;
      temporaryDailyLimit?: unknown;
      temporaryExpiresAt?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof payload.policyKey !== "string" || !allowedPolicyKeys.has(payload.policyKey)) {
    return NextResponse.json({ error: "정책 key가 올바르지 않습니다." }, { status: 400 });
  }

  const dailyLimit =
    payload.dailyLimit === null ? null : Number(payload.dailyLimit);
  const temporaryDailyLimit =
    payload.temporaryDailyLimit === undefined ||
    payload.temporaryDailyLimit === null ||
    payload.temporaryDailyLimit === ""
      ? null
      : Number(payload.temporaryDailyLimit);
  const temporaryExpiresAt =
    typeof payload.temporaryExpiresAt === "string" &&
    payload.temporaryExpiresAt.trim()
      ? payload.temporaryExpiresAt.trim()
      : null;

  if (
    payload.policyKey !== "admin" &&
    payload.dailyLimit !== undefined &&
    (!Number.isInteger(dailyLimit) || Number(dailyLimit) < 1)
  ) {
    return NextResponse.json({ error: "제한 횟수가 올바르지 않습니다." }, { status: 400 });
  }

  if (
    temporaryDailyLimit !== null &&
    (!Number.isInteger(temporaryDailyLimit) || temporaryDailyLimit < 1)
  ) {
    return NextResponse.json({ error: "임시 제한 횟수가 올바르지 않습니다." }, { status: 400 });
  }

  if (temporaryExpiresAt && Number.isNaN(new Date(temporaryExpiresAt).getTime())) {
    return NextResponse.json({ error: "임시 제한 만료 시각이 올바르지 않습니다." }, { status: 400 });
  }

  const updatePayload: {
    daily_limit?: number | null;
    temporary_daily_limit?: number | null;
    temporary_expires_at?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (payload.dailyLimit !== undefined) {
    updatePayload.daily_limit =
      payload.policyKey === "admin" ? null : dailyLimit;
  }

  if (
    payload.temporaryDailyLimit !== undefined ||
    payload.temporaryExpiresAt !== undefined
  ) {
    updatePayload.temporary_daily_limit =
      payload.policyKey === "admin" ? null : temporaryDailyLimit;
    updatePayload.temporary_expires_at =
      payload.policyKey === "admin" || temporaryDailyLimit === null
        ? null
        : temporaryExpiresAt;
  }

  const { data, error } = await adminResult.clients.admin
    .from("kotsa_query_limit_policies")
    .update(updatePayload)
    .eq("policy_key", payload.policyKey)
    .select(
      "policy_key,label,daily_limit,temporary_daily_limit,temporary_expires_at,updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policy: data });
}
