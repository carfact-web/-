import type { Metadata } from "next";
import ReviewPageClient from "./ReviewPageClient";
import { fetchSupabaseReviewById, fetchSupabaseVehicle } from "@/lib/supabaseData";
import {
  createPageMetadata,
  getTextExcerpt,
  getVehicleDisplayName,
} from "@/lib/seo";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

type ReviewPageProps = {
  params: Promise<{ carNumber: string }>;
  searchParams?: Promise<{ reviewId?: string }>;
};

const getCarNumber = async (params: ReviewPageProps["params"]) => {
  const { carNumber } = await params;

  return sanitizeVehiclePlateNumber(decodeURIComponent(carNumber));
};

const getReviewTitle = (reviewResult: Awaited<ReturnType<typeof fetchSupabaseReviewById>>) => {
  if (!reviewResult) {
    return "";
  }

  const rowWithTitle = reviewResult.row as { title?: string | null };
  const storedTitle = rowWithTitle.title?.trim();

  return storedTitle || getTextExcerpt(reviewResult.review.content, 42);
};

export async function generateMetadata({
  params,
  searchParams,
}: ReviewPageProps): Promise<Metadata> {
  const carNumber = await getCarNumber(params);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const reviewId = resolvedSearchParams.reviewId?.trim();
  const [vehicle, reviewResult] = await Promise.all([
    fetchSupabaseVehicle(carNumber).catch(() => null),
    reviewId ? fetchSupabaseReviewById(reviewId).catch(() => null) : null,
  ]);
  const vehicleName = getVehicleDisplayName(vehicle) || carNumber;
  const reviewTitle = getReviewTitle(reviewResult);
  const title = reviewTitle
    ? reviewTitle + " | 카팩트"
    : vehicleName + " 후기 작성 | 카팩트";
  const description = reviewTitle
    ? reviewTitle + " 후기와 차량 정보를 카팩트에서 확인하세요."
    : vehicleName + "의 실제 후기를 남기고 차량 정보를 공유하세요.";
  const path =
    "/car/" +
    encodeURIComponent(carNumber) +
    "/review" +
    (reviewId ? "?reviewId=" + encodeURIComponent(reviewId) : "");

  return createPageMetadata({
    description,
    path,
    title,
    type: reviewTitle ? "article" : "website",
  });
}

export default function ReviewPage() {
  return <ReviewPageClient />;
}
