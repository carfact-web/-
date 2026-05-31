"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useRecentViews } from "@/hooks/useRecentViews";
import { useReviews } from "@/hooks/useReviews";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useVehicle } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import { validateReviewContent } from "@/utils/reviewValidation";
import { compressImage } from "@/utils/imageCompression";
import type { Review } from "@/types/review";
import type { ReviewImageAttachment } from "@/types/review";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn("w-full rounded-2xl bg-zinc-900 p-6");
const homeButtonClassName = cn(
  "mb-8 inline-flex items-center rounded-lg bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-gray-200 transition",
  "hover:opacity-75"
);
const tagButtonClassName = cn("rounded-full px-4 py-2 text-sm transition");
const textareaClassName = cn(
  "h-40 w-full rounded-xl bg-zinc-800 p-4 text-white"
);
const imagePickerClassName = cn(
  "mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4"
);
const imagePickerButtonClassName = cn(
  "inline-flex cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-gray-200 transition",
  "hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.98]"
);
const successToastClassName = cn(
  "mb-6 inline-flex items-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition"
);
const imagePreviewGridClassName = cn("mt-4 grid grid-cols-3 gap-3");
const imagePreviewItemClassName = cn(
  "relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
);
const removeImageButtonClassName = cn(
  "absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white transition",
  "hover:bg-black"
);
const validationMessageClassName = cn(
  "mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
);
const submitButtonClassName = cn(
  "mt-6 w-full rounded-xl bg-red-600 px-4 py-4 text-base font-bold text-white transition",
  "hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
);
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const maxReviewImages = 3;

const isAllowedImageType = (
  type: string
): type is ReviewImageAttachment["type"] =>
  allowedImageTypes.includes(type as ReviewImageAttachment["type"]);

