"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import { useAuth } from "@/hooks/useAuth";
import {
  getReviewStorageKey,
  reviewsChangeEventName,
} from "@/hooks/useReviews";
import { getVehicleStorageKey } from "@/hooks/useVehicle";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import {
  fetchCommunityNotices,
  fetchCommunityPosts,
} from "@/lib/communityData";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchHomeTrafficRankings,
  fetchRecentSupabaseReviews,
  type HomeTrafficRankings,
} from "@/lib/supabaseData";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  formatVehiclePlateNumberForDisplay,
  isValidVehiclePlateNumber,
  normalizeVehiclePlateNumber,
} from "@/utils/vehiclePlateValidation";
import { filterValidReviews } from "@/utils/reviewValidation";
import { stripCommunityTextColorMarkup } from "@/utils/communityTextColor";
import type { FormEvent, ReactNode, TouchEvent, UIEvent } from "react";
import type { CommunityPost } from "@/types/community";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn(
  "min-h-screen bg-[#08090b] px-4 py-5 text-white sm:px-6 sm:py-8",
);
const shellClassName = cn("mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8");
const headerClassName = cn(
  "border-b border-zinc-800/80 pb-1.5",
);
const headerTopClassName = cn("flex min-h-11 items-center justify-between gap-3");
const homeLogoClassName = cn(
  "inline-flex h-10 items-center sm:h-11",
);
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5",
);
const plateInputFrameClassName = cn(
  "plate-input-frame",
);
const inputClassName = cn(
  "plate-number-input",
);
const primaryButtonClassName = cn(
  "mt-3 w-full rounded-lg px-4 py-4 text-base font-bold text-white transition",
  "bg-[#FF3B30] hover:bg-[#f52f25] active:scale-[0.99]",
  "disabled:cursor-not-allowed disabled:bg-[#3A3A3A] disabled:hover:bg-[#3A3A3A] disabled:active:scale-100",
);
const formMessageClassName = cn(
  "mt-2 px-1 text-xs font-semibold text-[#FF3B30]",
);
const recentSectionClassName = cn("w-full max-w-3xl min-w-0");
const recentCardClassName = cn(
  "block w-full max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition sm:p-4",
  "hover:border-zinc-700 hover:bg-zinc-900",
);
const recentMetaClassName = cn(
  "mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-zinc-500 sm:mt-2 sm:gap-x-2 sm:gap-y-1 sm:text-xs",
);
const recentCarouselButtonClassName = cn(
  "hidden h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-lg font-black text-zinc-200 transition sm:inline-flex",
  "hover:border-zinc-500 hover:bg-zinc-900 hover:text-white active:scale-95",
);
const recentCarouselDotClassName = cn(
  "h-2.5 w-2.5 rounded-full bg-zinc-700 transition",
);
const guideCarouselButtonClassName = cn(
  "hidden h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-zinc-100 text-lg font-black text-zinc-950 shadow-2xl shadow-black/45 transition sm:inline-flex",
  "hover:border-[#FF3B30]/70 hover:bg-white hover:text-[#FF3B30] active:scale-95",
);
const guideCarouselDotClassName = cn(
  "h-2.5 w-2.5 rounded-full bg-zinc-700 transition",
);
const guideCardClassName = cn(
  "group flex h-full flex-col overflow-hidden rounded-lg border bg-[#0b0c10] shadow-2xl shadow-black/40 transition duration-300",
  "hover:border-[#FF3B30]/70 hover:bg-zinc-950",
);
const guideImageClassName = cn(
  "relative flex min-h-[10.5rem] items-center justify-center overflow-hidden bg-black sm:min-h-[11.5rem]",
);
const recentBadgeStackClassName = cn(
  "flex max-w-[45%] shrink-0 flex-col items-end gap-1 sm:max-w-none sm:gap-1.5",
);
const recentViewBadgeClassName = cn(
  "inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-bold leading-tight text-zinc-200 sm:px-2.5 sm:py-1 sm:text-xs",
);
const recentStatusBadgeClassName = cn(
  "inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full bg-[#FF3B30]/15 px-2 py-0.5 text-[11px] font-bold leading-tight text-[#FF7A73] sm:px-2.5 sm:py-1 sm:text-xs",
);
const topRankingCardClassName = cn(
  "flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 md:p-5",
);
const topRankingItemClassName = cn(
  "grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-1.5 rounded-lg border border-zinc-800 bg-black p-2 md:grid-cols-[2rem_1fr_auto] md:gap-3 md:p-3",
);
const topRankingButtonClassName = cn(
  "shrink-0 whitespace-nowrap rounded-full border border-[#FF4D4F]/70 px-2.5 py-1.5 text-[11px] font-black leading-none text-[#FF4D4F] transition sm:px-3 sm:text-xs",
  "hover:border-[#FF4D4F] hover:bg-[#FF4D4F]/[0.08] hover:text-[#FF6B6D] active:scale-[0.98]",
);
const topRankingCarouselDotClassName = cn(
  "h-2.5 w-2.5 rounded-full bg-zinc-700 transition",
);
const authButtonClassName = cn(
  "inline-flex rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 hover:text-white active:scale-[0.98]",
);
const noticeTickerClassName = cn(
  "mt-1 block min-w-0 truncate text-sm font-bold text-white transition",
  "hover:text-white",
);
const heroCopyFrameClassName = cn("relative h-20 overflow-hidden sm:h-32");
const heroCopyClassName = cn(
  "absolute inset-x-0 top-0 text-[1.65rem] font-black leading-[1.14] text-white sm:text-5xl sm:leading-tight",
);
const heroHighlightClassName = cn("text-[#FF3B30]");

