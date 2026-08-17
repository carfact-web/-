"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CarViewEventToast } from "@/components/CarViewEventToast";
import { VehicleMasterFields } from "@/components/VehicleMasterFields";
import { useAuth } from "@/hooks/useAuth";
import { useRecentViews } from "@/hooks/useRecentViews";
import { useVehicle } from "@/hooks/useVehicle";
import { cn } from "@/utils/cn";
import {
  sanitizeMileage,
  sanitizeVehiclePlateNumber,
} from "@/utils/inputSanitizer";
import type { Vehicle } from "@/types/vehicle";

const pageClassName = cn("min-h-screen bg-black p-6 text-white sm:p-10");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn("w-full rounded-2xl bg-zinc-900 p-6");
const homeButtonClassName = cn(
  "mb-8 inline-flex items-center rounded-lg bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-gray-200 transition",
  "hover:opacity-75"
);
const primaryButtonClassName = cn(
  "mt-4 w-full rounded-xl bg-red-500 p-4 font-bold transition",
  "hover:bg-red-600"
);
const validationMessageClassName = cn(
  "mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
);
const historyToastClassName = cn(
  "mb-4 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 shadow-lg shadow-black/25"
);

const fuelTypes = ["가솔린", "디젤", "LPG", "하이브리드", "전기", "수소"];

