"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CarViewEventToast } from "@/components/CarViewEventToast";
import { carData } from "@/data/carData";
import { useVehicle } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import {
  sanitizeMileage,
  sanitizeVehiclePlateNumber,
} from "@/utils/inputSanitizer";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const panelClassName = cn("max-w-2xl rounded-2xl bg-zinc-900 p-6");
const homeButtonClassName = cn(
  "mb-8 inline-flex items-center rounded-lg bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-gray-200 transition",
  "hover:opacity-75"
);
const formControlClassName = cn("w-full rounded-xl bg-zinc-800 p-3 text-white");
const primaryButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600"
);

const fuelTypes = ["가솔린", "디젤", "LPG", "하이브리드", "전기", "수소"];

export default function VehicleSetupPage() {
  const params = useParams();
  const router = useRouter();
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string)
  );
  const { vehicle, saveVehicle } = useVehicle(carNumber);

  const [brand, setBrand] = useState(vehicle?.brand ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [generation, setGeneration] = useState(vehicle?.generation ?? "");
  const [year, setYear] = useState(vehicle?.year ?? "");
  const [mileage, setMileage] = useState(vehicle?.mileage ?? "");
  const [fuelType, setFuelType] = useState(vehicle?.fuelType ?? "");

  const brands = Object.keys(carData);
  const models = brand ? Object.keys(carData[brand]) : [];
  const generations =
    brand && model
      ? carData[brand]?.[model] || []
      : [];
  const selectedGeneration = generations.find((item) => item.name === generation);
  const years = selectedGeneration
    ? Array.from(
        { length: selectedGeneration.endYear - selectedGeneration.startYear + 1 },
        (_, i) => String(selectedGeneration.endYear - i)
      )
    : [];

  const saveAndGoToReport = () => {
    if (!brand || !model || !generation || !year) {
      alert("제조사, 모델, 세대, 연식을 선택해주세요.");
      return;
    }

    const nextVehicle: Vehicle = {
      plateNumber: carNumber,
      brand,
      model,
      generation,
      year,
      mileage: sanitizeMileage(mileage),
      fuelType,
    };

    saveVehicle(nextVehicle);
    window.location.href = `/car/${encodeURIComponent(carNumber)}`;
  };

  return (
    <main className={pageClassName}>
      <button
        type="button"
        onClick={() => router.push("/")}
        className={homeButtonClassName}
      >
        ← 홈으로
      </button>

      <h1 className="text-5xl font-bold mb-6">차량 정보 등록</h1>

      <CarViewEventToast
        carNumber={carNumber}
        className="sticky top-4 z-[9999]"
      />

      <p className="text-2xl text-gray-300 mb-10">
        차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
      </p>

      <div className={panelClassName}>
        <p className="text-gray-300 mb-6">
          카플래닛에 처음 등록되는 차량입니다. 차량 정보를 알려주세요!
        </p>

        <div className="space-y-3">
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setModel("");
              setGeneration("");
              setYear("");
            }}
            className={formControlClassName}
          >
            <option value="">제조사 선택</option>
            {brands.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setGeneration("");
              setYear("");
            }}
            className={formControlClassName}
          >
            <option value="">모델 선택</option>
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={generation}
            onChange={(e) => {
              setGeneration(e.target.value);
              setYear("");
            }}
            className={formControlClassName}
          >
            <option value="">세대 선택</option>
            {generations.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={formControlClassName}
          >
            <option value="">연식 선택</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}년
              </option>
            ))}
          </select>

          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className={formControlClassName}
          >
            <option value="">연료 선택</option>
            {fuelTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            value={mileage}
            onChange={(e) => setMileage(sanitizeMileage(e.target.value))}
            placeholder="주행거리 입력 (예: 120000)"
            inputMode="numeric"
            className={formControlClassName}
          />
        </div>

        <button
          type="button"
          onClick={saveAndGoToReport}
          className={primaryButtonClassName}
        >
          차량 정보 저장 후 리포트 보기
        </button>
      </div>
    </main>
  );
}
