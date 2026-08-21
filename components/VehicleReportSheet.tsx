"use client";

import type { Vehicle } from "@/types/vehicle";
import { getVehicleDisplayName } from "@/utils/vehicleDisplayName";

interface VehicleReportSheetProps {
  carNumber: string;
  reviewCount: number;
  vehicle: Vehicle;
}

const formatMileage = (mileage: string) => {
  const parsed = Number(mileage);

  return Number.isFinite(parsed) && parsed > 0
    ? `${parsed.toLocaleString()} km`
    : "확인 중";
};

const formatCheckedAt = () =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

function ReportCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <p className="text-[10px] font-black text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-black text-zinc-900">
        {value || "확인 중"}
      </p>
    </div>
  );
}

export function VehicleReportSheet({
  carNumber,
  reviewCount,
  vehicle,
}: VehicleReportSheetProps) {
  const vehicleName = getVehicleDisplayName(vehicle);
  const maskedPlate =
    carNumber.length > 4 ? `${carNumber.slice(0, -4)}****` : "****";

  return (
    <article
      className="mx-auto w-full max-w-[794px] overflow-hidden rounded-sm bg-white p-5 text-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-8"
      aria-label="CARFACT 차량정보 리포트"
    >
      <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-4">
        <div>
          <p className="text-sm font-black tracking-tight text-red-600">
            CARFACT
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            CARFACT 차량정보 리포트
          </h1>
          <p className="mt-1 text-xs font-bold text-zinc-500">
            공공데이터 기반 차량정보 조회
          </p>
        </div>
        <div className="min-w-32 rounded-lg border border-zinc-300 p-3 text-[10px] sm:min-w-40">
          <p className="font-black text-zinc-500">조회일시</p>
          <p className="mt-1 font-black text-zinc-900">{formatCheckedAt()}</p>
          <p className="mt-2 font-black text-zinc-500">차량번호</p>
          <p className="mt-1 font-black text-zinc-900">{maskedPlate}</p>
        </div>
      </header>

      <section className="mt-4 grid gap-4 rounded-xl border border-zinc-300 p-4 sm:grid-cols-[0.9fr_1.3fr]">
        <div>
          <h2 className="text-2xl font-black">
            {vehicleName || "차량정보 확인 완료"}
          </h2>
          <p className="mt-1 text-sm font-black text-zinc-600">
            {vehicle.year ? `${vehicle.year}년식` : "연식 확인 중"}
          </p>
          <div className="mt-5 border-l-4 border-red-600 pl-3">
            <p className="text-[11px] font-black text-zinc-500">
              현재 주행거리
            </p>
            <p className="mt-1 text-2xl font-black">
              {formatMileage(vehicle.mileage)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ReportCell label="제조사" value={vehicle.brand} />
          <ReportCell label="모델" value={vehicle.model} />
          <ReportCell label="세대" value={vehicle.generation} />
          <ReportCell label="연료" value={vehicle.fuelType} />
          <ReportCell
            label="연식"
            value={vehicle.year ? `${vehicle.year}년` : ""}
          />
          <ReportCell label="등록 후기" value={`${reviewCount}건`} />
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-zinc-300 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-black">CARFACT CHECK</h2>
          <p className="text-[10px] font-bold text-zinc-500">
            로그인 사용자 전체 리포트
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["차량 기본정보", "확인"],
            ["차량 제원", "확인"],
            ["정비·성능정보", "분석 중"],
            ["실제 후기", `${reviewCount}건`],
            ["AI 분석", "제공"],
            ["조회 상태", "완료"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2"
            >
              <span className="text-xs font-black text-zinc-600">{label}</span>
              <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-[10px] font-black">
                {value}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-bold leading-5 text-zinc-500">
          ※ 표시 정보는 조회 시점과 관계기관의 데이터 제공 범위에 따라 달라질 수
          있습니다.
        </p>
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-300 p-4">
          <h2 className="text-sm font-black">차량정보 요약</h2>
          <p className="mt-3 text-xs font-bold leading-6 text-zinc-600">
            {vehicleName || "차량"}의 기본정보와 제원이 확인되었습니다. 상세 분석은
            아래 CARFACT AI 분석에서 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-300 p-4">
          <h2 className="text-sm font-black">이력·후기 요약</h2>
          <div className="mt-3 flex items-end justify-between">
            <p className="text-xs font-bold text-zinc-500">등록된 실제 후기</p>
            <p className="text-3xl font-black">{reviewCount}건</p>
          </div>
        </div>
      </section>

      <footer className="mt-4 border-t border-zinc-300 pt-3 text-[9px] font-bold leading-4 text-zinc-500">
        본 리포트는 관계기관에서 제공되는 차량정보와 카팩트에 등록된 정보를
        기반으로 구성됩니다. 차량 구매 전 실차 확인 및 최신
        성능·상태점검기록부 확인을 권장합니다.
      </footer>
    </article>
  );
}
