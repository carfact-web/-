export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";
import { mapVehicleRow } from "@/lib/supabaseData";
import {
  sanitizeMileage,
  sanitizeUserText,
  sanitizeVehiclePlateNumber,
} from "@/utils/inputSanitizer";
import type { Vehicle } from "@/types/vehicle";

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  return match?.[1] ?? "";
};

const getVehiclePayload = (value: unknown): Vehicle | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const vehicle = (value as { vehicle?: unknown }).vehicle;

  if (typeof vehicle !== "object" || vehicle === null || Array.isArray(vehicle)) {
    return null;
  }

  const record = vehicle as Record<string, unknown>;

  return {
    brand: sanitizeUserText(String(record.brand ?? "")),
    fuelType: sanitizeUserText(String(record.fuelType ?? "")),
    generation: sanitizeUserText(String(record.generation ?? "")),
    mileage: sanitizeMileage(String(record.mileage ?? "")),
    model: sanitizeUserText(String(record.model ?? "")),
    plateNumber: sanitizeVehiclePlateNumber(String(record.plateNumber ?? "")),
    year: sanitizeUserText(String(record.year ?? "")),
  };
};

export async function POST(request: Request) {
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 503 },
    );
  }

  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: userData, error: userError } = await clients.auth.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "로그인 세션을 확인하지 못했습니다." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await clients.admin
    .from("user_profiles")
    .select("id,is_verified_dealer")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.id !== userData.user.id ||
    profile.is_verified_dealer !== true
  ) {
    return NextResponse.json(
      { error: "인증 완료 딜러만 차량정보를 직접 등록할 수 있습니다." },
      { status: 403 },
    );
  }

  const vehicle = getVehiclePayload(await request.json().catch(() => null));

  if (!vehicle?.plateNumber || !vehicle.brand || !vehicle.model || !vehicle.year) {
    return NextResponse.json(
      { error: "필수 차량정보가 부족합니다." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await clients.admin
    .from("vehicles")
    .upsert(
      {
        car_number: vehicle.plateNumber,
        fuel_type: vehicle.fuelType || null,
        generation: vehicle.generation || null,
        manufacturer: vehicle.brand,
        mileage: vehicle.mileage || null,
        model: vehicle.model,
        updated_at: now,
        year: vehicle.year,
      },
      { onConflict: "car_number" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "차량정보 저장에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, vehicle: mapVehicleRow(data) });
}
