"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

const navClassName = cn(
  "fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
);
const navInnerClassName = cn(
  "mx-auto flex max-w-3xl items-center justify-around px-4 py-3"
);
const tabButtonClassName = cn(
  "inline-flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-sm font-semibold transition",
  "text-zinc-400 hover:text-white"
);
const activeTabButtonClassName = cn(
  "text-white bg-zinc-900 shadow-lg shadow-black/30"
);
const tabLabelClassName = cn("text-xs tracking-wide");

export function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav className={navClassName} aria-label="하단 탐색">
      <div className={navInnerClassName}>
        <Link
          href="/"
          className={cn(
            tabButtonClassName,
            pathname === "/" ? activeTabButtonClassName : ""
          )}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <span>홈</span>
          <span className={tabLabelClassName}>메인</span>
        </Link>

        <Link
          href="/recent"
          className={cn(
            tabButtonClassName,
            pathname?.startsWith("/recent") ? activeTabButtonClassName : ""
          )}
          aria-current={pathname?.startsWith("/recent") ? "page" : undefined}
        >
          <span>최근조회</span>
          <span className={tabLabelClassName}>최근</span>
        </Link>
      </div>
    </nav>
  );
}
