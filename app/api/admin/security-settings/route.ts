import { NextRequest, NextResponse } from "next/server";
import {
  getClientIpFromRequest,
  logSecurityAlert,
} from "@/lib/server/kotsa/securityMonitor";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpoint = "/api/admin/security-settings";
const allowedSettingKeys = new Set([
  "backup_last_success",
  "certificate_backup_last_at",
  "database_backup_last_at",
  "storage_backup_last_at",
  "supabase_backup_last_checked_at",
  "supabase_pitr_enabled",
]);

export async function PATCH(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let payload: {
    numericValue?: unknown;
    settingKey?: unknown;
    textValue?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (
    typeof payload.settingKey !== "string" ||
    !allowedSettingKeys.has(payload.settingKey)
  ) {
    return NextResponse.json({ error: "설정 key가 올바르지 않습니다." }, { status: 400 });
  }

  const updatePayload: {
    numeric_value?: number | null;
    text_value?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (payload.textValue !== undefined) {
    updatePayload.text_value =
      typeof payload.textValue === "string" && payload.textValue.trim()
        ? payload.textValue.trim()
        : null;
  }

  if (payload.numericValue !== undefined) {
    const nextValue =
      payload.numericValue === null ? null : Number(payload.numericValue);

    if (nextValue !== null && !Number.isFinite(nextValue)) {
      return NextResponse.json({ error: "숫자 설정값이 올바르지 않습니다." }, { status: 400 });
    }

    updatePayload.numeric_value = nextValue;
  }

  const { data, error } = await adminResult.clients.admin
    .from("kotsa_operation_settings")
    .update(updatePayload)
    .eq("setting_key", payload.settingKey)
    .select("setting_key,numeric_value,text_value,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSecurityAlert({
    alertType: "security_setting_changed",
    endpoint,
    metadata: { setting_key: payload.settingKey },
    requestIp: getClientIpFromRequest(request),
    severity: "high",
    statusCode: 200,
    userId: adminResult.userId,
  });

  return NextResponse.json({ setting: data });
}
