export interface KotsaInspectionRecord {
  inspectionDate: string | null;
  inspectionSequence: string | null;
  inspectionType: string | null;
}

export interface KotsaVehicleHistory {
  carName: string | null;
  firstRegistrationDate: string | null;
  inspectionRecords: KotsaInspectionRecord[];
  insuranceActive: boolean | null;
  insuranceYn: string | null;
  mortgageCount: number | null;
  overdueTaxCount: number | null;
  performanceCheckCount: number | null;
  responseCode: string | null;
  responseMessage: string | null;
  scrapped: boolean | null;
  scrappedYn: string | null;
  seizureCount: number | null;
  transferDate: string | null;
  usage: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  maintenanceHistoryCount: number | null;
  raw: unknown;
}

export interface KotsaVehicleDisplayInfo {
  carName: string | null;
  vehicleType: string | null;
  usage: string | null;
  firstRegistrationDate: string | null;
  year: string | null;
  fuelType: string | null;
  latestPerformanceMileage: string | null;
  maintenanceHistoryCount: number | null;
  performanceCheckCount: number | null;
  inspectionHistoryCount: number;
  scrapped: boolean | null;
}

const businessUsagePattern =
  /(상품|사업|영업|운수|운송|대여|렌터|렌트|택시|화물|특수|법인)/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const normalizeKey = (key: string) => key.replace(/[_\-\s]/g, "").toLowerCase();

const findDeepStringByKeys = (
  value: unknown,
  targetKeys: string[],
  depth = 0,
): string | null => {
  if (depth > 5) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepStringByKeys(item, targetKeys, depth + 1);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const normalizedTargets = targetKeys.map(normalizeKey);

  for (const [key, item] of Object.entries(value)) {
    if (normalizedTargets.includes(normalizeKey(key))) {
      const stringValue = asString(item);

      if (stringValue) {
        return stringValue;
      }
    }
  }

  for (const item of Object.values(value)) {
    const found = findDeepStringByKeys(item, targetKeys, depth + 1);

    if (found) {
      return found;
    }
  }

  return null;
};

const onlyDigits = (value: string | null) => value?.replace(/\D/g, "") ?? "";

const getYearFromDate = (date: string | null) => {
  const digits = onlyDigits(date);

  return digits.length >= 4 ? digits.slice(0, 4) : null;
};

const normalizeMileage = (value: string | null) => {
  if (!value) {
    return null;
  }

  const digits = onlyDigits(value);

  if (!digits) {
    return value;
  }

  return String(Number(digits));
};

export const getKotsaVehicleDisplayInfo = (
  data: KotsaVehicleHistory | null | undefined,
): KotsaVehicleDisplayInfo | null => {
  if (!data) {
    return null;
  }

  const rawYear = findDeepStringByKeys(data.raw, [
    "yr",
    "year",
    "modelYear",
    "mdy",
    "prdctnYy",
    "vhclYy",
  ]);
  const fuelType = findDeepStringByKeys(data.raw, [
    "fuel",
    "fuelType",
    "fuelNm",
    "fuelKndNm",
    "useFuelNm",
    "ffuelCdNm",
  ]);
  const latestPerformanceMileage = normalizeMileage(
    findDeepStringByKeys(data.raw, [
      "mileage",
      "odometer",
      "trvlDstnc",
      "drvnDstnc",
      "drvngDstnc",
      "prfomncChckMlg",
      "acmlMlg",
    ]),
  );

  return {
    carName: data.carName,
    firstRegistrationDate: data.firstRegistrationDate,
    fuelType,
    inspectionHistoryCount: data.inspectionRecords.length,
    latestPerformanceMileage,
    maintenanceHistoryCount: data.maintenanceHistoryCount,
    performanceCheckCount: data.performanceCheckCount,
    scrapped: data.scrapped,
    usage: data.usage,
    vehicleType: data.vehicleType,
    year: onlyDigits(rawYear).slice(0, 4) || getYearFromDate(data.firstRegistrationDate),
  };
};

export const isKotsaBusinessVehicle = (
  data: KotsaVehicleHistory | null | undefined,
) => {
  if (!data) {
    return false;
  }

  const usage = data.usage ?? "";

  if (businessUsagePattern.test(usage)) {
    return true;
  }

  return Boolean(
    data.carName ||
      data.vehicleType ||
      data.performanceCheckCount ||
      data.maintenanceHistoryCount ||
      data.inspectionRecords.length,
  );
};
