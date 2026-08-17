export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { resolveKotsaAuthenticatedUser } from "@/lib/server/kotsa/supabaseAdmin";
import {
  sanitizeMileage,
  sanitizeUserText,
  sanitizeVehiclePlateNumber,
} from "@/utils/inputSanitizer";

const isAuthorizedDealer = (auth: {
  isAdmin: boolean;
  isVerifiedDealer: boolean;
}) => auth.isVerifiedDealer === true;

const forbiddenResponse = () =>
  NextResponse.json(
    {
      canRegister: false,
      error: "인증 딜러만 차량정보를 직접 등록할 수 있습니다.",
      ok: false,
    },
    { status: 403 },
  );

export async function GET(request: NextRequest) {
  const auth = await resolveKotsaAuthenticatedUser(request);

  if ("error" in auth) {
    return NextResponse.json(
      {
        canRegister: false,
        error: auth.error,
        isVerifiedDealer: false,
        ok: false,
      },
      { status: auth.status },
    );
  }

  const canRegister = isAuthorizedDealer(auth);

  return NextResponse.json({
    canRegister,
    isAdmin: auth.isAdmin,
    isVerifiedDealer: auth.isVerifiedDealer === true,
    ok: true,
    role: auth.role,
  });
}

export async function POST(request: NextRequest) {
  const auth = await resolveKotsaAuthenticatedUser(request);

  if ("error" in auth) {
    return forbiddenResponse();
  }

  if (!isAuthorizedDealer(auth)) {
    return forbiddenResponse();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        brand?: unknown;
        fuelType?: unknown;
        generation?: unknown;
        mileage?: unknown;
        model?: unknown;
        plateNumber?: unknown;
        year?: unknown;
      }
    | null;

  const plateNumber = sanitizeVehiclePlateNumber(String(body?.plateNumber ?? ""));
  const brand = sanitizeUserText(String(body?.brand ?? ""));
  const model = sanitizeUserText(String(body?.model ?? ""));
  const generation = sanitizeUserText(String(body?.generation ?? ""));
  const year = sanitizeUserText(String(body?.year ?? ""));
  const mileage = sanitizeMileage(String(body?.mileage ?? ""));
  const fuelType = sanitizeUserText(String(body?.fuelType ?? ""));

  if (!plateNumber || !brand || !model || !generation || !year) {
    return NextResponse.json(
      {
        error: "차량번호, 제조사, 모델, 세부모델, 연식을 확인해 주세요.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.clients.admin
    .from("vehicles")
    .upsert(
      {
        car_number: plateNumber,
        fuel_type: fuelType || null,
        generation,
        manufacturer: brand,
        mileage: mileage || null,
        model,
        updated_at: now,
        year,
      },
      { onConflict: "car_number" },
    )
    .select("id,car_number,manufacturer,model,generation,year,mileage,fuel_type,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "차량정보 저장에 실패했습니다.", ok: false },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    vehicle: {
      brand: data.manufacturer,
      createdAt: data.created_at,
      fuelType: data.fuel_type ?? "",
      generation: data.generation ?? "",
      id: data.id,
      mileage: data.mileage ?? "",
      model: data.model,
      plateNumber: data.car_number,
      updatedAt: data.updated_at,
      year: data.year,
    },
  });
}
