"use client";

import { cn } from "@/utils/cn";

type KotsaLookupResultType = "not_business" | "error";

interface KotsaLookupResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: KotsaLookupResultType;
}

const contentByType = {
  error: {
    body: "조회 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해주세요.",
    title: "조회 실패",
  },
  not_business: {
    body: "카팩트는\n현재 상품용(사업용) 차량만\n조회 및 후기를 제공합니다.\n\n조회는 종료됩니다.",
    title: "상품용 차량이 아닙니다.",
  },
} satisfies Record<KotsaLookupResultType, { body: string; title: string }>;

export function KotsaLookupResultModal({
  isOpen,
  onClose,
  type,
}: KotsaLookupResultModalProps) {
  if (!isOpen) {
    return null;
  }

  const content = contentByType[type];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-5 sm:items-center">
      <section className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl shadow-black/40">
        <p className="text-lg font-black">{content.title}</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-300">
          {content.body}
        </p>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "mt-5 w-full rounded-lg px-4 py-3 text-sm font-black text-white transition",
            "bg-[#FF3B30] hover:bg-[#f52f25]",
          )}
        >
          확인
        </button>
      </section>
    </div>
  );
}
