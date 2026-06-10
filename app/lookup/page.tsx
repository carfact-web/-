"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  formatVehiclePlateNumberForDisplay,
  isValidVehiclePlateNumber,
  normalizeVehiclePlateNumber,
} from "@/utils/vehiclePlateValidation";
import type { FormEvent } from "react";

const pageClassName = cn("min-h-screen bg-black px-4 py-8 text-white sm:px-6");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-base text-white outline-none transition",
  "placeholder:text-zinc-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
);
const primaryButtonClassName = cn(
  "mt-3 w-full rounded-lg px-4 py-4 text-base font-bold text-white transition",
  "bg-[#FF3B30] hover:bg-[#f52f25] active:scale-[0.99]",
  "disabled:cursor-not-allowed disabled:bg-[#3A3A3A] disabled:hover:bg-[#3A3A3A] disabled:active:scale-100",
);
const formMessageClassName = cn(
  "mt-2 px-1 text-xs font-semibold text-[#FF3B30]"
);

export default function LookupPage() {
  const router = useRouter();
  const [carNumber, setCarNumber] = useState("");
  const normalizedCarNumber = normalizeVehiclePlateNumber(carNumber);
  const hasCarNumberInput = normalizedCarNumber.length > 0;
  const isCarNumberValid = isValidVehiclePlateNumber(normalizedCarNumber);
  const showPlateValidationError = hasCarNumberInput && !isCarNumberValid;

  const goToReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = normalizeVehiclePlateNumber(carNumber);

    if (!isValidVehiclePlateNumber(value)) {
      return;
    }

    router.push(`/car/${encodeURIComponent(value)}`);
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white">차량조회</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            차량번호로 실제 매물 후기와 이야기를 확인하세요.
          </p>
        </div>

        <form className={panelClassName} onSubmit={goToReport}>
          <input
            value={formatVehiclePlateNumberForDisplay(carNumber)}
            onChange={(event) => {
              setCarNumber(sanitizeVehiclePlateNumber(event.target.value));
            }}
            type="text"
            placeholder="예) 123가4567"
            className={inputClassName}
            aria-invalid={showPlateValidationError}
            aria-describedby={
              showPlateValidationError ? "lookup-validation" : undefined
            }
          />

          {showPlateValidationError && (
            <p
              id="lookup-validation"
              className={formMessageClassName}
              aria-live="polite"
            >
              잘못된 입력형태입니다.
            </p>
          )}

          <button
            type="submit"
            className={primaryButtonClassName}
            disabled={!isCarNumberValid}
          >
            차량 이야기 보기
          </button>
        </form>
      </div>
    </main>
  );
}
