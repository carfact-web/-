"use client";

import Link from "next/link";
import { cn } from "@/utils/cn";

interface KotsaLoginRequiredModalProps {
  isOpen: boolean;
  message?: string;
  onClose: () => void;
  redirectTo?: string;
  title?: string;
}

export function KotsaLoginRequiredModal({
  isOpen,
  message = "영업넘버 확인은 로그인 후 사용할 수 있습니다.",
  onClose,
  redirectTo = "/lookup",
  title = "회원 전용 확인",
}: KotsaLoginRequiredModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-5 sm:items-center">
      <section className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black">{title}</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {message}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-300"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div className="mt-4 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 text-xs font-bold text-zinc-500">
          광고 영역
        </div>
        <Link
          className={cn(
            "mt-4 flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-black text-white no-underline",
            "bg-[#FF3B30] hover:bg-[#f52f25]",
          )}
          href={"/login?redirectTo=" + encodeURIComponent(redirectTo)}
        >
          로그인 / 회원가입
        </Link>
      </section>
    </div>
  );
}
