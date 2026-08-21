import { supabase } from "@/lib/supabase";
import {
  createReviewIndexNowUrl,
  createVehicleIndexNowUrl,
} from "@/lib/indexNow";
import { notifyIndexNow } from "@/lib/indexNowClient";
import {
  createSupabaseFailureError,
  isRlsPolicyError,
} from "@/lib/supabaseErrorMessages";
import {
  getPersistableReviewImages,
  uploadReviewImages,
} from "@/lib/reviewImages";
import { fetchVerifiedDealerMap } from "@/lib/verifiedDealers";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import type { ReviewKeywordStat } from "@/utils/reviewKeywordStats";
import { hasSameVehicleModelKey } from "@/utils/vehicleModelKey";
import {
  getGroupedVehicleIssueKeywordDefinitions,
  type VehicleIssueKeywordRule,
} from "@/utils/vehicleIssueKeywords";
import type { Json } from "@/types/supabase";
import type {
  Review,
  ReviewImageAttachment,
  ReviewReportInsert,
  ReviewRow,
} from "@/types/review";
import type { Vehicle, VehicleRow } from "@/types/vehicle";

type ReviewRowWithTraffic = ReviewRow & {
  view_count?: number | string | null;
  recent_view_count?: number | string | null;
};

interface ModelReviewKeywordStatsResult {
  keywordStats: ReviewKeywordStat[];
  reviewCount: number;
}

interface ModelReviewKeywordStatsRow {
  keyword_label: string | null;
  mention_count: number | string | null;
  model_review_count: number | string | null;
  percentage: number | string | null;
  priority?: number | string | null;
  recent_mentioned_at?: string | null;
}

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
    createdAt:
      typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
};

const toNumber = (value: unknown) => {
  const numberValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(value ?? 0);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const toNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

export interface HomeTopVehicle {
  vehicleId: string;
  viewCount: number;
  carNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  generation: string | null;
  modelDetail: string | null;
}

export interface HomeTopModel {
  modelName: string | null;
  manufacturer: string | null;
  viewCount: number;
}

export interface HomeTrafficRankings {
  topVehicles: HomeTopVehicle[];
  topModels: HomeTopModel[];
}

const toHomeTopVehicles = (value: Json): HomeTopVehicle[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        vehicleId: String(item.vehicle_id ?? ""),
        viewCount: toNumber(item.view_count),
        carNumber: toNullableString(item.car_number),
        manufacturer: toNullableString(item.manufacturer),
        model: toNullableString(item.model),
        generation: toNullableString(item.generation),
        modelDetail: toNullableString(item.model_detail),
      }))
    : [];

