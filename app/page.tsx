"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { VerifiedNickname } from "@/components/VerifiedNickname";
import { useAuth } from "@/hooks/useAuth";
import {
  getReviewStorageKey,
  reviewsChangeEventName,
} from "@/hooks/useReviews";
import { getVehicleStorageKey } from "@/hooks/useVehicle";
import { brand } from "@/lib/brand";
import { fetchCommunityNotices } from "@/lib/communityData";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchHomeTrafficRankings,
  fetchRecentSupabaseReviews,
  type HomeTrafficRankings,
} from "@/lib/supabaseData";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import { filterValidReviews } from "@/utils/reviewValidation";
import type { FormEvent } from "react";
import type { CommunityPost } from "@/types/community";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn(
  "min-h-screen bg-[#08090b] px-4 py-5 text-white sm:px-6 sm:py-8",
);
const shellClassName = cn("mx-auto flex w-full max-w-3xl flex-col gap-8");
const headerClassName = cn(
  "border-b border-zinc-800/80 pb-3",
);
const headerTopClassName = cn("flex items-center justify-between gap-3");
const homeLogoClassName = cn("h-10 w-auto object-contain sm:h-12");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5",
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-base text-white outline-none transition",
  "placeholder:text-zinc-500 focus:border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/20",
);
const primaryButtonClassName = cn(
  "mt-3 w-full rounded-lg bg-[#FF3B30] px-4 py-4 text-base font-bold text-white transition",
  "hover:bg-[#f52f25] active:scale-[0.99]",
);
const formMessageClassName = cn(
  "mt-3 rounded-lg border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-3 py-2 text-sm text-red-200",
);
const recentSectionClassName = cn("max-w-3xl");
const recentListClassName = cn("space-y-3");
const recentCardClassName = cn(
  "block rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition",
  "hover:border-zinc-700 hover:bg-zinc-900",
);
const recentMetaClassName = cn(
  "mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500",
);
const recentToggleButtonClassName = cn(
  "mt-4 inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-zinc-300 transition",
  "hover:bg-zinc-900 hover:text-white active:scale-[0.98]",
);
const topRankingCardClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5",
);
const topRankingItemClassName = cn(
  "grid grid-cols-[2rem_1fr_auto] items-start gap-3 rounded-lg border border-zinc-800 bg-black p-3",
);
const authButtonClassName = cn(
  "inline-flex rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition",
  "hover:border-zinc-500 hover:bg-zinc-900 hover:text-white active:scale-[0.98]",
);
const noticeTickerClassName = cn(
  "mt-2 block min-w-0 truncate text-sm font-bold text-white transition",
  "hover:text-white",
);
const heroCopyFrameClassName = cn("relative h-24 overflow-hidden sm:h-32");
const heroCopyClassName = cn(
  "absolute inset-x-0 top-0 text-3xl font-black leading-tight text-white sm:text-5xl",
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
}

