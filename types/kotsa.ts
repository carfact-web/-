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
  brand: string | null;
  carName: string | null;
  vehicleType: string | null;
  generation: string | null;
  manufacturer: string | null;
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

const asString = (value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const parseJsonString = (value: string) => {
  const trimmed = value.trim();

  if (
    !trimmed ||
    (!trimmed.startsWith("{") && !trimmed.startsWith("["))
  ) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
};

const normalizeKey = (key: string) => key.replace(/[_\-\s]/g, "").toLowerCase();

const findDeepStringByKeys = (
  value: unknown,
  targetKeys: string[],
  depth = 0,
): string | null => {
  if (depth > 12) {
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

  if (typeof value === "string") {
    const parsed = parseJsonString(value);

    return parsed === null
      ? null
      : findDeepStringByKeys(parsed, targetKeys, depth + 1);
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

const findDeepArrayLengthByKeys = (
  value: unknown,
  targetKeys: string[],
  depth = 0,
): number | null => {
  if (depth > 12) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepArrayLengthByKeys(item, targetKeys, depth + 1);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  if (typeof value === "string") {
    const parsed = parseJsonString(value);

    return parsed === null
      ? null
      : findDeepArrayLengthByKeys(parsed, targetKeys, depth + 1);
  }

  if (!isRecord(value)) {
    return null;
  }

  const normalizedTargets = targetKeys.map(normalizeKey);

  for (const [key, item] of Object.entries(value)) {
    if (normalizedTargets.includes(normalizeKey(key)) && Array.isArray(item)) {
      return item.length;
    }
  }

  for (const item of Object.values(value)) {
    const found = findDeepArrayLengthByKeys(item, targetKeys, depth + 1);

    if (found !== null) {
      return found;
    }
  }

  return null;
};

export const getKotsaVehicleDisplayInfo = (
  data: KotsaVehicleHistory | null | undefined,
): KotsaVehicleDisplayInfo | null => {
  if (!data) {
    return null;
  }

  const rawCarName = findDeepStringByKeys(data.raw, [
    "atmbNm",
    "carName",
    "vhclNm",
    "modelNm",
  ]);
  const rawManufacturer = findDeepStringByKeys(data.raw, [
    "manufacturer",
    "brand",
    "maker",
    "makerNm",
    "makrNm",
    "mkrNm",
    "mkngCmpyNm",
    "fbctnBzentyNm",
  ]);
  const rawFirstRegistrationDate = findDeepStringByKeys(data.raw, [
    "frstRegYmd",
    "firstRegistrationDate",
  ]);
  const rawVehicleType = findDeepStringByKeys(data.raw, [
    "carmdlAsortNm",
    "vehicleType",
    "vhclTypeNm",
  ]);
  const rawUsage = findDeepStringByKeys(data.raw, [
    "usgSeNm",
    "usgDtlSeNm",
    "usage",
  ]);
  const rawYear = findDeepStringByKeys(data.raw, [
    "yridnw",
    "mdlYr",
    "yr",
    "year",
    "modelYear",
    "mdy",
    "prdctnYy",
    "vhclYy",
  ]);
  const fuelType = findDeepStringByKeys(data.raw, [
    "useFuelNm",
    "fuel",
    "fuelType",
    "fuelNm",
    "fuelKndNm",
    "ffuelCdNm",
  ]);
  const latestPerformanceMileage = normalizeMileage(
    findDeepStringByKeys(data.raw, [
      "drvngDstnc",
      "prfomncCheckDrvngDstnc",
      "imprmnHstryDrvngDstnc",
      "mileage",
      "odometer",
      "trvlDstnc",
      "drvnDstnc",
      "prfomncChckMlg",
      "acmlMlg",
    ]),
  );
  const firstRegistrationDate =
    data.firstRegistrationDate ?? rawFirstRegistrationDate;
  const vehicleType = data.vehicleType ?? rawVehicleType;
  const maintenanceHistoryCount =
    data.maintenanceHistoryCount ??
    findDeepArrayLengthByKeys(data.raw, ["imprmnList", "maintenanceList"]);
  const performanceCheckCount =
    data.performanceCheckCount ??
    findDeepArrayLengthByKeys(data.raw, ["sttusList1", "sttusList2"]);
  const inspectionHistoryCount =
    data.inspectionRecords.length ||
    findDeepArrayLengthByKeys(data.raw, ["record", "inspList", "inspectionList"]) ||
    (findDeepStringByKeys(data.raw, ["inspVldPdBgngYmd", "inspVldPdEndYmd"]) ? 1 : 0);

  return {
    brand: rawManufacturer,
    carName: data.carName ?? rawCarName,
    firstRegistrationDate,
    fuelType,
    generation: vehicleType,
    inspectionHistoryCount,
    latestPerformanceMileage,
    maintenanceHistoryCount,
    manufacturer: rawManufacturer,
    performanceCheckCount,
    scrapped: data.scrapped,
    usage: data.usage ?? rawUsage,
    vehicleType,
    year:
      onlyDigits(rawYear).slice(0, 4) ||
      getYearFromDate(firstRegistrationDate),
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
