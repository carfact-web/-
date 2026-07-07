"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MaintenanceModeScreen } from "@/components/MaintenanceModeScreen";
import { useAuth } from "@/hooks/useAuth";

interface MaintenanceModeStatus {
  emergencyStop?: boolean;
  isAdmin?: boolean;
  maintenanceMode?: {
    enabled: boolean;
    expectedEndAt: string | null;
    message: string;
    startedAt: string | null;
  };
}

const isExcludedPath = (pathname: string) =>
  pathname.startsWith("/admin") ||
  pathname.startsWith("/api") ||
  pathname.startsWith("/auth") ||
  pathname.startsWith("/login");

export function MaintenanceModeGate() {
  const pathname = usePathname();
  const { isAdmin, session } = useAuth();
  const [status, setStatus] = useState<MaintenanceModeStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    const headers: HeadersInit = {};

    if (session?.access_token) {
      headers.Authorization = "Bearer " + session.access_token;
    }

    fetch("/api/kotsa/status", { headers })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: MaintenanceModeStatus | null) => {
        if (isMounted) {
          setStatus(payload);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  if (isExcludedPath(pathname ?? "") || isAdmin || status?.isAdmin) {
    return null;
  }

  if (status?.emergencyStop) {
    return (
      <div className="fixed inset-0 z-[100000] overflow-auto bg-black">
        <MaintenanceModeScreen message="현재 점검 중입니다. 잠시 후 다시 이용해주세요." />
      </div>
    );
  }

  if (status?.maintenanceMode?.enabled) {
    return (
      <div className="fixed inset-0 z-[100000] overflow-auto bg-black">
        <MaintenanceModeScreen
          expectedEndAt={status.maintenanceMode.expectedEndAt}
          message={status.maintenanceMode.message}
          startedAt={status.maintenanceMode.startedAt}
        />
      </div>
    );
  }

  return null;
}
