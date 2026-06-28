import type { Vehicle } from "@/types/vehicle";

const normalizeModelText = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9a-zㄱ-ㅎ가-힣]+/g, "");

export const getVehicleModelKey = (
  vehicle: Pick<Vehicle, "brand" | "model" | "generation">,
) =>
  [
    normalizeModelText(vehicle.brand),
    normalizeModelText(vehicle.model),
    normalizeModelText(vehicle.generation),
  ].join("|");

export const hasSameVehicleModelKey = (
  left: Pick<Vehicle, "brand" | "model" | "generation">,
  right: Pick<Vehicle, "brand" | "model" | "generation">,
) => getVehicleModelKey(left) === getVehicleModelKey(right);
