import { supabase } from "@/lib/supabase";
import type { CommunityImageAttachment } from "@/types/community";

export const communityImagesBucketName = "community-images";

export interface CommunityImageUploadResult {
  errorMessage: string;
  failedCount: number;
  images: CommunityImageAttachment[];
}

const getSafeFileName = (name: string) =>
  name
    .trim()
    .replace(/[^0-9a-zA-Z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "community-image";

const getImageBlob = async (image: CommunityImageAttachment) => {
  if (!image.url?.startsWith("data:")) {
    throw new Error("missing-image-data");
  }

  const response = await fetch(image.url);

  if (!response.ok) {
    throw new Error("invalid-image-data");
  }

  return response.blob();
};

export const uploadCommunityImages = async (
  images: CommunityImageAttachment[],
  postId: string
) : Promise<CommunityImageUploadResult> => {
  if (!supabase || images.length === 0) {
    return {
      errorMessage: "",
      failedCount: 0,
      images,
    };
  }

  const client = supabase;
  const uploadedImages: CommunityImageAttachment[] = [];
  const errors: string[] = [];

  await Promise.all(
    images.map(async (image, index) => {
      try {
        if (image.path && image.url && !image.url.startsWith("data:")) {
          uploadedImages.push(image);
          return;
        }

        const blob = await getImageBlob(image);
        const path = [
          postId,
          Date.now(),
          index,
          getSafeFileName(image.name),
        ].join("/");
        const { error } = await client.storage
          .from(communityImagesBucketName)
          .upload(path, blob, {
            contentType: image.type,
            upsert: false,
          });

        if (error) {
          throw error;
        }

        const { data } = client.storage
          .from(communityImagesBucketName)
          .getPublicUrl(path);

        uploadedImages.push({
          id: image.id,
          name: image.name,
          path,
          size: image.size,
          type: image.type,
          url: data.publicUrl,
        });
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "이미지 업로드 실패"
        );
      }
    })
  );

  return {
    errorMessage: errors[0] ?? "",
    failedCount: errors.length,
    images: uploadedImages,
  };
};

export const getPersistableCommunityImages = (
  images: CommunityImageAttachment[]
) =>
  images.map((image) => ({
    id: image.id,
    name: image.name,
    path: image.path,
    size: image.size,
    type: image.type,
    url: image.url,
  }));
