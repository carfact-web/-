import type { Vehicle } from "@/types/vehicle";

type VehicleDisplayInput = Partial<
  Record<keyof Pick<Vehicle, "brand" | "generation" | "model" | "plateNumber" | "year">, string | null>
> & {
  manufacturer?: string | null;
  modelDetail?: string | null;
};

const vehicleClassLabels = new Set([
  "경형",
  "소형",
  "중형",
  "대형",
  "승용",
  "승용차",
  "승합",
  "승합차",
  "화물",
  "화물차",
  "특수",
  "특수차",
]);

const normalizeText = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim();

export const normalizeVehicleBrandName = (
  value: string | null | undefined,
) => {
  const brand = normalizeText(value)
    .replace(/\(주\)/g, "")
    .replace(/주식회사/g, "")
    .replace(/자동차/g, "")
    .replace(/코리아/g, "")
    .trim();
  const compactBrand = brand.replace(/[\s().·-]/g, "").toLowerCase();

  if (!compactBrand) return "";
  if (compactBrand.includes("비엠더블유") || compactBrand.includes("bmw")) {
    return "BMW";
  }
  if (
    compactBrand.includes("메르세데스벤츠") ||
    compactBrand.includes("mercedes") ||
    compactBrand.includes("benz")
  ) {
    return "벤츠";
  }
  if (compactBrand.includes("현대")) return "현대";
  if (compactBrand.includes("기아")) return "기아";
  if (compactBrand.includes("제네시스")) return "제네시스";
  if (compactBrand.includes("쉐보레") || compactBrand.includes("한국지엠")) {
    return "쉐보레";
  }
  if (compactBrand.includes("르노")) return "르노";
  if (compactBrand.includes("쌍용") || compactBrand.includes("kg모빌리티")) {
    return "KG모빌리티";
  }
  if (compactBrand.includes("폭스바겐")) return "폭스바겐";
  if (compactBrand.includes("아우디")) return "아우디";
  if (compactBrand.includes("포르쉐")) return "포르쉐";
  if (compactBrand.includes("렉서스")) return "렉서스";
  if (compactBrand.includes("랜드로버")) return "랜드로버";
  if (compactBrand.includes("미니")) return "미니";
  if (compactBrand.includes("토요타") || compactBrand.includes("도요타")) {
    return "토요타";
  }
  if (compactBrand.includes("혼다")) return "혼다";
  if (compactBrand.includes("닛산")) return "닛산";
  if (compactBrand.includes("포드")) return "포드";
  if (compactBrand.includes("지프")) return "지프";
  if (compactBrand.includes("볼보")) return "볼보";
  if (compactBrand.includes("테슬라")) return "테슬라";

  return brand;
};

export const getVehicleDisplayName = (
  vehicle: VehicleDisplayInput | null | undefined,
) => {
  if (!vehicle) return "";

  const brand = normalizeVehicleBrandName(
    vehicle.brand || vehicle.manufacturer,
  );
  const model = normalizeText(vehicle.model);
  const modelDetail = normalizeText(vehicle.modelDetail || vehicle.generation);
  const fallbackModel = vehicleClassLabels.has(modelDetail) ? "" : modelDetail;
  const modelName = model || fallbackModel;

  if (!modelName) return brand;

  const compactBrand = brand.replace(/\s+/g, "").toLowerCase();
  const compactModel = modelName.replace(/\s+/g, "").toLowerCase();

  if (compactBrand && compactModel.startsWith(compactBrand)) {
    return modelName;
  }

  return [brand, modelName].filter(Boolean).join(" ");
};
