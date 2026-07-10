"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordPageView } from "@/lib/pageViews";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) {
      return;
    }

    void recordPageView({
      eventType: "page_view",
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
    });
  }, [pathname, search]);

  return null;
}
