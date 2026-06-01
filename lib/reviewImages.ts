import { supabase } from "@/lib/supabase";
import { createSupabaseFailureError } from "@/lib/supabaseErrorMessages";
import type { ReviewImageAttachment } from "@/types/review";

export const reviewImagesBucketName = "review-images";

const getSafeFileName = (name: string) =>
  name
    .trim()
    .replace(/[^0-9a-zA-Z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "review-image";

const getImageBlob = async (image: ReviewImageAttachment) => {
  if (!image.dataUrl) {
    throw new Error("missing-image-data");
  }

  const response = await fetch(image.dataUrl);

  if (!response.ok) {
    throw new Error("invalid-image-data");
  }

  return response.blob();
};

export const uploadReviewImages = async (
  images: ReviewImageAttachment[],
  reviewId: string
): Promise<ReviewImageAttachment[]> => {
  if (!supabase || images.length === 0) {
    return images;
  }

  const client = supabase;

  return Promise.all(
    images.map(async (image, index) => {
      if (image.url && image.path) {
        return image;
      }

      const blob = await getImageBlob(image);
      const path = [
        reviewId,
        Date.now(),
        index,
        getSafeFileName(image.name),
      ].join("/");
      const { error } = await client.storage
        .from(reviewImagesBucketName)
        .upload(path, blob, {
          contentType: image.type,
          upsert: false,
        });

      if (error) {
        console.error("review-image-upload-error", {
          bucket: reviewImagesBucketName,
          path,
          error,
        });
        throw createSupabaseFailureError("storage-upload", error);
      }

      const { data } = client.storage
        .from(reviewImagesBucketName)
        .getPublicUrl(path);

      return {
        id: image.id,
        name: image.name,
        type: image.type,
        url: data.publicUrl,
        path,
        size: image.size,
      };
    })
  );
};

export const getPersistableReviewImages = (images: ReviewImageAttachment[]) =>
  images.map((image) => ({
    id: image.id,
    name: image.name,
    type: image.type,
    url: image.url,
    path: image.path,
    size: image.size,
  }));