const readImageFile = async (
  file: File
): Promise<ReviewImageAttachment | null> => {
  // 이미지 압축
  const compressionResult = await compressImage(file);

  // 실패 케이스 체크
  if ("type" in compressionResult && compressionResult.type) {
    throw new Error(compressionResult.message);
  }

  // 성공 케이스 확인
  if (!("blob" in compressionResult)) {
    throw new Error("이미지 압축에 실패했습니다");
  }

  const { blob } = compressionResult as {
    success: true;
    blob: Blob;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };

  // Blob → DataURL 변환
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("invalid-image"));
        return;
      }

      resolve({
        id: [file.name, blob.size, Date.now()].join("-"),
        name: file.name,
        type: (blob.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp",
        dataUrl: reader.result,
        size: blob.size,
      });
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string)
  );
  const reviewInputRef = useRef<HTMLTextAreaElement>(null);
  const [review, setReview] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [reviewImages, setReviewImages] = useState<ReviewImageAttachment[]>([]);
  const {
    isAuthenticated,
    isAuthReady,
    user,
  } = useAuth();
  const { isProfileReady, reviewNickname } = useUserProfile(user);
  const { addReview } = useReviews(carNumber);
  const { vehicle } = useVehicle(carNumber);
  const { saveRecentView } = useRecentViews();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const vehicleTitle = vehicle
    ? [vehicle.brand, vehicle.model, vehicle.generation]
        .filter(Boolean)
        .join(" ")
    : "";
  const vehicleDetails = vehicle
    ? [
        vehicle.year && `${vehicle.year}년식`,
        vehicle.mileage &&
          `${Number(vehicle.mileage).toLocaleString()}km`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const tags = [
    "외판 상태 다름",
    "엔진 소음",
    "누유 의심",
    "허위매물 의심",
    "실매물 확인",
    "하체 부식",
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const recentTitle = vehicleTitle || carNumber;
    saveRecentView(carNumber, recentTitle, vehicle ?? undefined);
  }, [carNumber, isAuthenticated, saveRecentView, vehicle, vehicleTitle]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addReviewImages = async (files: FileList | null) => {
    if (!files) {
      return;
    }

    const remainingSlots = maxReviewImages - reviewImages.length;

    if (remainingSlots <= 0) {
      setValidationMessage("이미지는 최대 3장까지 첨부할 수 있어요.");
      return;
    }

    const nextFiles = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      setValidationMessage("이미지는 최대 3장까지 첨부할 수 있어요.");
    } else {
      setValidationMessage("");
    }

    if (nextFiles.some((file) => !isAllowedImageType(file.type))) {
      setValidationMessage("jpg, png, webp 이미지만 첨부할 수 있어요.");
      return;
    }

    try {
      const nextImages = await Promise.all(
        nextFiles.map(async (file) => {
          try {
            return await readImageFile(file);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "이미지 압축 실패";
            throw new Error(message);
          }
        })
      );

      const successImages = nextImages.filter((img) => img !== null) as ReviewImageAttachment[];
      setReviewImages((currentImages) =>
        [...currentImages, ...successImages].slice(0, maxReviewImages)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "이미지를 불러오지 못했어요.";
      setValidationMessage(`이미지 처리 오류: ${message} 다시 선택해주세요.`);
    }
  };

  const removeReviewImage = (imageId: string) => {
    setReviewImages((currentImages) =>
      currentImages.filter((image) => image.id !== imageId)
    );
    setValidationMessage("");
  };

  const saveReview = async () => {
    if (!isAuthenticated) {
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (!isProfileReady || !reviewNickname) {
      setValidationMessage("후기 작성자명을 준비하고 있습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const reviewContent = reviewInputRef.current?.value ?? review;
    const validation = validateReviewContent(reviewContent);

    if (!validation.isValid) {
      setValidationMessage(validation.message ?? "후기를 다시 확인해주세요.");
      return;
    }

    setValidationMessage("");
    setIsSubmitting(true);

    const newReview: Review = {
      id: Date.now(),
      authorNickname: reviewNickname,
      content: validation.content,
      tags: selectedTags,
      images: reviewImages,
      hasImages: reviewImages.length > 0,
      createdAt: new Date().toLocaleString(),
      vehicleSnapshot: vehicle ?? undefined,
    };

    let saveResult;

    try {
      saveResult = await addReview(newReview);
    } catch {
      setIsSubmitting(false);
      setValidationMessage(
        "이미지 저장 공간이 부족해요. 이미지를 줄인 뒤 다시 시도해주세요."
      );
      return;
    }

    if (!saveResult.isValid) {
      setIsSubmitting(false);
      setValidationMessage(saveResult.message ?? "후기를 다시 확인해주세요.");
      return;
    }

    setShowSuccessToast(true);

    window.setTimeout(() => {
      setShowSuccessToast(false);
    }, 2000);

    window.setTimeout(() => {
      router.push("/car/" + encodeURIComponent(carNumber));
    }, 850);
  };

  useEffect(() => {
    if (!isAuthReady || isAuthenticated) {
      return;
    }

    router.replace(
      `/login?redirectTo=${encodeURIComponent(window.location.href)}`
    );
  }, [isAuthReady, isAuthenticated, router]);

  if (!isAuthReady) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <button
            type="button"
            onClick={() => router.push("/")}
            className={homeButtonClassName}
          >
            ← 홈으로
          </button>

          <h1 className="text-5xl font-bold mb-6">후기 남기기</h1>

          <div className={panelClassName}>
            <p className="text-sm text-zinc-400">로그인 상태를 확인하고 있습니다.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <div className={panelClassName}>
            <p className="text-sm text-zinc-400">로그인 페이지로 이동 중입니다.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <button
          type="button"
          onClick={() => router.push("/")}
          className={homeButtonClassName}
        >
          ← 홈으로
        </button>

        <h1 className="text-5xl font-bold mb-6">후기 남기기</h1>

        <p className="text-2xl text-gray-300 mb-10">
          차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
        </p>

        <div
          aria-live="polite"
          className={cn(
            successToastClassName,
            showSuccessToast
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0"
          )}
        >
          <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]" />
          <span>차량 이야기가 등록되었어요.</span>
        </div>

        <div className={panelClassName}>
        <div className="rounded-xl bg-zinc-800 p-4 mb-6">
          <p className="text-gray-300">
            차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
          </p>
          {vehicleTitle && <p className="text-white mt-2">{vehicleTitle}</p>}
          {vehicleDetails && (
            <p className="text-sm text-gray-500 mt-1">{vehicleDetails}</p>
          )}
        </div>

        <label className="block text-gray-300 mb-3">
          이 차량을 보고 느낀 점
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                tagButtonClassName,
                selectedTags.includes(tag)
                  ? "bg-red-500 text-white"
                  : "bg-zinc-700 text-gray-300"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
        <textarea
          ref={reviewInputRef}
          value={review}
          onChange={(e) => {
            setReview(e.target.value);
            setValidationMessage("");
          }}
          placeholder="예: 사진보다 외판 상태가 별로였고, 엔진 소음이 있었습니다."
          className={textareaClassName}
          aria-invalid={Boolean(validationMessage)}
          aria-describedby={validationMessage ? "review-validation" : undefined}
          maxLength={500}
        />
        <div className={imagePickerClassName}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-200">사진 첨부</p>
              <p className="mt-1 text-xs text-gray-500">
                jpg, png, webp / 최대 3장 / 자동 압축
              </p>
            </div>
            <label className={imagePickerButtonClassName}>
              이미지 선택
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void addReviewImages(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {reviewImages.length > 0 && (
            <div className={imagePreviewGridClassName}>
              {reviewImages.map((image) => (
                <div key={image.id} className={imagePreviewItemClassName}>
                  <Image
                    src={image.dataUrl ?? image.url ?? ""}
                    alt={image.name}
                    fill
                    unoptimized
                    sizes="120px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeReviewImage(image.id)}
                    className={removeImageButtonClassName}
                    aria-label={image.name + " 이미지 제거"}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {validationMessage && (
          <p
            id="review-validation"
            className={validationMessageClassName}
            aria-live="polite"
          >
            {validationMessage}
          </p>
        )}

        <button
          type="button"
          onClick={saveReview}
          disabled={isSubmitting || !isProfileReady || !reviewNickname}
          className={submitButtonClassName}
        >
          {isSubmitting ? "등록 중..." : "후기 등록하기"}
        </button>
        </div>
      </div>
    </main>
  );
}
