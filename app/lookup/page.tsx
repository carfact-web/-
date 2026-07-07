"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KotsaLoginRequiredModal } from "@/components/KotsaLoginRequiredModal";
import { KotsaLookupProgress } from "@/components/KotsaLookupProgress";
import { KotsaLookupResultModal } from "@/components/KotsaLookupResultModal";
import { useAuth } from "@/hooks/useAuth";
import { useKotsaVehicleHistory } from "@/hooks/useKotsaVehicleHistory";
import { useVehicle } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";
import {
  formatVehiclePlateNumberForDisplay,
  isValidVehiclePlateNumber,
  normalizeVehiclePlateNumber,
} from "@/utils/vehiclePlateValidation";
import type { FormEvent } from "react";

const pageClassName = cn("min-h-screen bg-black px-4 py-8 text-white sm:px-6");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
);
const inputClassName = cn(
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4 text-base text-white outline-none transition",
  "placeholder:text-zinc-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
);
const primaryButtonClassName = cn(
  "mt-3 w-full rounded-lg px-4 py-4 text-base font-bold text-white transition",
  "bg-[#FF3B30] hover:bg-[#f52f25] active:scale-[0.99]",
  "disabled:cursor-not-allowed disabled:bg-[#3A3A3A] disabled:hover:bg-[#3A3A3A] disabled:active:scale-100",
);
const formMessageClassName = cn(
  "mt-2 px-1 text-xs font-semibold text-[#FF3B30]"
);
const delay = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

type LookupModalType = "not_business" | "error";

export default function LookupPage() {
  return (
    <Suspense fallback={null}>
      <LookupPageContent />
    </Suspense>
  );
}

function LookupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCarNumber = searchParams.get("carNumber") ?? "";
  const normalizedQueryCarNumber = normalizeVehiclePlateNumber(
    sanitizeVehiclePlateNumber(queryCarNumber),
  );
  const autoLookupVehicleRef = useRef<string | null>(null);
  const [carNumber, setCarNumber] = useState(normalizedQueryCarNumber);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isKotsaMaintenance, setIsKotsaMaintenance] = useState(false);
  const [lookupModalType, setLookupModalType] =
    useState<LookupModalType | null>(null);
  const [progressStep, setProgressStep] = useState(-1);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "현재 점검 중입니다. 잠시 후 다시 시도해주세요.",
  );
  const normalizedCarNumber = normalizeVehiclePlateNumber(carNumber);
  const { isAuthReady, isAuthenticated, session } = useAuth();
  const { isLoading: isKotsaLookupLoading, lookup } = useKotsaVehicleHistory();
  const { saveVehicle } = useVehicle(normalizedCarNumber);
  const hasCarNumberInput = normalizedCarNumber.length > 0;
  const isCarNumberValid = isValidVehiclePlateNumber(normalizedCarNumber);
  const showPlateValidationError = hasCarNumberInput && !isCarNumberValid;
  const isLookupBusy = isKotsaLookupLoading || progressStep >= 0;
  const loginRedirectTo = normalizedCarNumber
    ? `/lookup?carNumber=${encodeURIComponent(normalizedCarNumber)}`
    : "/lookup";

  const runKotsaLookup = useCallback(async (value: string) => {
    if (isKotsaMaintenance || isLookupBusy) {
      return;
    }

    if (!isValidVehiclePlateNumber(value)) {
      return;
    }

    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated || !session?.access_token) {
      setIsLoginModalOpen(true);
      return;
    }

    setLookupModalType(null);
    setProgressStep(0);

    try {
      await delay(180);
      setProgressStep(1);
      const result = await lookup({
        accessToken: session.access_token,
        vehicleNumber: value,
      });

      if (result.status === 401 || result.code === "LOGIN_REQUIRED") {
        setIsLoginModalOpen(true);
        return;
      }

      if (!result.ok) {
        setLookupModalType("error");
        return;
      }

      if (!result.businessVehicle || !result.display) {
        setLookupModalType("not_business");
        return;
      }

      setProgressStep(2);
      await delay(180);
      setProgressStep(3);
      await delay(180);
      setProgressStep(4);

      const display = result.display;
      const now = new Date().toISOString();
      const carName = display.carName || "KOTSA 확인 차량";
      const vehicleType = display.vehicleType || "상품용 차량";

      await saveVehicle({
        brand: carName,
        createdAt: now,
        fuelType: display.fuelType ?? "",
        generation: vehicleType,
        mileage: display.latestPerformanceMileage ?? "",
        model: carName,
        plateNumber: value,
        updatedAt: now,
        year: display.year ?? "확인필요",
      });

      await delay(220);
      router.push(`/car/${encodeURIComponent(value)}`);
    } catch {
      setLookupModalType("error");
    } finally {
      setProgressStep(-1);
    }
  }, [
    isAuthReady,
    isAuthenticated,
    isKotsaMaintenance,
    isLookupBusy,
    lookup,
    router,
    saveVehicle,
    session,
  ]);

  const goToReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runKotsaLookup(normalizeVehiclePlateNumber(carNumber));
  };

  useEffect(() => {
    let isMounted = true;

    fetch("/api/kotsa/status")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (payload: {
          emergencyStop?: boolean;
          maintenanceMode?: { enabled: boolean; message: string };
          message?: string | null;
        } | null) => {
        if (isMounted) {
          setIsKotsaMaintenance(
            Boolean(payload?.emergencyStop || payload?.maintenanceMode?.enabled),
          );
          setMaintenanceMessage(
            payload?.message ||
              payload?.maintenanceMode?.message ||
              "현재 점검 중입니다. 잠시 후 다시 시도해주세요.",
          );
        }
        },
      )
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!normalizedQueryCarNumber) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCarNumber(normalizedQueryCarNumber);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [normalizedQueryCarNumber]);

  useEffect(() => {
    if (!normalizedQueryCarNumber) {
      return;
    }

    if (autoLookupVehicleRef.current === normalizedQueryCarNumber) {
      return;
    }

    if (normalizedCarNumber !== normalizedQueryCarNumber) {
      return;
    }

    if (!isAuthReady || isKotsaMaintenance || isLookupBusy) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      autoLookupVehicleRef.current = normalizedQueryCarNumber;
      void runKotsaLookup(normalizedQueryCarNumber);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    isAuthReady,
    isKotsaMaintenance,
    isLookupBusy,
    normalizedCarNumber,
    normalizedQueryCarNumber,
    runKotsaLookup,
  ]);

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white">차량조회</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            차량번호로 실제 매물 후기와 이야기를 확인하세요.
          </p>
        </div>

        <form className={panelClassName} onSubmit={goToReport}>
          <input
            value={formatVehiclePlateNumberForDisplay(carNumber)}
            onChange={(event) => {
              setCarNumber(sanitizeVehiclePlateNumber(event.target.value));
            }}
            type="text"
            placeholder="예) 123가4567"
            className={inputClassName}
            aria-invalid={showPlateValidationError}
            aria-describedby={
              showPlateValidationError ? "lookup-validation" : undefined
            }
          />

          {showPlateValidationError && (
            <p
              id="lookup-validation"
              className={formMessageClassName}
              aria-live="polite"
            >
              잘못된 입력형태입니다.
            </p>
          )}

          {isKotsaMaintenance ? (
            <p className={formMessageClassName} aria-live="polite">
              {maintenanceMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className={primaryButtonClassName}
            disabled={
              !isCarNumberValid ||
              isKotsaMaintenance ||
              isLookupBusy ||
              !isAuthReady
            }
          >
            {isLookupBusy ? "조회 중..." : "차량 이야기 보기"}
          </button>

          <KotsaLookupProgress
            activeStep={progressStep}
            isVisible={progressStep >= 0}
          />
        </form>
      </div>
      <KotsaLoginRequiredModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        redirectTo={loginRedirectTo}
      />
      <KotsaLookupResultModal
        isOpen={lookupModalType !== null}
        onClose={() => setLookupModalType(null)}
        type={lookupModalType ?? "error"}
      />
    </main>
  );
}
