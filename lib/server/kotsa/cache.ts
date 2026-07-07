import { createHash } from "crypto";
import type { KotsaVehicleHistory } from "@/lib/server/kotsa/normalize";

interface CacheEntry {
  expiresAt: number;
  value: KotsaVehicleHistory;
}

const cache = new Map<string, CacheEntry>();
const defaultTtlMs = 24 * 60 * 60 * 1000;

const getCacheTtlMs = () => {
  const value = Number(process.env.KOTSA_CACHE_TTL_MS);

  return Number.isFinite(value) && value > 0 ? value : defaultTtlMs;
};

export const hashVehicleNumber = (vehicleNumber: string) =>
  createHash("sha256")
    .update(process.env.KOTSA_VEHICLE_HASH_SALT ?? "carfact-kotsa")
    .update(vehicleNumber)
    .digest("hex");

export const getCachedVehicleHistory = (vehicleNumber: string) => {
  const key = hashVehicleNumber(vehicleNumber);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

export const setCachedVehicleHistory = (
  vehicleNumber: string,
  value: KotsaVehicleHistory,
) => {
  cache.set(hashVehicleNumber(vehicleNumber), {
    expiresAt: Date.now() + getCacheTtlMs(),
    value,
  });
};

export const flushKotsaVehicleHistoryCache = () => {
  const size = cache.size;
  cache.clear();

  return size;
};
