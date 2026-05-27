"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReviews } from "@/hooks/useReviews";
import { useVehicle } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import type { Review } from "@/types/review";

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
const submitButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600"
);

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const carNumber = decodeURIComponent(params.carNumber as string);
  const [review, setReview] = useState("");
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

  const saveReview = () => {
    if (!review.trim()) {
      alert("후기를 입력해주세요.");
      return;
    }

    const newReview: Review = {
      id: Date.now(),
      authorNickname: "익명 사용자",
      content: review,
      tags: selectedTags,
      createdAt: new Date().toLocaleString(),
      vehicleSnapshot: vehicle ?? undefined,
    };

    addReview(newReview);

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
          onChange={(e) => setReview(e.target.value)}
          placeholder="예: 사진보다 외판 상태가 별로였고, 엔진 소음이 있었습니다."
          className={textareaClassName}
        />

        <button onClick={saveReview} className={submitButtonClassName}>
          후기 등록하기
        </button>
      </div>
    </main>
  );
}
