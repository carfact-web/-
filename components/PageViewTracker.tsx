"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordPageView } from "@/lib/pageViews";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) {
      return;
    }

    void recordPageView({
      eventType: "page_view",
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
    });
  }, [pathname]);

  return null;
}