interface RecentFact {
  id: number | string;
  authorIsVerifiedDealer: boolean;
  authorNickname: string;
  carNumber: string;
  vehicle: Vehicle | null;
  content: string;
  createdAt: string;
  viewCount: number;
  recentViewCount: number;
}

const recentReviewsSnapshotEventName = "recent-reviews-snapshot";
const reviewStorageKeyPrefix = getReviewStorageKey("");
const recentReviewsPerSlide = 3;
const recentReviewSlideIntervalMs = 5000;
const recentReviewSwipeThresholdPx = 48;
const communityGuidePreviewCount = 8;
const communityGuideSwipeThresholdPx = 42;
const heroCopyIntervalMs = 3500;
const noticeRollIntervalMs = 3000;
const topVehiclesPreviewCount = 3;
const topModelsPreviewCount = 4;
const topRankingModalLimit = 10;
type HeroCopySegment = {
  text: string;
  highlight?: boolean;
};
const heroCopies: HeroCopySegment[][][] = [
  [
    [{ text: "좋은 차", highlight: true }, { text: "는 이유가 있고," }],
    [{ text: "안 좋은 차", highlight: true }, { text: "도 이유가 있습니다." }],
  ],
  [
    [{ text: "판매글에는 없는 이야기," }],
    [{ text: "후기", highlight: true }, { text: "에서 확인하세요." }],
  ],
  [
    [{ text: "실매물", highlight: true }, { text: "을 본 사람들의" }],
    [{ text: "경험", highlight: true }, { text: "이 쌓이는 곳" }],
  ],
  [
    [{ text: "차량번호", highlight: true }, { text: " 하나로," }],
    [
      { text: "사람들의 " },
      { text: "실제 후기", highlight: true },
      { text: "를 확인하세요." },
    ],
  ],
  [
    [{ text: "광고", highlight: true }, { text: "보다 가까운 건," }],
    [{ text: "실제로 본 사람의 이야기", highlight: true }, { text: "입니다." }],
  ],
];

const parseJson = <T,>(json: string | null): T | null => {
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
};

const subscribeToRecentReviews = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(reviewsChangeEventName, onStoreChange);
  window.addEventListener(recentReviewsSnapshotEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(reviewsChangeEventName, onStoreChange);
    window.removeEventListener(recentReviewsSnapshotEventName, onStoreChange);
  };
};

const getRecentReviewsSnapshot = () => {
  const reviewsByCar: Record<string, string | null> = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (key?.startsWith(reviewStorageKeyPrefix)) {
      reviewsByCar[key] = localStorage.getItem(key);
    }
  }

  return JSON.stringify(reviewsByCar);
};

const getServerRecentReviewsSnapshot = () => "{}";

const getRecentFacts = (snapshot: string): RecentFact[] => {
  const reviewsByCar = parseJson<Record<string, string | null>>(snapshot) ?? {};

  return Object.entries(reviewsByCar)
    .flatMap(([storageKey, reviewsJson]) => {
      const carNumber = storageKey.slice(reviewStorageKeyPrefix.length);
      const reviews = filterValidReviews(
        parseJson<Review[]>(reviewsJson) ?? [],
      );
      const savedVehicle = parseJson<Vehicle>(
        localStorage.getItem(getVehicleStorageKey(carNumber)),
      );

      return reviews.map((review) => ({
        id: review.id,
        authorIsVerifiedDealer: review.authorIsVerifiedDealer ?? false,
        authorNickname: review.authorNickname ?? "익명 사용자",
        carNumber,
        vehicle: review.vehicleSnapshot ?? savedVehicle,
        content: review.content,
        createdAt: review.createdAt,
        viewCount: review.viewCount ?? 0,
        recentViewCount: review.recentViewCount ?? 0,
      }));
    })
    .sort((left, right) => getRecentFactTime(right) - getRecentFactTime(left));
};

const getRecentFactTime = (fact: RecentFact) => {
  const createdTime = Date.parse(fact.createdAt);

  if (!Number.isNaN(createdTime)) {
    return createdTime;
  }

  const idTime = Number(fact.id);

  return Number.isNaN(idTime) ? 0 : idTime;
};

const maskPlateNumber = (plateNumber: string) => {
  const normalizedPlateNumber = sanitizeVehiclePlateNumber(plateNumber);

  if (normalizedPlateNumber.length <= 3) {
    return normalizedPlateNumber || "차량번호 없음";
  }

  return normalizedPlateNumber.slice(0, -3) + "XXX";
};

const formatTopVehicleModel = (
  vehicle: HomeTrafficRankings["topVehicles"][number],
) =>
  vehicle.modelDetail ??
  vehicle.generation ??
  vehicle.model ??
  "차종 정보 없음";

const getTopVehicleHref = (
  vehicle: HomeTrafficRankings["topVehicles"][number],
) => {
  const carNumber = sanitizeVehiclePlateNumber(vehicle.carNumber ?? "");

  return carNumber ? `/car/${encodeURIComponent(carNumber)}` : null;
};

