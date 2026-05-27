"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  sanitizeMileage,
  sanitizeUserText,
  sanitizeVehiclePlateNumber,
} from "@/utils/inputSanitizer";
import type { Vehicle } from "@/types/vehicle";

interface UseVehicleResult {
  vehicle: Vehicle | null;
  isNewVehicle: boolean;
  saveVehicle: (vehicle: Vehicle) => void;
  removeVehicle: () => void;
}

const vehiclesChangeEventName = "vehicles-change";

export const getVehicleStorageKey = (plateNumber: string) =>
  "vehicle-" + sanitizeVehiclePlateNumber(plateNumber);

const sanitizeVehicle = (vehicle: Vehicle): Vehicle => ({
  plateNumber: sanitizeVehiclePlateNumber(vehicle.plateNumber),
  brand: sanitizeUserText(vehicle.brand),
  model: sanitizeUserText(vehicle.model),
  generation: sanitizeUserText(vehicle.generation),
  year: sanitizeUserText(vehicle.year),
  mileage: sanitizeMileage(vehicle.mileage),
  fuelType: sanitizeUserText(vehicle.fuelType),
});

const parseVehicle = (vehicleJson: string | null): Vehicle | null => {
  if (!vehicleJson) {
    return null;
  }

  try {
    return sanitizeVehicle(JSON.parse(vehicleJson) as Vehicle);
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
  const sanitizedPlateNumber = sanitizeVehiclePlateNumber(plateNumber);
  const vehicleStorageKey = getVehicleStorageKey(sanitizedPlateNumber);
  const vehicleJson = useSyncExternalStore(
    subscribeToVehicles,
    () => localStorage.getItem(vehicleStorageKey),
    () => null
  );
  const vehicle = useMemo(() => parseVehicle(vehicleJson), [vehicleJson]);

  const saveVehicle = useCallback(
    (nextVehicle: Vehicle) => {
      localStorage.setItem(
        vehicleStorageKey,
        JSON.stringify(sanitizeVehicle(nextVehicle))
      );
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
