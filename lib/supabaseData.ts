import { supabase } from "@/lib/supabase";
import {
  createSupabaseFailureError,
  isRlsPolicyError,
} from "@/lib/supabaseErrorMessages";
import {
  getPersistableReviewImages,
  uploadReviewImages,
} from "@/lib/reviewImages";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import type { Json } from "@/types/supabase";
import type {
  Review,
  ReviewImageAttachment,
  ReviewReportInsert,
  ReviewRow,
} from "@/types/review";
import type { Vehicle, VehicleRow } from "@/types/vehicle";

const toLocaleDateTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const createReviewId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return String(Date.now());
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toReviewImages = (value: Json): ReviewImageAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const images = (value as unknown[]).filter(isRecord);

  return images.map((image) => ({
    id: String(image.id ?? image.url ?? image.path ?? Date.now()),
    name: String(image.name ?? "후기 이미지"),
    type:
      image.type === "image/png" || image.type === "image/webp"
        ? image.type
        : "image/jpeg",
    url: typeof image.url === "string" ? image.url : undefined,
    path: typeof image.path === "string" ? image.path : undefined,
    size: typeof image.size === "number" ? image.size : 0,
  }));
};

const toVehicleSnapshot = (value: Json): Vehicle | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    plateNumber:
      typeof value.plateNumber === "string"
        ? sanitizeVehiclePlateNumber(value.plateNumber)
        : "",
    brand: typeof value.brand === "string" ? value.brand : "",
    model: typeof value.model === "string" ? value.model : "",
    generation: typeof value.generation === "string" ? value.generation : "",
    year: typeof value.year === "string" ? value.year : "",
    mileage: typeof value.mileage === "string" ? value.mileage : "",
    fuelType: typeof value.fuelType === "string" ? value.fuelType : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
};

export const mapVehicleRow = (row: VehicleRow): Vehicle => ({
  id: row.id,
  plateNumber: sanitizeVehiclePlateNumber(row.car_number),
  brand: row.manufacturer,
  model: row.model,
  generation: row.generation ?? "",
  year: row.year,
  mileage: row.mileage ?? "",
  fuelType: row.fuel_type ?? "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapReviewRow = (row: ReviewRow): Review => ({
  id: row.id,
  authorNickname: row.author_nickname ?? "익명 사용자",
  content: row.content,
  tags: row.tags ?? [],
  images: toReviewImages(row.images),
  hasImages: toReviewImages(row.images).length > 0,
  helpfulCount: 0,
  reportCount: row.report_count,
  createdAt: toLocaleDateTime(row.created_at),
  vehicleSnapshot: toVehicleSnapshot(row.vehicle_snapshot),
});

export const fetchSupabaseVehicle = async (plateNumber: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("car_number", sanitizeVehiclePlateNumber(plateNumber))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapVehicleRow(data) : null;
};

export const saveSupabaseVehicle = async (vehicle: Vehicle) => {
  if (!supabase) {
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("vehicles")
    .upsert(
      {
        car_number: sanitizeVehiclePlateNumber(vehicle.plateNumber),
        manufacturer: vehicle.brand,
        model: vehicle.model,
        generation: vehicle.generation || null,
        year: vehicle.year,
        mileage: vehicle.mileage || null,
        fuel_type: vehicle.fuelType || null,
        updated_at: now,
      },
      { onConflict: "car_number" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapVehicleRow(data);
};

export const fetchSupabaseReviews = async (plateNumber: string) => {
  if (!supabase) {
    return null;
  }

  const vehicle = await fetchSupabaseVehicle(plateNumber);

  if (!vehicle?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(mapReviewRow);
};

export const saveSupabaseReview = async (
  plateNumber: string,
  review: Review
) => {
  if (!supabase) {
    return null;
  }

  const vehicle =
    (await fetchSupabaseVehicle(plateNumber)) ||
    (review.vehicleSnapshot
      ? await saveSupabaseVehicle(review.vehicleSnapshot)
      : null);

  if (!vehicle?.id) {
    throw new Error("vehicle-not-found");
  }

  const authorNickname = review.authorNickname?.trim();

  if (!authorNickname) {
    throw new Error("author-nickname-required");
  }

  const reviewId = createReviewId();
  const uploadedImages = await uploadReviewImages(review.images ?? [], reviewId);
  const now = new Date().toISOString();
  const payload = {
    id: reviewId,
    vehicle_id: vehicle.id,
    author_nickname: authorNickname,
    content: review.content,
    tags: review.tags ?? [],
    images: getPersistableReviewImages(uploadedImages) as Json,
    vehicle_snapshot: {
      ...(review.vehicleSnapshot ?? vehicle),
      id: vehicle.id,
      plateNumber: sanitizeVehiclePlateNumber(plateNumber),
    } as Json,
    report_count: review.reportCount ?? 0,
    created_at: now,
  };

  console.log("review-insert-payload", payload);

  const { data, error } = await supabase
    .from("reviews")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error(
      isRlsPolicyError(error) ? "review-rls-policy-error" : "review-db-insert-error",
      {
        table: "reviews",
        error,
      }
    );
    throw createSupabaseFailureError("db-insert", error);
  }

  return mapReviewRow(data);
};

export const saveSupabaseReviewReport = async (
  report: ReviewReportInsert
) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("review_reports")
    .insert(report)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const updateSupabaseReviewHelpfulCount = async (
  reviewId: string,
  helpfulCount: number
) => {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc("set_review_helpful_count", {
    p_helpful_count: helpfulCount,
    p_review_id: reviewId,
  });

  if (error) {
    throw error;
  }
};