const formatTopModelName = (
  model: HomeTrafficRankings["topModels"][number],
) => {
  const modelName = model.modelName?.trim();
  const manufacturer = model.manufacturer?.trim();

  if (!modelName && !manufacturer) {
    return "모델 정보 없음";
  }

  if (!manufacturer || !modelName) {
    return modelName || manufacturer || "모델 정보 없음";
  }

  if (modelName.toLowerCase().includes(manufacturer.toLowerCase())) {
    return modelName;
  }

  return manufacturer + " " + modelName;
};

const chunkRecentFacts = (facts: RecentFact[]) => {
  const chunks: RecentFact[][] = [];

  for (let index = 0; index < facts.length; index += recentReviewsPerSlide) {
    chunks.push(facts.slice(index, index + recentReviewsPerSlide));
  }

  return chunks;
};

const formatVehicleYearRange = (year: string | undefined) => {
  const normalizedYear = year?.trim();

  if (!normalizedYear) {
    return "연식 정보 없음";
  }

  if (normalizedYear.includes("년")) {
    return normalizedYear.startsWith("(")
      ? normalizedYear
      : `(${normalizedYear})`;
  }

  const yearMatch = normalizedYear.match(/\d{2,4}/);

  if (!yearMatch) {
    return normalizedYear;
  }

  const yearNumber = yearMatch[0].slice(-2);

  return `(${yearNumber}년~)`;
};

const formatReviewDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
};

const getRecentViewBadge = (recentViewCount: number) => {
  if (recentViewCount >= 30) {
    return "🚀 관심집중";
  }

  if (recentViewCount >= 10) {
    return "📈 급상승";
  }

  return null;
};

const getCommunityPostHref = (post: CommunityPost) =>
  `/community?category=${post.category}&post=${encodeURIComponent(post.id)}`;

const getCommunityPostPreviewText = (content: string) => {
  const normalizedContent = stripCommunityTextColorMarkup(content)
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedContent) {
    return "본문에서 자세한 자동차 정보를 확인하세요.";
  }

  return normalizedContent.length > 86
    ? normalizedContent.slice(0, 86).trimEnd() + "..."
    : normalizedContent;
};

type GuideCarouselSlot = "left" | "center" | "right";
const guideCarouselTransition =
  "transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 520ms cubic-bezier(0.22, 1, 0.36, 1)";

