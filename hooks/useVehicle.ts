"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Vehicle } from "@/types/vehicle";

interface UseVehicleResult {
  vehicle: Vehicle | null;
  isNewVehicle: boolean;
  saveVehicle: (vehicle: Vehicle) => void;
  removeVehicle: () => void;
}

const vehiclesChangeEventName = "vehicles-change";

export const getVehicleStorageKey = (plateNumber: string) =>
  `vehicle-${plateNumber}`;

const parseVehicle = (vehicleJson: string | null): Vehicle | null => {
  if (!vehicleJson) {
    return null;
  }

  try {
    return JSON.parse(vehicleJson) as Vehicle;
  } catch {
    return null;
  }
};

const subscribeToVehicles = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(vehiclesChangeEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(vehiclesChangeEventName, onStoreChange);
  };
};

export function useVehicle(plateNumber: string): UseVehicleResult {
  const vehicleStorageKey = getVehicleStorageKey(plateNumber);
  const vehicleJson = useSyncExternalStore(
    subscribeToVehicles,
    () => localStorage.getItem(vehicleStorageKey),
    () => null
  );
  const vehicle = useMemo(() => parseVehicle(vehicleJson), [vehicleJson]);

  const saveVehicle = useCallback(
    (nextVehicle: Vehicle) => {
      localStorage.setItem(vehicleStorageKey, JSON.stringify(nextVehicle));
      window.dispatchEvent(new Event(vehiclesChangeEventName));
    },
    [vehicleStorageKey]
  );

  const removeVehicle = useCallback(() => {
    localStorage.removeItem(vehicleStorageKey);
    window.dispatchEvent(new Event(vehiclesChangeEventName));
  }, [vehicleStorageKey]);

  return {
    vehicle,
    isNewVehicle: vehicle === null,
    saveVehicle,
    removeVehicle,
  };
}
