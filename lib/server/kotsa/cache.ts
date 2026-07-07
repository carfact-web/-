import { createHash } from "crypto";
import { getSupabaseAdminClients } from "@/lib/server/kotsa/supabaseAdmin";
import { maskVehicleNumber } from "@/lib/server/kotsa/vehicleNumber";
import type { KotsaVehicleHistory } from "@/types/kotsa";

interface CacheEntry {
  expiresAt: number;
  value: KotsaVehicleHistory;
}

const cache = new Map<string, CacheEntry>();
const cacheTtlMs = 24 * 60 * 60 * 1000;

const getCacheExpiresAt = () => new Date(Date.now() + cacheTtlMs).toISOString();

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
    expiresAt: Date.now() + cacheTtlMs,
    value,
  });
};

export const deleteCachedVehicleHistory = (vehicleNumber: string) =>
  cache.delete(hashVehicleNumber(vehicleNumber));

export const getCachedVehicleHistoryFromDb = async (vehicleNumber: string) => {
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return null;
  }

  const { data, error } = await clients.admin
    .from("kotsa_vehicle_history_cache")
    .select("data,expires_at")
    .eq("vehicle_number_hash", hashVehicleNumber(vehicleNumber))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data?.data) {
    return null;
  }

  return data.data as KotsaVehicleHistory;
};

export const setCachedVehicleHistoryInDb = async (
  vehicleNumber: string,
  value: KotsaVehicleHistory,
) => {
  const clients = getSupabaseAdminClients();

  if (!clients) {
    return;
  }

  await clients.admin.from("kotsa_vehicle_history_cache").upsert(
    {
      data: value,
      expires_at: getCacheExpiresAt(),
      response_code: value.responseCode ?? null,
      updated_at: new Date().toISOString(),
      vehicle_number_hash: hashVehicleNumber(vehicleNumber),
      vehicle_number_masked: maskVehicleNumber(vehicleNumber),
    },
    { onConflict: "vehicle_number_hash" },
  );
};

export const flushKotsaVehicleHistoryCache = () => {
  const size = cache.size;
  cache.clear();

  return size;
};
