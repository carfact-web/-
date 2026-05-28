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
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn("w-full rounded-2xl bg-zinc-900 p-6");
const homeButtonClassName = cn(
  "mb-8 inline-flex items-center rounded-lg bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-gray-200 transition",
  "hover:opacity-75"
);
const formControlClassName = cn("w-full rounded-xl bg-zinc-800 p-3 text-white");
const primaryButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600"
);
const validationMessageClassName = cn(
  "mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
);

const fuelTypes = ["가솔린", "디젤", "LPG", "하이브리드", "전기", "수소"];

export default function VehicleSetupPage() {
  const params = useParams();
  const router = useRouter();
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string)
  );
  const { vehicle, saveVehicle } = useVehicle(carNumber);

  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [generation, setGeneration] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [mileage, setMileage] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const brandValue = brand ?? vehicle?.brand ?? "";
  const modelValue = model ?? vehicle?.model ?? "";
  const generationValue = generation ?? vehicle?.generation ?? "";
  const yearValue = year ?? vehicle?.year ?? "";
  const mileageValue = mileage ?? vehicle?.mileage ?? "";
  const fuelTypeValue = fuelType ?? vehicle?.fuelType ?? "";

  const brands = Object.keys(carData);
  const models = brandValue ? Object.keys(carData[brandValue]) : [];
  const generations =
    brandValue && modelValue
      ? carData[brandValue]?.[modelValue] || []
      : [];
  const selectedGeneration = generations.find(
    (item) => item.name === generationValue
  );
  const years = selectedGeneration
    ? Array.from(
        { length: selectedGeneration.endYear - selectedGeneration.startYear + 1 },
        (_, i) => String(selectedGeneration.endYear - i)
      )
    : [];

  const saveAndGoToReport = async () => {
    if (!brandValue || !modelValue || !generationValue || !yearValue) {
      setValidationMessage("제조사, 모델, 세대, 연식을 선택해주세요.");
      return;
    }

    setValidationMessage("");
    const nextVehicle: Vehicle = {
      plateNumber: carNumber,
      brand: brandValue,
      model: modelValue,
      generation: generationValue,
      year: yearValue,
      mileage: sanitizeMileage(mileageValue),
      fuelType: fuelTypeValue,
    };

    await saveVehicle(nextVehicle);
    window.location.href = `/car/${encodeURIComponent(carNumber)}`;
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
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
          카팩트에 처음 등록되는 차량입니다. 차량 정보를 알려주세요!
        </p>

        <div className="space-y-3">
          <select
            value={brandValue}
            onChange={(e) => {
              setBrand(e.target.value);
              setModel("");
              setGeneration("");
              setYear("");
              setValidationMessage("");
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
            value={modelValue}
            onChange={(e) => {
              setModel(e.target.value);
              setGeneration("");
              setYear("");
              setValidationMessage("");
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
            value={generationValue}
            onChange={(e) => {
              setGeneration(e.target.value);
              setYear("");
              setValidationMessage("");
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
            value={yearValue}
            onChange={(e) => {
              setYear(e.target.value);
              setValidationMessage("");
            }}
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
            value={fuelTypeValue}
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
            value={mileageValue}
            onChange={(e) => setMileage(sanitizeMileage(e.target.value))}
            placeholder="주행거리 입력 (예: 120000)"
            inputMode="numeric"
            className={formControlClassName}
          />
        </div>

        {validationMessage && (
          <p className={validationMessageClassName} aria-live="polite">
            {validationMessage}
          </p>
        )}

        <button
          type="button"
          onClick={saveAndGoToReport}
          className={primaryButtonClassName}
        >
          차량 정보 저장 후 리포트 보기
        </button>
        </div>
      </div>
    </main>
  );
}
