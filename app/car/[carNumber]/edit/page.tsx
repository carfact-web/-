"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CarViewEventToast } from "@/components/CarViewEventToast";
import { VehicleMasterFields } from "@/components/VehicleMasterFields";
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
const primaryButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600"
);
const validationMessageClassName = cn(
  "mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
);

const fuelTypes = ["가솔린", "디젤", "LPG", "하이브리드", "전기", "수소"];

export default function VehicleEditPage() {
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

  const saveAndGoToReport = async () => {
    if (!brandValue || !modelValue || !generationValue || !yearValue) {
      setValidationMessage("제조사, 모델, 세부모델, 연식을 선택해주세요.");
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
    router.replace(`/car/${encodeURIComponent(carNumber)}`);
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

        <h1 className="text-5xl font-bold mb-6">차량 정보 수정</h1>

        <p className="text-2xl text-gray-300 mb-10">
          차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
        </p>

        <CarViewEventToast carNumber={carNumber} />

        <div className={panelClassName}>
        <VehicleMasterFields
          brandValue={brandValue}
          modelValue={modelValue}
          modelDetailValue={generationValue}
          yearValue={yearValue}
          fuelTypeValue={fuelTypeValue}
          mileageValue={mileageValue}
          fuelTypes={fuelTypes}
          onBrandChange={setBrand}
          onModelChange={setModel}
          onModelDetailChange={setGeneration}
          onYearChange={setYear}
          onFuelTypeChange={setFuelType}
          onMileageChange={(value) => setMileage(sanitizeMileage(value))}
          onClearValidation={() => setValidationMessage("")}
        />

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
          차량 정보 저장하기
        </button>
        </div>
      </div>
    </main>
  );
}
