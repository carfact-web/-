"use client";

import { brand } from "@/lib/brand";
import { cn } from "@/utils/cn";

const pageClassName = cn(
  "fixed inset-0 z-[100] flex w-full items-center justify-center overflow-y-auto bg-[#111111] px-4 py-10 text-white"
);
const contentClassName = cn(
  "flex w-full max-w-[600px] flex-col items-center text-center"
);
const buttonGroupClassName = cn("mt-10 flex w-[85%] max-w-[600px] flex-col gap-4");
const socialButtonClassName = cn(
  "relative inline-flex h-[72px] w-full items-center justify-center rounded-2xl px-6 text-base font-bold transition",
  "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
);
const iconSlotClassName = cn(
  "absolute left-6 flex h-7 w-7 items-center justify-center"
);
const errorClassName = cn(
  "mt-5 w-[85%] max-w-[600px] rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
);

interface AuthLoginPanelProps {
  authError?: string;
  className?: string;
  disabled?: boolean;
  onGoogleLogin: () => void;
  onKakaoLogin: () => void;
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path
        d="M12 4C7.03 4 3 7.18 3 11.1c0 2.45 1.58 4.61 3.99 5.88l-.72 2.64a.42.42 0 0 0 .64.46l3.13-2.08c.63.13 1.29.2 1.96.2 4.97 0 9-3.18 9-7.1S16.97 4 12 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.52Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.23-2.51c-.89.6-2.03.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.92a6.02 6.02 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.96c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthLoginPanel({
  authError = "",
  className,
  disabled = false,
  onGoogleLogin,
  onKakaoLogin,
}: AuthLoginPanelProps) {
  return (
    <section className={cn(pageClassName, className)} aria-label="로그인">
      <div className={contentClassName}>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#FF3B30]">
          CARFACT
        </p>
        <h1 className="mt-6 text-[34px] font-black leading-tight text-white sm:text-[44px]">
          <span className="text-[#FF3B30]">실매물</span>을 본 사람들의
          <br />
          <span className="text-[#FF3B30]">경험</span>이 쌓이는 곳
        </h1>
        <p className="mt-5 max-w-[520px] text-base leading-7 text-white/75 sm:text-lg">
          {brand.description}
        </p>
        <p className="mt-7 w-full max-w-[600px] text-lg leading-7 text-white/80">
          카카오 또는 Google 계정으로 간편하게 시작하세요.
        </p>

        <div className={buttonGroupClassName}>
          <button
            type="button"
            className={cn(socialButtonClassName, "bg-[#FEE500] text-[#191919]")}
            onClick={onKakaoLogin}
            disabled={disabled}
          >
            <span className={iconSlotClassName}>
              <KakaoIcon />
            </span>
            카카오로 로그인
          </button>

          <button
            type="button"
            className={cn(socialButtonClassName, "bg-white text-[#202124]")}
            onClick={onGoogleLogin}
            disabled={disabled}
          >
            <span className={iconSlotClassName}>
              <GoogleIcon />
            </span>
            Google로 로그인
          </button>
        </div>

        {authError ? <p className={errorClassName}>{authError}</p> : null}
      </div>
    </section>
  );
}
