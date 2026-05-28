"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
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
  "mt-3 w-full rounded-lg bg-red-600 px-4 py-4 text-base font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.99]"
);
const formMessageClassName = cn(
  "mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
);

export default function LookupPage() {
  const router = useRouter();
  const [carNumber, setCarNumber] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const goToReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = sanitizeVehiclePlateNumber(carNumber);

    if (!value) {
      setFormMessage("차량번호를 입력해주세요.");
      return;
    }

    setFormMessage("");
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
            value={carNumber}
            onChange={(event) => {
              setCarNumber(sanitizeVehiclePlateNumber(event.target.value));
              setFormMessage("");
            }}
            type="text"
            placeholder="예) 123가4567"
            className={inputClassName}
            aria-invalid={Boolean(formMessage)}
            aria-describedby={formMessage ? "lookup-validation" : undefined}
          />

          {formMessage && (
            <p
              id="lookup-validation"
              className={formMessageClassName}
              aria-live="polite"
            >
              {formMessage}
            </p>
          )}

          <button type="submit" className={primaryButtonClassName}>
            차량 이야기 보기
          </button>
        </form>
      </div>
    </main>
  );
}