const recentReviewsSnapshotEventName = "recent-reviews-snapshot";
const reviewStorageKeyPrefix = getReviewStorageKey("");
const recentPreviewCount = 3;
const heroCopyIntervalMs = 3500;
const noticeRollIntervalMs = 3000;
const heroCopies = [
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

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isAuthReady, signOut } = useAuth();
  const [carNumber, setCarNumber] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [showAllRecentFacts, setShowAllRecentFacts] = useState(false);
  const [heroCopyIndex, setHeroCopyIndex] = useState(0);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [homeNotices, setHomeNotices] = useState<CommunityPost[]>([]);
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
  const localRecentFacts = getRecentFacts(recentReviewsSnapshot);
  const recentFacts = isSupabaseConfigured
    ? (remoteRecentFacts ?? [])
    : localRecentFacts;
  const displayedRecentFacts = showAllRecentFacts
    ? recentFacts
    : recentFacts.slice(0, recentPreviewCount);
  const hasHiddenRecentFacts = recentFacts.length > recentPreviewCount;
  const heroCopy = heroCopies[heroCopyIndex];
  const activeNotice =
    homeNotices[noticeIndex % Math.max(homeNotices.length, 1)];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHeroCopyIndex((currentIndex) => {
        return (currentIndex + 1) % heroCopies.length;
      });
    }, heroCopyIntervalMs);

    return () => window.clearInterval(intervalId);
  }, []);

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

    const value = sanitizeVehiclePlateNumber(carNumber);

    if (!value) {
      setFormMessage("차량번호를 입력해주세요.");
      return;
    }

    setFormMessage("");
    router.push(`/car/${encodeURIComponent(value)}/setup`);
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className={headerClassName}>
          <div className={headerTopClassName}>
            <Link href="/" aria-label="카팩트 홈">
              <Image
                src="/brand/carfact-home-logo.png"
                alt="카팩트"
                width={48}
                height={51}
                priority
                className={homeLogoClassName}
              />
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

        <section className="pt-5">
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

          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
            {brand.description}
          </p>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-[#111111] p-4 shadow-2xl shadow-black/30 sm:p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF3B30]">
            차량 조회
          </p>
          <p className="text-sm leading-6 text-zinc-400">
            차량번호로 실제 방문 후기와 커뮤니티 정보를 확인하세요.
          </p>
        </section>

        <form className={panelClassName} onSubmit={goToReport}>
          <input
            value={carNumber}
            onChange={(e) => {
              setCarNumber(sanitizeVehiclePlateNumber(e.target.value));
              setFormMessage("");
            }}
            type="text"
            placeholder="차량번호 입력 예) 123가4567"
            className={inputClassName}
            aria-invalid={Boolean(formMessage)}
            aria-describedby={formMessage ? "plate-validation" : undefined}
          />

          {formMessage && (
            <p
              id="plate-validation"
              className={formMessageClassName}
              aria-live="polite"
            >
              {formMessage}
            </p>
          )}

          <button type="submit" className={primaryButtonClassName}>
            차량 이야기 보기
          </button>
        </form>

        {trafficRankings &&
        (trafficRankings.topVehicles.length ||
          trafficRankings.topModels.length) ? (
          <section className="grid gap-4 md:grid-cols-2">
            <HomeTopVehiclesPanel rankings={trafficRankings} />
            <HomeTopModelsPanel rankings={trafficRankings} />
          </section>
        ) : null}

        <section className={recentSectionClassName}>
          <div className="mb-3">
            <h2 className="text-xl font-black text-white">
              📌 최근 작성된 후기
            </h2>
          </div>

          {recentFacts.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
              아직 등록된 차량 이야기가 없습니다.
            </div>
          ) : (
            <div className={recentListClassName}>
              {displayedRecentFacts.map((fact) => {
                const vehicleTitle = fact.vehicle
                  ? [fact.vehicle.brand, fact.vehicle.model]
                      .filter(Boolean)
                      .join(" ")
                  : fact.carNumber;
                const generation = fact.vehicle?.generation || "세대 정보 없음";
                const mileage = fact.vehicle?.mileage
                  ? `${Number(fact.vehicle.mileage).toLocaleString()}km`
                  : "주행거리 정보 없음";

                return (
                  <Link
                    key={`${fact.carNumber}-${fact.id}`}
                    href={`/car/${encodeURIComponent(fact.carNumber)}`}
                    className={recentCardClassName}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">
                          {maskPlateNumber(fact.carNumber)}
                        </p>
                        <p className="truncate text-base font-bold text-zinc-100">
                          {vehicleTitle}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {generation}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300">
                        이야기
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-[1.7] text-zinc-300">
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
                      {fact.createdAt && <span>{fact.createdAt}</span>}
                    </div>
                  </Link>
                );
              })}
              {hasHiddenRecentFacts && (
                <button
                  type="button"
                  onClick={() => setShowAllRecentFacts((value) => !value)}
                  className={recentToggleButtonClassName}
                >
                  {showAllRecentFacts
                    ? "최근 3개만 보기"
                    : "전체 이야기 보기 →"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function HomeTopVehiclesPanel({ rankings }: { rankings: HomeTrafficRankings }) {
  return (
    <div className={topRankingCardClassName}>
      <h2 className="text-lg font-black text-white">🔥 실시간 인기 차량</h2>
      {rankings.topVehicles.length ? (
        <ol className="mt-4 space-y-2">
          {rankings.topVehicles.map((vehicle, index) => (
            <li
              key={vehicle.vehicleId || index}
              className={topRankingItemClassName}
            >
              <span className="pt-0.5 text-sm font-black text-red-400">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">
                  {maskPlateNumber(vehicle.carNumber ?? "")}
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-zinc-100">
                  {[vehicle.manufacturer, vehicle.model]
                    .filter(Boolean)
                    .join(" ") || "차량 정보 없음"}
                </span>
                <span className="mt-1 block truncate text-xs text-zinc-500">
                  {formatTopVehicleModel(vehicle)}
                </span>
              </span>
              <span className="pt-0.5 text-right text-sm font-black text-zinc-100">
                조회 {vehicle.viewCount.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">인기 차량 기록이 없습니다.</p>
      )}
    </div>
  );
}

function HomeTopModelsPanel({ rankings }: { rankings: HomeTrafficRankings }) {
  return (
    <div className={topRankingCardClassName}>
      <h2 className="text-lg font-black text-white">🔥 실시간 인기 모델</h2>
      {rankings.topModels.length ? (
        <ol className="mt-4 space-y-2">
          {rankings.topModels.map((model, index) => (
            <li
              key={(model.manufacturer ?? "") + (model.modelName ?? "") + index}
              className={topRankingItemClassName}
            >
              <span className="text-sm font-black text-red-400">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {formatTopModelName(model)}
                </span>
              </span>
              <span className="text-right text-sm font-black text-zinc-100">
                조회 {model.viewCount.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">인기 모델 기록이 없습니다.</p>
      )}
    </div>
  );
}
