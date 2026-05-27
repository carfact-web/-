"use client";

import Image from "next/image";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReviews } from "@/hooks/useReviews";
import { useVehicle } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import { validateReviewContent } from "@/utils/reviewValidation";
import type { Review } from "@/types/review";
import type { ReviewImageAttachment } from "@/types/review";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const panelClassName = cn("max-w-2xl rounded-2xl bg-zinc-900 p-6");
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
const imagePreviewGridClassName = cn(
  "mt-3 grid grid-cols-3 gap-2 sm:max-w-sm"
);
const imagePreviewItemClassName = cn(
  "relative aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800"
);
const removeImageButtonClassName = cn(
  "absolute right-1 top-1 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white transition",
  "hover:bg-red-500 active:scale-[0.96]"
);
const validationMessageClassName = cn(
  "mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
);
const submitButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600"
);
const maxReviewImages = 3;
const maxImageSizeBytes = 3 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const isAllowedImageType = (
  type: string
): type is ReviewImageAttachment["type"] =>
  allowedImageTypes.includes(type as ReviewImageAttachment["type"]);

const readImageFile = (file: File): Promise<ReviewImageAttachment> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string" || !isAllowedImageType(file.type)) {
        reject(new Error("invalid-image"));
        return;
      }

      resolve({
        id: [file.name, file.size, file.lastModified].join("-"),
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
        size: file.size,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string)
  );
  const [review, setReview] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [reviewImages, setReviewImages] = useState<ReviewImageAttachment[]>([]);
  const { addReview } = useReviews(carNumber);
  const { vehicle } = useVehicle(carNumber);
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

    if (nextFiles.some((file) => file.size > maxImageSizeBytes)) {
      setValidationMessage("이미지는 1장당 3MB 이하만 첨부할 수 있어요.");
      return;
    }

    try {
      const nextImages = await Promise.all(nextFiles.map(readImageFile));

      setReviewImages((currentImages) =>
        [...currentImages, ...nextImages].slice(0, maxReviewImages)
      );
    } catch {
      setValidationMessage("이미지를 불러오지 못했어요. 다시 선택해주세요.");
    }
  };

  const removeReviewImage = (imageId: string) => {
    setReviewImages((currentImages) =>
      currentImages.filter((image) => image.id !== imageId)
    );
    setValidationMessage("");
  };

  const saveReview = () => {
    const validation = validateReviewContent(review);

    if (!validation.isValid) {
      setValidationMessage(validation.message ?? "후기를 다시 확인해주세요.");
      return;
    }

    setValidationMessage("");

    const newReview: Review = {
      id: Date.now(),
      authorNickname: "익명 사용자",
      content: validation.content,
      tags: selectedTags,
      images: reviewImages,
      hasImages: reviewImages.length > 0,
      createdAt: new Date().toLocaleString(),
      vehicleSnapshot: vehicle ?? undefined,
    };

    let saveResult;

    try {
      saveResult = addReview(newReview);
    } catch {
      setValidationMessage(
        "이미지 저장 공간이 부족해요. 이미지를 줄인 뒤 다시 시도해주세요."
      );
      return;
    }

    if (!saveResult.isValid) {
      setValidationMessage(saveResult.message ?? "후기를 다시 확인해주세요.");
      return;
    }

    alert("후기가 등록되었습니다.");
    window.location.href = `/car/${encodeURIComponent(carNumber)}`;
  };

  return (
    <main className={pageClassName}>
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
                jpg, png, webp / 최대 3장 / 1장당 3MB 이하
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
                    src={image.dataUrl}
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
          className={submitButtonClassName}
        >
          후기 등록하기
        </button>
      </div>
    </main>
  );
}
