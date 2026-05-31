"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

interface NavigationItem {
  href: string;
  label: string;
  icon: "home" | "search" | "community" | "my";
  isActive: (pathname: string) => boolean;
}

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "홈",
    icon: "home",
    isActive: (pathname) => pathname === "/",
  },
  {
    href: "/lookup",
    label: "최근조회",
    icon: "search",
    isActive: (pathname) => pathname === "/lookup" || pathname.startsWith("/car"),
  },
  {
    href: "/community",
    label: "커뮤니티",
    icon: "community",
    isActive: (pathname) => pathname.startsWith("/community"),
  },
  {
    href: "/my",
    label: "내 계정",
    icon: "my",
    isActive: (pathname) => pathname.startsWith("/my"),
  },
];

const navClassName = cn(
  "fixed inset-x-0 bottom-0 z-[9000] box-border w-screen overflow-hidden border-t border-zinc-800/90 bg-zinc-950/95",
  "px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-2xl shadow-black/40 backdrop-blur md:hidden"
);

const listClassName = cn("mx-auto grid w-full max-w-md grid-cols-4 gap-1 box-border");
const itemClassName = cn(
  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold transition",
  "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 active:scale-[0.98]"
);
const activeItemClassName = cn("bg-red-500/10 text-red-300");
const iconClassName = cn("h-5 w-5");

function TabIcon({ icon }: { icon: NavigationItem["icon"] }) {
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

  if (icon === "search") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClassName}>
        <path
          d="m20 20-4.2-4.2M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
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

export function BottomTabNavigation() {
  const pathname = usePathname();

  return (
    <nav className={navClassName} aria-label="주요 메뉴">
      <div className={listClassName}>
        {navigationItems.map((item) => {
          const isActive = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(itemClassName, isActive && activeItemClassName)}
            >
              <TabIcon icon={item.icon} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