export default function VehicleSetupPage() {
  const params = useParams();
  const router = useRouter();
  const carNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(params.carNumber as string)
  );
  const {
    vehicle,
    isLoadedFromExistingRegistration,
  } = useVehicle(carNumber);
  const { isAuthReady, isProfileReady, session } = useAuth();
  const { saveRecentView } = useRecentViews();

  const [canRegister, setCanRegister] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [generation, setGeneration] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [mileage, setMileage] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const brandValue = brand ?? vehicle?.brand ?? "";
  const modelValue = model ?? vehicle?.model ?? "";
  const generationValue = generation ?? vehicle?.generation ?? "";
  const yearValue = year ?? vehicle?.year ?? "";
  const mileageValue = mileage ?? vehicle?.mileage ?? "";
  const fuelTypeValue = fuelType ?? vehicle?.fuelType ?? "";

  useEffect(() => {
    let isActive = true;

    if (!isAuthReady || !isProfileReady) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setCanRegister(false);
          setIsCheckingPermission(true);
        }
      });
      return () => {
        isActive = false;
      };
    }

    const accessToken = session?.access_token;

    if (!accessToken) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setCanRegister(false);
          setIsCheckingPermission(false);
        }
      });
      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (isActive) {
        setCanRegister(false);
        setIsCheckingPermission(true);
      }
    });

    fetch("/api/dealer/vehicle-registration", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { canRegister?: boolean; isVerifiedDealer?: boolean; ok?: boolean }
          | null;

        if (!isActive) return;

        setCanRegister(
          Boolean(response.ok && payload?.ok && payload.canRegister === true),
        );
      })
      .catch(() => {
        if (isActive) {
          setCanRegister(false);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingPermission(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isAuthReady, isProfileReady, session?.access_token]);

  useEffect(() => {
    const recentTitle = [brandValue, modelValue, generationValue]
      .filter(Boolean)
      .join(" ") || carNumber;
    saveRecentView(carNumber, recentTitle, vehicle ?? undefined);
  }, [carNumber, brandValue, generationValue, modelValue, saveRecentView, vehicle]);

  const saveAndGoToReport = async () => {
    if (!brandValue || !modelValue || !generationValue || !yearValue) {
      setValidationMessage("제조사, 모델, 세부모델, 연식을 선택해주세요.");
      return;
    }

    setValidationMessage("");
    const nextVehicle: Vehicle = {
      plateNumber: carNumber,
      brand: brandValue,
      model: modelValue,
      generation: generationValue,
      year: yearValue,
      mileage: sanitizeMileage(mileageValue),
      fuelType: fuelTypeValue,
    };

    const accessToken = session?.access_token;

    if (!canRegister || !accessToken) {
      setValidationMessage("인증 딜러만 차량정보를 직접 등록할 수 있습니다.");
      return;
    }

    const response = await fetch("/api/dealer/vehicle-registration", {
      body: JSON.stringify(nextVehicle),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; ok?: boolean }
      | null;

    if (!response.ok || !payload?.ok) {
      setValidationMessage(
        payload?.error ?? "차량정보 저장 권한을 확인하지 못했습니다.",
      );
      return;
    }

    window.location.href = `/car/${encodeURIComponent(carNumber)}`;
  };

  if (isCheckingPermission) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className={homeButtonClassName}
          >
            ← 홈으로
          </button>
          <section className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center sm:p-10">
            <p className="text-xs font-black tracking-[0.16em] text-red-400">
              CARFACT DEALER CHECK
            </p>
            <h1 className="mt-3 text-2xl font-black">등록 권한 확인 중</h1>
            <p className="mt-3 text-sm font-semibold text-zinc-400">
              인증 딜러 여부를 서버에서 확인하고 있습니다.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!canRegister) {
    return (
      <main className={pageClassName}>
        <div className={shellClassName}>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className={homeButtonClassName}
          >
            ← 홈으로
          </button>
          <section className="rounded-2xl border border-red-500/20 bg-zinc-950 p-6 text-center shadow-2xl shadow-red-950/20 sm:p-10">
            <p className="text-xs font-black tracking-[0.16em] text-red-400">
              CARFACT DEALER ONLY
            </p>
            <h1 className="mt-3 text-[22px] font-black leading-tight sm:text-3xl">
              <span className="block">차량정보 직접 등록</span>
              <span className="block">권한이 없습니다</span>
            </h1>
            <p className="mt-4 text-[15px] font-semibold leading-6 text-zinc-300">
              인증 완료된 딜러만 차량정보를 직접 등록할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-8 w-full rounded-xl bg-red-500 px-6 py-4 text-sm font-black text-white transition hover:bg-red-600 active:scale-[0.98]"
            >
              처음 화면으로 이동
            </button>
          </section>
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

        <h1 className="text-5xl font-bold mb-6">차량 정보 등록</h1>

        <CarViewEventToast
          carNumber={carNumber}
          className="sticky top-4 z-[9999]"
        />

        {isLoadedFromExistingRegistration && (
          <p className={historyToastClassName} aria-live="polite">
            기존 등록 이력을 바탕으로 차량 정보를 불러왔습니다.
          </p>
        )}

        <p className="text-2xl text-gray-300 mb-10">
          차량번호: <span className="text-red-400 font-bold">{carNumber}</span>
        </p>

        <div className={panelClassName}>
        <p className="text-gray-300 mb-6">
          카팩트에 처음 등록되는 차량입니다. 차량 정보를 알려주세요!
        </p>

        <VehicleMasterFields
          brandValue={brandValue}
          modelValue={modelValue}
          modelDetailValue={generationValue}
          yearValue={yearValue}
          fuelTypeValue={fuelTypeValue}
          mileageValue={mileageValue}
          fuelTypes={fuelTypes}
          onBrandChange={setBrand}
          onModelChange={setModel}
          onModelDetailChange={setGeneration}
          onYearChange={setYear}
          onFuelTypeChange={setFuelType}
          onMileageChange={(value) => setMileage(sanitizeMileage(value))}
          onClearValidation={() => setValidationMessage("")}
        />

        {validationMessage && (
          <p className={validationMessageClassName} aria-live="polite">
            {validationMessage}
          </p>
        )}

        <button
          type="button"
          onClick={saveAndGoToReport}
          className={primaryButtonClassName}
        >
          차량 정보 저장 후 리포트 보기
        </button>
        </div>
      </div>
    </main>
  );
}
