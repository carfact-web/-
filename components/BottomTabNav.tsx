"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";

type TabIconName =
  | "home"
  | "recent"
  | "commercial"
  | "community"
  | "my"
  | "admin";

const navClassName = cn(
  "fixed inset-x-0 bottom-0 z-50 w-screen overflow-hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
);
const navInnerClassName = cn(
  "mx-auto grid w-full max-w-3xl gap-1 box-border px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
);
const tabButtonClassName = cn(
  "inline-flex h-14 min-w-0 w-full flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold transition",
  "text-zinc-400 hover:text-white"
);
const activeTabButtonClassName = cn(
  "bg-zinc-900 text-white shadow-lg shadow-black/30"
);
const commercialTabButtonClassName = cn(
  "text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
);
const activeCommercialTabButtonClassName = cn(
  "border border-amber-400/30 bg-amber-400/15 text-amber-200 shadow-lg shadow-amber-950/30"
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
  { href: "/commercial-plate", label: "영업넘버", icon: "commercial", matchPrefix: true },
  { href: "/my", label: "내 계정", icon: "my", matchPrefix: true },
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

  if (icon === "commercial") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
        <path
          d="M5 7.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M7 17v2M17 17v2M7.5 12.2h3M13.5 12.2h3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "admin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
        <path
          d="M12 3 5 6v5.5c0 4.2 2.9 7.9 7 9.5 4.1-1.6 7-5.3 7-9.5V6l-7-3Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M9 12.5 11 14.5 15.5 9.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
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
  const { isAdmin } = useAuth();
  const visibleTabs = isAdmin
    ? [
        ...tabs,
        {
          href: "/admin",
          icon: "admin" as const,
          label: "관리자",
          matchPrefix: true,
        },
      ]
    : tabs;

  const isActive = (href: string, matchPrefix: boolean) => {
    if (matchPrefix) {
      return pathname?.startsWith(href);
    }
    return pathname === href;
  };

  return (
    <nav className={navClassName} aria-label="하단 탐색">
      <div
        className={navInnerClassName}
        style={{
          gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
        }}
      >
        {visibleTabs.map((tab) => {
          const isTabActive = isActive(tab.href, tab.matchPrefix);
          const isCommercialTab = tab.icon === "commercial";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                tabButtonClassName,
                isCommercialTab && commercialTabButtonClassName,
                isTabActive && activeTabButtonClassName,
                isCommercialTab &&
                  isTabActive &&
                  activeCommercialTabButtonClassName,
              )}
              aria-current={isTabActive ? "page" : undefined}
            >
              <TabIcon icon={tab.icon} />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
