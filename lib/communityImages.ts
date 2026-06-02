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

const getWebpFileName = (name: string) => {
  const safeName = getSafeFileName(name).replace(/\.[^.]+$/, "");

  return `${safeName || "community-image"}.webp`;
};

export const getCommunityImagePublicUrl = (storedImageValue?: string) => {
  if (!storedImageValue) {
    return undefined;
  }

  if (/^https?:\/\//.test(storedImageValue)) {
    return storedImageValue;
  }

  if (!supabase) {
    return storedImageValue;
  }

  const path = storedImageValue.replace(/^community-images\//, "");

  return supabase.storage
    .from(communityImagesBucketName)
    .getPublicUrl(path).data.publicUrl;
};

const getImageBlob = async (image: CommunityImageAttachment) => {
  const imageData = image.dataUrl ?? image.url;

  if (!imageData?.startsWith("data:")) {
    throw new Error("missing-image-data");
  }

  const response = await fetch(imageData);

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
  const errors: string[] = [];

  const uploadResults = await Promise.all(
    images.map(async (image, index) => {
      try {
        if (image.path && image.url && !image.url.startsWith("data:")) {
          return image;
        }

        const blob = await getImageBlob(image);
        const path = [
          postId,
          Date.now(),
          index,
          getWebpFileName(image.name),
        ].join("/");
        const { error } = await client.storage
          .from(communityImagesBucketName)
          .upload(path, blob, {
            contentType: "image/webp",
            upsert: false,
          });

        if (error) {
          console.error("community-image-upload-error", {
            bucket: communityImagesBucketName,
            image,
            path,
            error,
          });
          throw error;
        }

        const { data } = client.storage
          .from(communityImagesBucketName)
          .getPublicUrl(path);

        return {
          id: image.id,
          name: image.name,
          path,
          size: image.size,
          type: "image/webp",
          url: data.publicUrl,
        } satisfies CommunityImageAttachment;
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            (error.message === "missing-image-data" ||
              error.message === "invalid-image-data")
          )
        ) {
          console.error("community-image-upload-error", {
            bucket: communityImagesBucketName,
            image,
            error,
          });
        }
        errors.push(
          error instanceof Error ? error.message : "이미지 업로드 실패"
        );
        return null;
      }
    })
  );
  const uploadedImages = uploadResults.filter(
    (image): image is CommunityImageAttachment => Boolean(image)
  );

  console.log("community-image-upload-result", {
    bucket: communityImagesBucketName,
    failedCount: errors.length,
    images: uploadedImages,
  });

  return {
    errorMessage: errors[0] ?? "",
    failedCount: errors.length,
    images: uploadedImages,
  };
};

export const getPersistableCommunityImages = (
  images: CommunityImageAttachment[]
) =>
  images
    .map((image) => image.path ?? image.url)
    .filter((image): image is string => Boolean(image));
