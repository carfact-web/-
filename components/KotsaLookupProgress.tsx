"use client";

import { cn } from "@/utils/cn";

interface KotsaLookupProgressProps {
  activeStep: number;
  isVisible: boolean;
}

const steps = [
  "차량 확인",
  "차종 확인",
  "연식 확인",
  "성능기록부 확인",
  "사업용 차량 확인",
];

export function KotsaLookupProgress({
  activeStep,
  isVisible,
}: KotsaLookupProgressProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-4">
      <p className="text-sm font-black text-white">착착착...</p>
      <div className="mt-3 space-y-2">
        {steps.map((step, index) => {
          const isDone = index <= activeStep;

          return (
            <div
              key={step}
              className={cn(
                "flex items-center gap-2 text-sm font-bold transition",
                isDone ? "text-emerald-300" : "text-zinc-500",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full border text-[11px]",
                  isDone
                    ? "border-emerald-400 bg-emerald-400 text-black"
                    : "border-zinc-700 text-zinc-500",
                )}
              >
                {isDone ? "✓" : index + 1}
              </span>
              {step}
            </div>
          );
        })}
      </div>
    </section>
  );
}
