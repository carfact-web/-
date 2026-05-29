"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

type TabIconName = "home" | "recent" | "community" | "my";

const navClassName = cn(
  "fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
);
const navInnerClassName = cn(
  "mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
);
const tabButtonClassName = cn(
  "inline-flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold transition",
  "text-zinc-400 hover:text-white"
);
const activeTabButtonClassName = cn(
  "bg-zinc-900 text-white shadow-lg shadow-black/30"
);
const iconClassName = cn("h-5 w-5");

const tabs: {
  href: string;
  icon: TabIconName;
  label: string;
  matchPrefix: boolean;
}[] = [
  { href: "/", label: "홈", icon: "home", matchPrefix: false },
  { href: "/recent", label: "최근조회", icon: "recent", matchPrefix: true },
  { href: "/community", label: "커뮤니티", icon: "community", matchPrefix: true },
  { href: "/my", label: "마이", icon: "my", matchPrefix: true },
];

function TabIcon({ icon }: { icon: TabIconName }) {
  if (icon === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
        <path
          d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.2Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "recent") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
        <path
          d="M3.5 12a8.5 8.5 0 1 0 2.49-6.01M3.5 4.5v5h5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M12 7.5V12l3 2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "community") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
        <path
          d="M5 6h14v9H8l-3 3V6Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M9 10h6M9 13h4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

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
            <TabIcon icon={tab.icon} />
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