const getGuideCarouselSlotStyle = (slot: GuideCarouselSlot) => {
  if (slot === "center") {
    return {
      opacity: 1,
      filter: "none",
      transform: "translateX(-50%) scale(1) rotateY(0deg)",
      transition: guideCarouselTransition,
      zIndex: 30,
      willChange: "transform, opacity, filter",
      backfaceVisibility: "hidden" as const,
      transformStyle: "preserve-3d" as const,
      boxShadow:
        "0 24px 62px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,59,48,0.58)",
    };
  }

  return {
    opacity: 0.38,
    filter: "saturate(0.72) brightness(0.74)",
    transform:
      slot === "left"
        ? "translateX(-115%) scale(0.72) rotateY(8deg)"
        : "translateX(15%) scale(0.72) rotateY(-8deg)",
    transition: guideCarouselTransition,
    zIndex: 10,
    willChange: "transform, opacity, filter",
    backfaceVisibility: "hidden" as const,
    transformStyle: "preserve-3d" as const,
    boxShadow: "0 14px 38px rgba(0,0,0,0.58)",
  };
};

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isAuthReady, signOut } = useAuth();
  const [carNumber, setCarNumber] = useState("");
  const [heroCopyIndex, setHeroCopyIndex] = useState(0);
  const [recentSlideIndex, setRecentSlideIndex] = useState(0);
  const [topRankingSlideIndex, setTopRankingSlideIndex] = useState(0);
  const [guideSlideIndex, setGuideSlideIndex] = useState(0);
  const [recentCarouselHeight, setRecentCarouselHeight] = useState<
    number | null
  >(null);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const recentTouchStartX = useRef<number | null>(null);
  const guideTouchStartX = useRef<number | null>(null);
  const recentSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const topRankingCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [homeNotices, setHomeNotices] = useState<CommunityPost[]>([]);
  const [guidePosts, setGuidePosts] = useState<CommunityPost[]>([]);
  const [trafficRankings, setTrafficRankings] =
    useState<HomeTrafficRankings | null>(null);
  const recentReviewsSnapshot = useSyncExternalStore(
    subscribeToRecentReviews,
    getRecentReviewsSnapshot,
    getServerRecentReviewsSnapshot,
  );
  const [remoteRecentFacts, setRemoteRecentFacts] = useState<
    RecentFact[] | null
  >(null);
  const localRecentFacts = useMemo(
    () => getRecentFacts(recentReviewsSnapshot),
    [recentReviewsSnapshot],
  );
  const recentFacts = useMemo(
    () => (isSupabaseConfigured ? (remoteRecentFacts ?? []) : localRecentFacts),
    [localRecentFacts, remoteRecentFacts],
  );
  const recentFactPages = useMemo(
    () => chunkRecentFacts(recentFacts),
    [recentFacts],
  );
  const recentPageCount = recentFactPages.length;
  const activeRecentSlideIndex =
    recentPageCount > 0
      ? Math.min(recentSlideIndex, recentPageCount - 1)
      : 0;
  const activeTopRankingSlideIndex = Math.min(topRankingSlideIndex, 1);
  const activeGuideSlideIndex =
    guidePosts.length > 0
      ? Math.min(guideSlideIndex, guidePosts.length - 1)
      : 0;
  const heroCopy = heroCopies[heroCopyIndex];
  const activeNotice =
    homeNotices[noticeIndex % Math.max(homeNotices.length, 1)];
  const guideCarouselCards = useMemo(() => {
    const postCount = guidePosts.length;

    if (postCount === 0) {
      return [];
    }

    if (postCount === 1) {
      return [{ index: activeGuideSlideIndex, slot: "center" as const }];
    }

    return [
      {
        index: (activeGuideSlideIndex - 1 + postCount) % postCount,
        slot: "left" as const,
      },
      { index: activeGuideSlideIndex, slot: "center" as const },
      {
        index: (activeGuideSlideIndex + 1) % postCount,
        slot: "right" as const,
      },
    ];
  }, [activeGuideSlideIndex, guidePosts.length]);
  const normalizedCarNumber = normalizeVehiclePlateNumber(carNumber);
  const hasCarNumberInput = normalizedCarNumber.length > 0;
  const isCarNumberValid = isValidVehiclePlateNumber(normalizedCarNumber);
  const showPlateValidationError = hasCarNumberInput && !isCarNumberValid;
  const goToPreviousRecentSlide = () => {
    setRecentSlideIndex((currentIndex) =>
      recentPageCount > 0
        ? (currentIndex - 1 + recentPageCount) % recentPageCount
        : 0,
    );
  };
  const goToNextRecentSlide = () => {
    setRecentSlideIndex((currentIndex) =>
      recentPageCount > 0 ? (currentIndex + 1) % recentPageCount : 0,
    );
  };
  const scrollToTopRankingSlide = (nextIndex: number) => {
    const normalizedIndex = (nextIndex + 2) % 2;

    setTopRankingSlideIndex(normalizedIndex);
    topRankingCardRefs.current[normalizedIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };
  const handleTopRankingScroll = (event: UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const scrollerCenter =
      scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
    const nearestIndex = topRankingCardRefs.current.reduce(
      (nearest, card, index) => {
        if (!card) {
          return nearest;
        }

        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - scrollerCenter);

        return distance < nearest.distance ? { distance, index } : nearest;
      },
      { distance: Number.POSITIVE_INFINITY, index: activeTopRankingSlideIndex },
    ).index;

    if (nearestIndex !== activeTopRankingSlideIndex) {
      setTopRankingSlideIndex(nearestIndex);
    }
  };
  const goToPreviousGuideSlide = () => {
    scrollToGuidePost(activeGuideSlideIndex - 1);
  };
  const goToNextGuideSlide = () => {
    scrollToGuidePost(activeGuideSlideIndex + 1);
  };
  const scrollToGuidePost = (nextIndex: number) => {
    const postCount = guidePosts.length;

    if (postCount === 0) {
      setGuideSlideIndex(0);
      return;
    }

    const normalizedIndex = (nextIndex + postCount) % postCount;
    setGuideSlideIndex(normalizedIndex);
  };
  const handleRecentTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    recentTouchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleRecentTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = recentTouchStartX.current;
    recentTouchStartX.current = null;

    if (startX === null || recentPageCount < 2) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;

    if (Math.abs(deltaX) < recentReviewSwipeThresholdPx) {
      return;
    }

    if (deltaX < 0) {
      goToNextRecentSlide();
    } else {
      goToPreviousRecentSlide();
    }
  };
  const handleGuideTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    guideTouchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleGuideTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = guideTouchStartX.current;
    guideTouchStartX.current = null;

    if (startX === null || guidePosts.length < 2) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;

    if (Math.abs(deltaX) < communityGuideSwipeThresholdPx) {
      return;
    }

    if (deltaX < 0) {
      goToNextGuideSlide();
    } else {
      goToPreviousGuideSlide();
    }
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHeroCopyIndex((currentIndex) => {
        return (currentIndex + 1) % heroCopies.length;
      });
    }, heroCopyIntervalMs);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (recentPageCount < 2) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRecentSlideIndex(
        (currentIndex) => (currentIndex + 1) % recentPageCount,
      );
    }, recentReviewSlideIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [recentPageCount]);

  useEffect(() => {
    recentSlideRefs.current.length = recentFactPages.length;
    const activeSlide = recentSlideRefs.current[activeRecentSlideIndex];

    if (!activeSlide) {
      setRecentCarouselHeight(null);
      return;
    }

    const updateHeight = () => {
      setRecentCarouselHeight(activeSlide.getBoundingClientRect().height);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);

      return () => {
        window.removeEventListener("resize", updateHeight);
      };
    }

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(activeSlide);
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [activeRecentSlideIndex, recentFactPages]);

  useEffect(() => {
    let isActive = true;

    if (!isSupabaseConfigured) {
      return () => {
        isActive = false;
      };
    }

    fetchRecentSupabaseReviews(20)
      .then((reviews) => {
        if (!isActive || reviews === null) {
          return;
        }

        setRemoteRecentFacts(
          reviews.map((review) => ({
            id: review.id,
            authorIsVerifiedDealer: review.authorIsVerifiedDealer ?? false,
            authorNickname: review.authorNickname ?? "익명 사용자",
            carNumber: review.vehicleSnapshot?.plateNumber ?? "",
            vehicle: review.vehicleSnapshot ?? null,
            content: review.content,
            createdAt: review.createdAt,
            viewCount: review.viewCount ?? 0,
            recentViewCount: review.recentViewCount ?? 0,
          })),
        );
      })
      .catch(() => {
        if (isActive) {
          setRemoteRecentFacts([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [recentReviewsSnapshot]);

  useEffect(() => {
    let isActive = true;

    if (!isSupabaseConfigured) {
      return () => {
        isActive = false;
      };
    }

    fetchCommunityNotices(5)
      .then((notices) => {
        if (!isActive) {
          return;
        }

        setHomeNotices(notices);
        setNoticeIndex(0);
      })
      .catch(() => {
        if (isActive) {
          setHomeNotices([]);
          setNoticeIndex(0);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!isSupabaseConfigured) {
      return () => {
        isActive = false;
      };
    }

    fetchCommunityPosts("news")
      .then((posts) => {
        if (!isActive) {
          return;
        }

        setGuidePosts(
          posts
            .filter((post) => post.category === "news" && !post.isNotice)
            .sort(
              (left, right) =>
                Date.parse(right.createdAtRaw) - Date.parse(left.createdAtRaw),
            )
            .slice(0, communityGuidePreviewCount),
        );
        setGuideSlideIndex(0);
      })
      .catch(() => {
        if (isActive) {
          setGuidePosts([]);
          setGuideSlideIndex(0);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (homeNotices.length < 2) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNoticeIndex((currentIndex) => (currentIndex + 1) % homeNotices.length);
    }, noticeRollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [homeNotices.length]);

  useEffect(() => {
    let isActive = true;

    if (!isSupabaseConfigured) {
      return () => {
        isActive = false;
      };
    }

    fetchHomeTrafficRankings()
      .then((rankings) => {
        if (!isActive) {
          return;
        }

        setTrafficRankings(rankings);
      })
      .catch(() => {
        if (isActive) {
          setTrafficRankings({ topVehicles: [], topModels: [] });
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const goToReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = normalizeVehiclePlateNumber(carNumber);

    if (!isValidVehiclePlateNumber(value)) {
      return;
    }

    router.push(`/car/${encodeURIComponent(value)}/setup`);
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className={headerClassName}>
          <div className={headerTopClassName}>
            <Link href="/" aria-label="카팩트 홈" className="shrink-0">
              <BrandLogo className={homeLogoClassName} />
            </Link>
            {isAuthReady && isAuthenticated ? (
              <button
                type="button"
                className={authButtonClassName}
                onClick={() => {
                  void signOut();
                }}
              >
                로그아웃
              </button>
            ) : (
              <Link href="/login" className={authButtonClassName}>
                로그인
              </Link>
            )}
          </div>
          {activeNotice ? (
            <Link
              href={
                "/community?category=notice&post=" +
                encodeURIComponent(activeNotice.id)
              }
              className={noticeTickerClassName}
            >
              📢 {activeNotice.title}
            </Link>
          ) : (
            <p className={noticeTickerClassName}>
              📢 현재 등록된 공지사항이 없습니다
            </p>
          )}
        </header>

        <section className="pt-4 sm:pt-5">
          <div className={heroCopyFrameClassName} aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={heroCopyIndex}
                className={heroCopyClassName}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                {heroCopy.map((line, lineIndex) => (
                  <span key={lineIndex} className="block">
                    {line.map((segment) => (
                      <span
                        key={segment.text}
                        className={
                          segment.highlight ? heroHighlightClassName : undefined
                        }
                      >
                        {segment.text}
                      </span>
                    ))}
                  </span>
                ))}
              </motion.h1>
            </AnimatePresence>
          </div>

          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:mt-5 sm:text-lg">
            수많은 실제 방문 후기와 정보를 모아,
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>더 현명한 중고차 구매를
            돕습니다.
          </p>
        </section>

        <form className={panelClassName} onSubmit={goToReport}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF3B30]">
              차량번호 조회
            </p>
            <p className="text-sm leading-6 text-zinc-400">
              이 차량을 본 사람들의 실제 후기를 확인하세요.
            </p>
          </div>

          <div className={cn("mt-5", plateInputFrameClassName)}>
            <input
              value={formatVehiclePlateNumberForDisplay(carNumber)}
              onChange={(e) => {
                setCarNumber(sanitizeVehiclePlateNumber(e.target.value));
              }}
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="123마 4567"
              className={inputClassName}
              aria-invalid={showPlateValidationError}
              aria-describedby={
                showPlateValidationError ? "plate-validation" : undefined
              }
              aria-label="차량번호"
            />
          </div>

          {showPlateValidationError && (
            <p
              id="plate-validation"
              className={formMessageClassName}
              aria-live="polite"
            >
              잘못된 입력형태입니다.
            </p>
          )}

          <button
            type="submit"
            className={primaryButtonClassName}
            disabled={!isCarNumberValid}
          >
            차량 이야기 보기
          </button>
        </form>

        {trafficRankings &&
        (trafficRankings.topVehicles.length ||
          trafficRankings.topModels.length) ? (
          <section className="mb-2 sm:mb-0">
            <div
              className="snap-x snap-mandatory overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] md:grid md:grid-cols-2 md:items-stretch md:gap-4 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
              onScroll={handleTopRankingScroll}
              data-testid="top-rankings-carousel"
            >
              <div className="flex gap-3 px-[6%] md:contents md:px-0">
                <div
                  ref={(element) => {
                    topRankingCardRefs.current[0] = element;
                  }}
                  className="w-[88%] shrink-0 snap-center md:w-auto md:shrink md:snap-none"
                >
                  <HomeTopVehiclesPanel rankings={trafficRankings} />
                </div>
                <div
                  ref={(element) => {
                    topRankingCardRefs.current[1] = element;
                  }}
                  className="w-[88%] shrink-0 snap-center md:w-auto md:shrink md:snap-none"
                >
                  <HomeTopModelsPanel rankings={trafficRankings} />
                </div>
              </div>
            </div>
            <div
              className="mt-3 flex items-center justify-center gap-2 md:hidden"
              aria-label="실시간 인기 순위 슬라이드 위치"
            >
              {[0, 1].map((index) => (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    topRankingCarouselDotClassName,
                    index === activeTopRankingSlideIndex && "w-6 bg-[#FF3B30]",
                  )}
                  onClick={() => scrollToTopRankingSlide(index)}
                  aria-label={
                    index === 0
                      ? "실시간 인기 차량 보기"
                      : "실시간 인기 모델 보기"
                  }
                  aria-current={index === activeTopRankingSlideIndex}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className={recentSectionClassName}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">
              📌 최근 작성된 후기
            </h2>
            {recentPageCount > 1 ? (
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  className={recentCarouselButtonClassName}
                  onClick={goToPreviousRecentSlide}
                  aria-label="이전 후기"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  className={recentCarouselButtonClassName}
                  onClick={goToNextRecentSlide}
                  aria-label="다음 후기"
                >
                  &gt;
                </button>
              </div>
            ) : null}
          </div>

          {recentFacts.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
              아직 등록된 차량 이야기가 없습니다.
            </div>
          ) : (
            <div className="w-full max-w-full min-w-0 overflow-hidden">
              <div
                className="w-full max-w-full overflow-hidden transition-[height] duration-300 ease-out"
                data-testid="recent-reviews-carousel"
                onTouchStart={handleRecentTouchStart}
                onTouchEnd={handleRecentTouchEnd}
                style={
                  recentCarouselHeight === null
                    ? undefined
                    : { height: recentCarouselHeight }
                }
              >
                <div
                  className="flex w-full min-w-0 items-start transition-transform duration-500 ease-out"
                  style={{
                    transform: `translateX(-${activeRecentSlideIndex * 100}%)`,
                  }}
                >
                  {recentFactPages.map((page, pageIndex) => (
                    <div
                      key={pageIndex}
                      ref={(element) => {
                        recentSlideRefs.current[pageIndex] = element;
                      }}
                      className="w-full min-w-full max-w-full flex-none self-start space-y-2.5 sm:space-y-3"
                      aria-hidden={pageIndex !== activeRecentSlideIndex}
                    >
                      {page.map((fact) => {
                        const vehicleTitle = fact.vehicle
                          ? [
                              fact.vehicle.brand,
                              fact.vehicle.generation || fact.vehicle.model,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : fact.carNumber;
                        const yearRange = formatVehicleYearRange(
                          fact.vehicle?.year,
                        );
                        const mileage = fact.vehicle?.mileage
                          ? `${Number(fact.vehicle.mileage).toLocaleString()}km`
                          : "주행거리 정보 없음";
                        const viewBadge = getRecentViewBadge(
                          fact.recentViewCount,
                        );

                        return (
                          <Link
                            key={`${fact.carNumber}-${fact.id}`}
                            href={`/car/${encodeURIComponent(fact.carNumber)}`}
                            className={recentCardClassName}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                              <div className="min-w-0 flex-1 pr-1 sm:pr-2">
                                <p className="truncate text-sm font-black text-white sm:text-base">
                                  {maskPlateNumber(fact.carNumber)}
                                </p>
                                <p className="truncate text-sm font-bold text-zinc-100 sm:text-base">
                                  {vehicleTitle || "차종 정보 없음"}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-zinc-400 sm:mt-1 sm:text-sm">
                                  {yearRange}
                                </p>
                              </div>
                              <div className={recentBadgeStackClassName}>
                                <p className={recentViewBadgeClassName}>
                                  👀 {fact.viewCount.toLocaleString()}
                                </p>
                                {viewBadge ? (
                                  <p className={recentStatusBadgeClassName}>
                                    {viewBadge}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <p className="mt-1.5 overflow-hidden whitespace-pre-line break-words text-xs leading-[1.55] text-zinc-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-2 sm:text-sm sm:leading-[1.7] sm:[-webkit-line-clamp:3]">
                              {fact.content}
                            </p>

                            <div className={recentMetaClassName}>
                              <VerifiedNickname
                                isVerifiedDealer={fact.authorIsVerifiedDealer}
                              >
                                {fact.authorNickname}
                              </VerifiedNickname>
                              <span aria-hidden>·</span>
                              <span>{mileage}</span>
                              {fact.createdAt && <span aria-hidden>·</span>}
                              {fact.createdAt && (
                                <span>{formatReviewDate(fact.createdAt)}</span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {recentPageCount > 1 ? (
                <div
                  className="mt-4 flex items-center justify-center gap-2"
                  aria-label="최근 후기 슬라이드 위치"
                >
                  {recentFactPages.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={cn(
                        recentCarouselDotClassName,
                        index === activeRecentSlideIndex && "w-6 bg-[#FF3B30]",
                      )}
                      onClick={() => setRecentSlideIndex(index)}
                      aria-label={`${index + 1}번째 후기 묶음 보기`}
                      aria-current={index === activeRecentSlideIndex}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="w-full max-w-3xl min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">
              📚 자동차 정보 &amp; 구매 가이드
            </h2>
          </div>

          {guidePosts.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center text-sm font-semibold text-zinc-500">
              등록된 자동차 정보 글이 없습니다.
            </div>
          ) : (
            <div
              className="relative left-1/2 w-screen max-w-[44rem] -translate-x-1/2 overflow-visible py-3 sm:w-[calc(100vw-2rem)] sm:py-4"
              onTouchStart={handleGuideTouchStart}
              onTouchEnd={handleGuideTouchEnd}
              data-testid="auto-guides-carousel"
            >
              {guidePosts.length > 1 ? (
                <>
                  <button
                    type="button"
                    className={cn(
                      guideCarouselButtonClassName,
                      "absolute left-[calc(50%_-_15rem)] top-[43%] z-40 -translate-y-1/2",
                    )}
                    onClick={goToPreviousGuideSlide}
                    aria-label="이전 자동차 정보"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    className={cn(
                      guideCarouselButtonClassName,
                      "absolute right-[calc(50%_-_15rem)] top-[43%] z-40 -translate-y-1/2",
                    )}
                    onClick={goToNextGuideSlide}
                    aria-label="다음 자동차 정보"
                  >
                    &gt;
                  </button>
                </>
              ) : null}

              <div className="relative h-[23rem] overflow-visible touch-pan-y [perspective:1100px] sm:h-[25rem]">
                {guideCarouselCards.map(({ index, slot }) => {
                  const post = guidePosts[index];
                  const representativeImage = post.images[0];
                  const representativeImageUrl =
                    representativeImage?.url ?? representativeImage?.dataUrl;
                  const isActiveGuide = slot === "center";
                  const isDuplicatePreview =
                    guidePosts.length === 1 && !isActiveGuide;

                  return (
                    <div
                      key={guidePosts.length > 2 ? post.id : `${slot}-${post.id}`}
                      className="absolute left-1/2 top-4 h-[21rem] w-[68vw] max-w-[16rem] origin-center sm:h-[23rem] sm:w-[17rem] sm:max-w-none"
                      style={getGuideCarouselSlotStyle(slot)}
                    >
                      <Link
                        href={getCommunityPostHref(post)}
                        className={cn(
                          guideCardClassName,
                          !isActiveGuide && "cursor-pointer",
                          isDuplicatePreview && "pointer-events-none",
                          isActiveGuide
                            ? "border-[#FF3B30]/80"
                            : "border-zinc-800",
                        )}
                        onClick={(event) => {
                          if (!isActiveGuide) {
                            event.preventDefault();
                            scrollToGuidePost(index);
                          }
                        }}
                        aria-label={post.title}
                        aria-hidden={isDuplicatePreview}
                        tabIndex={isDuplicatePreview ? -1 : undefined}
                      >
                        <div className={guideImageClassName}>
                          {representativeImageUrl ? (
                            <Image
                              src={representativeImageUrl}
                              alt={representativeImage.name}
                              fill
                              unoptimized
                              sizes="(min-width: 640px) 272px, 68vw"
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,59,48,0.35),transparent_32%),linear-gradient(135deg,#171717_0%,#050505_58%,#2a0808_100%)] transition duration-500 group-hover:scale-105" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        </div>

                        <div className="relative flex flex-1 flex-col p-3 sm:p-4">
                          <span className="mb-2 inline-flex w-fit rounded-full border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-2 py-0.5 text-[10px] font-black text-[#FF8A82]">
                            {getCommunityCategoryLabel(post.category)}
                          </span>
                          <h3 className="overflow-hidden text-sm font-black leading-snug text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-base">
                            {post.title}
                          </h3>
                          <p className="mt-2 min-h-10 overflow-hidden text-xs leading-5 text-zinc-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                            {getCommunityPostPreviewText(post.content)}
                          </p>
                          <p className="mt-auto pt-3 text-[11px] font-bold text-zinc-500">
                            {post.createdAt}
                          </p>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {guidePosts.length > 1 ? (
            <div
              className="mt-4 flex items-center justify-center gap-2"
              aria-label="자동차 정보 슬라이드 위치"
            >
              {guidePosts.map((post, index) => (
                <button
                  key={post.id}
                  type="button"
                  className={cn(
                    guideCarouselDotClassName,
                    index === activeGuideSlideIndex && "w-6 bg-[#FF3B30]",
                  )}
                  onClick={() => scrollToGuidePost(index)}
                  aria-label={`${index + 1}번째 자동차 정보 보기`}
                  aria-current={index === activeGuideSlideIndex}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function HomeTopVehiclesPanel({ rankings }: { rankings: HomeTrafficRankings }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const previewVehicles = rankings.topVehicles.slice(0, topVehiclesPreviewCount);
  const topVehicles = rankings.topVehicles.slice(0, topRankingModalLimit);

  return (
    <div className={topRankingCardClassName}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black leading-tight text-white sm:text-base md:text-lg">
          <span>🔥 실시간 인기 차량</span>
        </h2>
        {topVehicles.length ? (
          <button
            type="button"
            className={topRankingButtonClassName}
            onClick={() => setIsModalOpen(true)}
          >
            🏆 TOP10 전체보기
          </button>
        ) : null}
      </div>
      {rankings.topVehicles.length ? (
        <ol className="mt-2 space-y-1.5 md:mt-4 md:space-y-2">
          {previewVehicles.map((vehicle, index) => {
            const href = getTopVehicleHref(vehicle);
            const content = (
              <>
                <span className="pt-0.5 text-xs font-black text-red-400 md:text-sm">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-white md:text-sm">
                    {maskPlateNumber(vehicle.carNumber ?? "")}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-zinc-100 md:text-sm">
                    {[vehicle.manufacturer, vehicle.model]
                      .filter(Boolean)
                      .join(" ") || "차량 정보 없음"}
                  </span>
                </span>
                <span className="col-start-2 mt-0.5 text-[10px] font-black text-zinc-100 md:col-start-auto md:mt-0 md:pt-0.5 md:text-right md:text-sm">
                  조회 {vehicle.viewCount.toLocaleString()}
                </span>
              </>
            );

            return (
              <li key={vehicle.vehicleId || index}>
                {href ? (
                  <Link
                    href={href}
                    className={cn(
                      topRankingItemClassName,
                      "cursor-pointer transition hover:border-[#FF4D4F]/60 hover:bg-zinc-950 active:scale-[0.99]",
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className={topRankingItemClassName}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">인기 차량 기록이 없습니다.</p>
      )}
      {isModalOpen ? (
        <TopRankingModal
          title="인기 차량 TOP10"
          onClose={() => setIsModalOpen(false)}
        >
          <ol className="space-y-2">
            {topVehicles.map((vehicle, index) => {
              const href = getTopVehicleHref(vehicle);
              const content = (
                <>
                  <span className="pt-0.5 text-sm font-black text-red-400">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-white">
                      {maskPlateNumber(vehicle.carNumber ?? "")}
                    </span>
                    <span className="mt-1 block truncate text-sm font-bold text-zinc-100">
                      {[vehicle.manufacturer, vehicle.model]
                        .filter(Boolean)
                        .join(" ") || "차종 정보 없음"}
                    </span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">
                      {formatTopVehicleModel(vehicle)}
                    </span>
                  </span>
                  <span className="pt-0.5 text-right text-sm font-black text-zinc-100">
                    조회 {vehicle.viewCount.toLocaleString()}
                  </span>
                </>
              );

              return (
                <li key={vehicle.vehicleId || index}>
                  {href ? (
                    <Link
                      href={href}
                      className="grid cursor-pointer grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-3 rounded-lg border border-zinc-800 bg-black p-3 transition hover:border-[#FF4D4F]/60 hover:bg-zinc-950 active:scale-[0.99]"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-3 rounded-lg border border-zinc-800 bg-black p-3">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </TopRankingModal>
      ) : null}
    </div>
  );
}

function HomeTopModelsPanel({ rankings }: { rankings: HomeTrafficRankings }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const previewModels = rankings.topModels.slice(0, topModelsPreviewCount);
  const topModels = rankings.topModels.slice(0, topRankingModalLimit);

  return (
    <div className={topRankingCardClassName}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black leading-tight text-white sm:text-base md:text-lg">
          <span>🔥 실시간 인기 모델</span>
        </h2>
        {topModels.length ? (
          <button
            type="button"
            className={topRankingButtonClassName}
            onClick={() => setIsModalOpen(true)}
          >
            🏆 TOP10 전체보기
          </button>
        ) : null}
      </div>
      {rankings.topModels.length ? (
        <ol className="mt-2 space-y-1.5 md:mt-4 md:space-y-2">
          {previewModels.map((model, index) => (
            <li
              key={(model.manufacturer ?? "") + (model.modelName ?? "") + index}
              className={topRankingItemClassName}
            >
              <span className="text-xs font-black text-red-400 md:text-sm">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-white md:text-sm">
                  {formatTopModelName(model)}
                </span>
              </span>
              <span className="col-start-2 mt-0.5 text-[10px] font-black text-zinc-100 md:col-start-auto md:mt-0 md:text-right md:text-sm">
                조회 {model.viewCount.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">인기 모델 기록이 없습니다.</p>
      )}
      {isModalOpen ? (
        <TopRankingModal
          title="인기 모델 TOP10"
          onClose={() => setIsModalOpen(false)}
        >
          <ol className="space-y-2">
            {topModels.map((model, index) => (
              <li
                key={(model.manufacturer ?? "") + (model.modelName ?? "") + index}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-3 rounded-lg border border-zinc-800 bg-black p-3"
              >
                <span className="text-sm font-black text-red-400">
                  {index + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-bold text-white">
                  {formatTopModelName(model)}
                </span>
                <span className="text-right text-sm font-black text-zinc-100">
                  조회 {model.viewCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </TopRankingModal>
      ) : null}
    </div>
  );
}

function TopRankingModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button
            type="button"
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-black text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div className="max-h-[calc(80vh-3.5rem)] overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
