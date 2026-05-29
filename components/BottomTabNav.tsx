"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

const navClassName = cn(
  "fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
);
const navInnerClassName = cn(
  "mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
);
const tabButtonClassName = cn(
  "inline-flex w-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition",
  "text-zinc-400 hover:text-white"
);
const activeTabButtonClassName = cn(
  "text-white bg-zinc-900 shadow-lg shadow-black/30"
);
const tabLabelClassName = cn("text-[10px] tracking-wide");

const tabs = [
  { href: "/", label: "홈", sublabel: "메인", matchPrefix: false },
  { href: "/recent", label: "최근조회", sublabel: "최근", matchPrefix: true },
  { href: "/community", label: "커뮤니티", sublabel: "커뮤", matchPrefix: true },
  { href: "/my", label: "마이", sublabel: "내정보", matchPrefix: true },
];

export function BottomTabNav() {
  const pathname = usePathname();

  const isActive = (href: string, matchPrefix: boolean) => {
    if (matchPrefix) {
      return pathname?.startsWith(href);
    }
    return pathname === href;
  };

  return (
    <nav className={navClassName} aria-label="하단 탐색">
      <div className={navInnerClassName}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              tabButtonClassName,
              isActive(tab.href, tab.matchPrefix) ? activeTabButtonClassName : ""
            )}
            aria-current={isActive(tab.href, tab.matchPrefix) ? "page" : undefined}
          >
            <span>{tab.label}</span>
            <span className={tabLabelClassName}>{tab.sublabel}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
