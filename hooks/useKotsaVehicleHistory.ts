"use client";

import { useCallback, useState } from "react";
import type {
  KotsaVehicleDisplayInfo,
  KotsaVehicleHistory,
} from "@/types/kotsa";

export interface KotsaVehicleHistoryResponse {
  businessVehicle?: boolean;
  cached?: boolean;
  code?: string;
  data?: KotsaVehicleHistory;
  display?: KotsaVehicleDisplayInfo | null;
  error?: string;
  ok: boolean;
  requestId?: string;
}

interface LookupInput {
  accessToken: string;
  vehicleNumber: string;
}

export function useKotsaVehicleHistory() {
  const [isLoading, setIsLoading] = useState(false);

  const lookup = useCallback(
    async ({ accessToken, vehicleNumber }: LookupInput) => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/kotsa/vehicle-history", {
          body: JSON.stringify({ vehicleNumber }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({
          ok: false,
          error: "조회 정보를 불러오지 못했습니다.",
        }))) as KotsaVehicleHistoryResponse;

        return {
          ...payload,
          ok: response.ok && payload.ok,
          status: response.status,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { isLoading, lookup };
}