const toHomeTopModels = (value: Json): HomeTopModel[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(isRecord).map((item) => ({
        modelName: toNullableString(item.model_name),
        manufacturer: toNullableString(item.manufacturer),
        viewCount: toNumber(item.view_count),
      }))
    : [];

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

export const mapReviewRow = (
  row: ReviewRowWithTraffic,
  verifiedDealers: Record<string, boolean> = {},
): Review => ({
  id: row.id,
  authorId: row.author_id ?? undefined,
  authorNickname: row.author_nickname ?? "익명 사용자",
  authorIsVerifiedDealer: row.author_id
    ? (verifiedDealers[row.author_id] ?? false)
    : false,
  content: row.content,
  tags: row.tags ?? [],
  images: toReviewImages(row.images),
  hasImages: toReviewImages(row.images).length > 0,
  helpfulCount: row.helpful_count,
  reportCount: row.report_count,
  viewCount: toNumber(row.view_count),
  recentViewCount: toNumber(row.recent_view_count),
  isHidden: row.is_hidden,
  createdAt: toLocaleDateTime(row.created_at),
  vehicleSnapshot: toVehicleSnapshot(row.vehicle_snapshot),
});

export const fetchSupabaseVehicle = async (plateNumber: string) => {
  if (!supabase) {
    return null;
  }

  const normalizedPlateNumber = sanitizeVehiclePlateNumber(plateNumber);

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("car_number", normalizedPlateNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapVehicleRow(data) : null;
};

const fetchSupabaseVehicleByIdAndPlate = async (
  vehicleId: string | undefined,
  plateNumber: string,
) => {
  if (!supabase || !vehicleId) {
    return null;
  }

  const normalizedPlateNumber = sanitizeVehiclePlateNumber(plateNumber);

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("car_number", normalizedPlateNumber)
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
      { onConflict: "car_number" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const savedVehicle = mapVehicleRow(data);

  void notifyIndexNow({
    reason: "vehicle-save",
    urls: [createVehicleIndexNowUrl(savedVehicle.plateNumber)],
  });

  return savedVehicle;
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
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const verifiedDealers = await fetchVerifiedDealerMap(
    data.map((review) => review.author_id),
  );

  return data.map((review) => mapReviewRow(review, verifiedDealers));
};

export const fetchSupabaseReviewsByVehicleModel = async (vehicle: Vehicle) => {
  if (!supabase || !vehicle.brand || !vehicle.model) {
    return null;
  }

  const { data: candidateVehicles, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("manufacturer", vehicle.brand);

  if (vehicleError) {
    throw vehicleError;
  }

  const matchedVehicleIds = (candidateVehicles ?? [])
    .filter((candidateVehicle) =>
      hasSameVehicleModelKey(mapVehicleRow(candidateVehicle), vehicle),
    )
    .map((candidateVehicle) => candidateVehicle.id);

  if (matchedVehicleIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .in("vehicle_id", matchedVehicleIds)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const verifiedDealers = await fetchVerifiedDealerMap(
    data.map((review) => review.author_id),
  );

  return data.map((review) => mapReviewRow(review, verifiedDealers));
};

const toModelReviewKeywordDefinitionPayload = (
  keywordRules: VehicleIssueKeywordRule[],
) =>
  getGroupedVehicleIssueKeywordDefinitions(keywordRules).map(
    (definition, index) => ({
      aliases: definition.aliases,
      exclude_aliases: definition.excludeAliases ?? [],
      fuel_type: definition.fuelType ?? "",
      label: definition.label,
      priority: 0,
      sort_order: index,
      target_model: definition.targetModel ?? "",
    }),
  );

export const fetchSupabaseModelReviewKeywordStats = async (
  vehicle: Vehicle,
  keywordRules: VehicleIssueKeywordRule[] = [],
): Promise<ModelReviewKeywordStatsResult | null> => {
  if (!supabase || !vehicle.brand || !vehicle.model) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    "public_get_model_review_keyword_stats",
    {
      p_fuel_type: vehicle.fuelType ?? "",
      p_generation: vehicle.generation ?? "",
      p_keyword_definitions: toModelReviewKeywordDefinitionPayload(keywordRules),
      p_limit: 5,
      p_manufacturer: vehicle.brand,
      p_model: vehicle.model,
    },
  );

  if (error) {
    if (error.message.includes("public_get_model_review_keyword_stats")) {
      return null;
    }

    throw error;
  }

  const rows = (data ?? []) as ModelReviewKeywordStatsRow[];
  const reviewCount = Number(rows[0]?.model_review_count ?? 0);
  const keywordStats = rows
    .filter((row) => row.keyword_label)
    .map((row) => ({
      count: Number(row.mention_count ?? 0),
      label: row.keyword_label ?? "",
      percentage: Number(row.percentage ?? 0),
    }))
    .filter((stat) => stat.label && stat.count > 0);

  return {
    keywordStats,
    reviewCount,
  };
};

export const fetchSupabaseReviewById = async (reviewId: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const verifiedDealers = await fetchVerifiedDealerMap(
    data.author_id ? [data.author_id] : [],
  );

  return {
    review: mapReviewRow(data, verifiedDealers),
    row: data,
  };
};

export const fetchRecentSupabaseReviews = async (limit = 20) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("public_get_recent_home_reviews", {
    review_limit: limit,
  });

  if (error) {
    throw error;
  }

  const verifiedDealers = await fetchVerifiedDealerMap(
    data.map((review) => review.author_id),
  );

  return data.map((review) => mapReviewRow(review, verifiedDealers));
};

export const fetchHomeTrafficRankings =
  async (): Promise<HomeTrafficRankings | null> => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.rpc(
      "public_get_home_traffic_rankings",
    );

    if (error) {
      throw error;
    }

    const rankings = data?.[0];

    return {
      topVehicles: toHomeTopVehicles(rankings?.top_vehicles ?? []),
      topModels: toHomeTopModels(rankings?.top_models ?? []),
    };
  };

export const saveSupabaseReview = async (
  plateNumber: string,
  review: Review,
  authorId: string,
) => {
  if (!supabase) {
    return null;
  }

  const normalizedPlateNumber = sanitizeVehiclePlateNumber(plateNumber);
  const snapshotVehicleId = review.vehicleSnapshot?.id;
  const vehicle =
    (await fetchSupabaseVehicleByIdAndPlate(
      snapshotVehicleId,
      normalizedPlateNumber,
    )) || (await fetchSupabaseVehicle(normalizedPlateNumber));

  if (!vehicle?.id) {
    throw new Error("vehicle-not-found");
  }

  const authorNickname = review.authorNickname?.trim();

  if (!authorNickname) {
    throw new Error("author-nickname-required");
  }

  const reviewId = createReviewId();
  const uploadedImages = await uploadReviewImages(
    review.images ?? [],
    reviewId,
  );
  const now = new Date().toISOString();
  const payload = {
    id: reviewId,
    vehicle_id: vehicle.id,
    author_id: authorId,
    author_nickname: authorNickname,
    content: review.content,
    tags: review.tags ?? [],
    images: getPersistableReviewImages(uploadedImages) as Json,
    vehicle_snapshot: {
      ...(review.vehicleSnapshot ?? vehicle),
      id: vehicle.id,
      plateNumber: normalizedPlateNumber,
    } as Json,
    helpful_count: review.helpfulCount ?? 0,
    report_count: review.reportCount ?? 0,
    is_hidden: false,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("reviews")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error(
      isRlsPolicyError(error)
        ? "review-rls-policy-error"
        : "review-db-insert-error",
      {
        table: "reviews",
        error,
      },
    );
    throw createSupabaseFailureError("db-insert", error);
  }

  const verifiedDealers = await fetchVerifiedDealerMap([data.author_id]);
  const savedReview = mapReviewRow(data, verifiedDealers);

  void notifyIndexNow({
    reason: "review-save",
    urls: [
      createVehicleIndexNowUrl(vehicle.plateNumber),
      createReviewIndexNowUrl(vehicle.plateNumber, String(savedReview.id)),
    ],
  });

  return savedReview;
};

export const updateSupabaseReview = async (
  reviewId: string,
  input: Pick<Review, "content" | "tags" | "images">,
) => {
  if (!supabase) {
    return false;
  }

  const uploadedImages = await uploadReviewImages(input.images ?? [], reviewId);
  const { data, error } = await supabase.rpc("update_review", {
    target_review_id: reviewId,
    next_content: input.content,
    next_tags: input.tags ?? [],
    next_images: getPersistableReviewImages(uploadedImages) as Json,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
};

export const hideSupabaseReview = async (reviewId: string) => {
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase.rpc("hide_review", {
    target_review_id: reviewId,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
};

export const saveSupabaseReviewReport = async (report: ReviewReportInsert) => {
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
  helpfulCount: number,
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

export const fetchSupabaseReviewHelpfulSnapshot = async (
  reviewId: string,
  userId: string,
) => {
  if (!supabase) {
    return null;
  }

  const [reviewResult, helpfulResult] = await Promise.all([
    supabase
      .from("reviews")
      .select("helpful_count")
      .eq("id", reviewId)
      .maybeSingle(),
    supabase
      .from("review_helpful")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (reviewResult.error) {
    throw reviewResult.error;
  }

  if (helpfulResult.error) {
    throw helpfulResult.error;
  }

  return {
    count: toNumber(reviewResult.data?.helpful_count),
    isVoted: Boolean(helpfulResult.data),
  };
};

export const toggleSupabaseReviewHelpful = async (reviewId: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("toggle_review_helpful", {
    target_review_id: reviewId,
  });

  if (error) {
    throw error;
  }

  const snapshot = data?.[0];

  if (!snapshot) {
    return null;
  }

  return {
    count: toNumber(snapshot.helpful_count),
    isVoted: Boolean(snapshot.is_voted),
  };
};
