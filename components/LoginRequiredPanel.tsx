"use client";

import { cn } from "@/utils/cn";

const panelClassName = cn("w-full rounded-2xl bg-zinc-900 p-6");
const primaryButtonClassName = cn(
  "w-full rounded-xl bg-red-500 p-4 text-center font-bold text-white transition",
  "hover:bg-red-600 active:scale-[0.99]"
);
const secondaryButtonClassName = cn(
  "w-full rounded-xl bg-zinc-800 p-4 text-center font-bold text-zinc-100 transition",
  "hover:bg-zinc-700 active:scale-[0.99]"
);

interface LoginRequiredPanelProps {
  onHome: () => void;
  onLogin: () => void;
}

export function LoginRequiredPanel({
  onHome,
  onLogin,
}: LoginRequiredPanelProps) {
  return (
    <div className={panelClassName}>
      <p className="mb-6 text-lg font-semibold leading-7 text-zinc-100">
        더 많은 차량 이야기를 확인하려면 로그인이 필요합니다.
      </p>

      <div className="space-y-3">
        <button type="button" onClick={onLogin} className={primaryButtonClassName}>
          로그인하기
        </button>
        <button
          type="button"
          onClick={onHome}
          className={secondaryButtonClassName}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
