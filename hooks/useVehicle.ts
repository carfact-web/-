"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  fetchSupabaseVehicle,
  saveSupabaseVehicle,
} from "@/lib/supabaseData";
import {
  sanitizeMileage,
  sanitizeUserText,
  sanitizeVehiclePlateNumber,
} from "@/utils/inputSanitizer";
import type { Vehicle } from "@/types/vehicle";

interface UseVehicleResult {
  vehicle: Vehicle | null;
  isNewVehicle: boolean;
  isLoadedFromExistingRegistration: boolean;
  saveVehicle: (vehicle: Vehicle) => Promise<void>;
  removeVehicle: () => void;
}

const vehiclesChangeEventName = "vehicles-change";

export const getVehicleStorageKey = (plateNumber: string) =>
  "vehicle-" + sanitizeVehiclePlateNumber(plateNumber);

const sanitizeVehicle = (vehicle: Vehicle): Vehicle => ({
  id: vehicle.id,
  plateNumber: sanitizeVehiclePlateNumber(vehicle.plateNumber),
  brand: sanitizeUserText(vehicle.brand),
  model: sanitizeUserText(vehicle.model),
  generation: sanitizeUserText(vehicle.generation),
  year: sanitizeUserText(vehicle.year),
  mileage: sanitizeMileage(vehicle.mileage),
  fuelType: sanitizeUserText(vehicle.fuelType),
  createdAt: vehicle.createdAt,
  updatedAt: vehicle.updatedAt,
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

const cacheVehicle = (storageKey: string, vehicle: Vehicle) => {
  localStorage.setItem(storageKey, JSON.stringify(sanitizeVehicle(vehicle)));
  window.dispatchEvent(new Event(vehiclesChangeEventName));
};

export function useVehicle(plateNumber: string): UseVehicleResult {
  const sanitizedPlateNumber = sanitizeVehiclePlateNumber(plateNumber);
  const vehicleStorageKey = getVehicleStorageKey(sanitizedPlateNumber);
  const vehicleJson = useSyncExternalStore(
    subscribeToVehicles,
    () => localStorage.getItem(vehicleStorageKey),
    () => null
  );
  const localVehicle = useMemo(() => parseVehicle(vehicleJson), [vehicleJson]);
  const [remoteVehicleSnapshot, setRemoteVehicleSnapshot] = useState<{
    plateNumber: string;
    vehicle: Vehicle | null;
    source: "existing-registration" | "save" | "not-found";
  } | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!sanitizedPlateNumber) {
      return () => {
        isActive = false;
      };
    }

    fetchSupabaseVehicle(sanitizedPlateNumber)
      .then((vehicle) => {
        if (!isActive || !vehicle) {
          return;
        }

        setRemoteVehicleSnapshot({
          plateNumber: sanitizedPlateNumber,
          vehicle,
          source: "existing-registration",
        });
        cacheVehicle(vehicleStorageKey, vehicle);
      })
      .catch(() => {
        if (isActive) {
          setRemoteVehicleSnapshot({
            plateNumber: sanitizedPlateNumber,
            vehicle: null,
            source: "not-found",
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [sanitizedPlateNumber, vehicleStorageKey]);

  const saveVehicle = useCallback(
    async (nextVehicle: Vehicle) => {
      const sanitizedVehicle = sanitizeVehicle(nextVehicle);

      cacheVehicle(vehicleStorageKey, sanitizedVehicle);
      setRemoteVehicleSnapshot({
        plateNumber: sanitizedPlateNumber,
        vehicle: sanitizedVehicle,
        source: "save",
      });

      try {
        const savedVehicle = await saveSupabaseVehicle(sanitizedVehicle);

        if (savedVehicle) {
          cacheVehicle(vehicleStorageKey, savedVehicle);
          setRemoteVehicleSnapshot({
            plateNumber: sanitizedPlateNumber,
            vehicle: savedVehicle,
            source: "save",
          });
        }
      } catch {
        setRemoteVehicleSnapshot({
          plateNumber: sanitizedPlateNumber,
          vehicle: sanitizedVehicle,
          source: "save",
        });
      }
    },
    [sanitizedPlateNumber, vehicleStorageKey]
  );

  const removeVehicle = useCallback(() => {
    localStorage.removeItem(vehicleStorageKey);
    setRemoteVehicleSnapshot({
      plateNumber: sanitizedPlateNumber,
      vehicle: null,
      source: "not-found",
    });
    window.dispatchEvent(new Event(vehiclesChangeEventName));
  }, [sanitizedPlateNumber, vehicleStorageKey]);

  const remoteVehicle =
    remoteVehicleSnapshot?.plateNumber === sanitizedPlateNumber
      ? remoteVehicleSnapshot.vehicle
      : null;
  const vehicle = remoteVehicle ?? localVehicle;
  const isLoadedFromExistingRegistration =
    remoteVehicleSnapshot?.plateNumber === sanitizedPlateNumber &&
    remoteVehicleSnapshot.source === "existing-registration" &&
    Boolean(remoteVehicleSnapshot.vehicle);

  return {
    vehicle,
    isNewVehicle: vehicle === null,
    isLoadedFromExistingRegistration,
    saveVehicle,
    removeVehicle,
  };
}
