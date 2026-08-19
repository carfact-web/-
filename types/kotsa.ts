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

export interface KotsaMaintenanceHistoryItem {
  businessName: string | null;
  componentName: string | null;
  date: string | null;
  id: string;
  jobType: string | null;
  mileage: string | null;
}

export interface KotsaPerformanceHistoryItem {
  accidentStatus: string | null;
  inspectionBusinessName: string | null;
  inspectionDate: string | null;
  informationBusinessName: string | null;
  id: string;
  mileage: string | null;
  repairStatus: string | null;
  statusCategory: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface KotsaInspectionHistoryItem {
  date: string | null;
  id: string;
  sequence: string | null;
  type: string | null;
}

export interface KotsaDetailedHistory {
  inspection: KotsaInspectionHistoryItem[];
  maintenance: KotsaMaintenanceHistoryItem[];
  performance: KotsaPerformanceHistoryItem[];
}

export type KotsaPublicVehicleHistory = Omit<
  KotsaVehicleHistory,
  "raw" | "vehicleNumber"
> & {
  businessStatus: string | null;
  detailedHistory: KotsaDetailedHistory;
};

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
  detailedHistory: KotsaDetailedHistory;
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

const getFirstRawRow = (value: unknown) => {
  const root = isRecord(value) ? value : {};
  const data = Array.isArray(root.data) ? root.data : [];

  return isRecord(data[0]) ? data[0] : {};
};

const getRawArray = (data: KotsaVehicleHistory, key: string) => {
  const first = getFirstRawRow(data.raw);
  const value = first[key];

  return Array.isArray(value) ? value : [];
};

const hasAnyValue = (record: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => Boolean(asString(record[key])));

const hiddenHistoryValues = new Set([
  "x",
  "undefined",
  "null",
  "신품",
  "신품(a)",
  "신품 (a)",
  "미제공",
  "정보없음",
  "정보 없음",
  "해당사항없음",
  "해당사항없음(x)",
  "해당사항없음 (x)",
  "해당 사항 없음",
  "해당 사항 없음(x)",
  "해당 사항 없음 (x)",
]);

const asVisibleHistoryString = (value: unknown) => {
  const stringValue = asString(value);

  if (!stringValue) {
    return null;
  }

  return hiddenHistoryValues.has(stringValue.replace(/\s+/g, " ").toLowerCase())
    ? null
    : stringValue;
};

const getDateSortValue = (value: string | null) => {
  const digits = onlyDigits(value);

  return digits ? Number(digits.padEnd(8, "0")) : 0;
};

const normalizeMaintenanceHistory = (
  data: KotsaVehicleHistory,
): KotsaMaintenanceHistoryItem[] => {
  const groups = new Map<
    string,
    {
      businessName: string | null;
      componentNames: string[];
      date: string | null;
      firstIndex: number;
      jobTypes: string[];
      mileage: string | null;
    }
  >();

  getRawArray(data, "imprmnList").forEach((item, index) => {
    const record = isRecord(item) ? item : {};

    if (
      !hasAnyValue(record, [
        "imprmnCmptnYmd",
        "imprmnHstryDrvngDstnc",
        "cmpntSeNm",
        "jobCnCdNm",
      ])
    ) {
      return;
    }

    const date = asString(record.imprmnCmptnYmd);
    const mileage = normalizeMileage(asString(record.imprmnHstryDrvngDstnc));
    const componentName = asVisibleHistoryString(record.cmpntSeNm);
    const jobType = asVisibleHistoryString(record.jobCnCdNm);
    const businessName = asVisibleHistoryString(record.bzentNm);
    const groupKey = [date, mileage, businessName].join("|");
    const group = groups.get(groupKey);

    if (group) {
      if (componentName && !group.componentNames.includes(componentName)) {
        group.componentNames.push(componentName);
      }
      if (jobType && !group.jobTypes.includes(jobType)) {
        group.jobTypes.push(jobType);
      }
      return;
    }

    groups.set(groupKey, {
      businessName,
      componentNames: componentName ? [componentName] : [],
      date,
      firstIndex: index,
      jobTypes: jobType ? [jobType] : [],
      mileage,
    });
  });

  return [...groups.values()]
    .sort(
      (left, right) =>
        getDateSortValue(right.date) - getDateSortValue(left.date) ||
        left.firstIndex - right.firstIndex,
    )
    .map((item, index) => ({
      businessName: item.businessName,
      componentName: item.componentNames.join(" · ") || null,
      date: asDateLabel(item.date),
      id: `maintenance-${index + 1}`,
      jobType: item.jobTypes.join(" · ") || null,
      mileage: item.mileage,
    }));
};

const normalizePerformanceHistory = (
  data: KotsaVehicleHistory,
): KotsaPerformanceHistoryItem[] =>
  getRawArray(data, "sttusList1")
    .map((item, index) => {
      const record = isRecord(item) ? item : {};

      if (
        !hasAnyValue(record, [
          "chckYmd",
          "prfomncChckDrvngDstnc",
          "acdntYn",
          "rcptSn",
        ])
      ) {
        return null;
      }

      return {
        accidentStatus: asString(record.acdntYn),
        inspectionBusinessName: asString(record.chckBzentyNm),
        inspectionDate: asDateLabel(asString(record.chckYmd)),
        informationBusinessName: asString(record.infrmBzentyNm),
        id: `performance-${index + 1}`,
        mileage: normalizeMileage(asString(record.prfomncChckDrvngDstnc)),
        repairStatus: asString(record.rvsnCdNm),
        statusCategory: asString(record.crcSeNm),
        validFrom: asDateLabel(asString(record.prfomncChckInspVldPdBgngYmd)),
        validTo: asDateLabel(asString(record.prfomncChckInspVldPdEndYmd)),
      };
    })
    .filter((item): item is KotsaPerformanceHistoryItem => Boolean(item))
    .sort(
      (left, right) =>
        getDateSortValue(right.inspectionDate) -
        getDateSortValue(left.inspectionDate),
    );

const normalizeInspectionHistory = (
  data: KotsaVehicleHistory,
): KotsaInspectionHistoryItem[] =>
  getRawArray(data, "record")
    .map((item, index) => {
      const record = isRecord(item) ? item : {};

      if (!hasAnyValue(record, ["inspYmd", "inspSeNm", "inspSn"])) {
        return null;
      }

      return {
        date: asDateLabel(asString(record.inspYmd)),
        id: `inspection-${index + 1}`,
        sequence: asString(record.inspSn),
        type: asString(record.inspSeNm),
      };
    })
    .filter((item): item is KotsaInspectionHistoryItem => Boolean(item))
    .sort(
      (left, right) =>
        getDateSortValue(right.date) - getDateSortValue(left.date),
    );

const asDateLabel = (value: string | null) => {
  const digits = onlyDigits(value);

  if (digits.length !== 8) {
    return value;
  }

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
};

export const getKotsaDetailedHistory = (
  data: KotsaVehicleHistory | null | undefined,
): KotsaDetailedHistory => ({
  inspection: data ? normalizeInspectionHistory(data) : [],
  maintenance: data ? normalizeMaintenanceHistory(data) : [],
  performance: data ? normalizePerformanceHistory(data) : [],
});

const getBusinessStatus = (data: KotsaVehicleHistory) =>
  asString(getFirstRawRow(data.raw).prcsImprtyRsnDtls);

export const toPublicKotsaVehicleHistory = (
  data: KotsaVehicleHistory,
): KotsaPublicVehicleHistory => {
  const detailedHistory = getKotsaDetailedHistory(data);

  return {
    businessStatus: getBusinessStatus(data),
    carName: data.carName,
    detailedHistory,
    firstRegistrationDate: data.firstRegistrationDate,
    inspectionRecords: data.inspectionRecords,
    insuranceActive: data.insuranceActive,
    insuranceYn: data.insuranceYn,
    maintenanceHistoryCount: detailedHistory.maintenance.length,
    mortgageCount: data.mortgageCount,
    overdueTaxCount: data.overdueTaxCount,
    performanceCheckCount: detailedHistory.performance.length,
    responseCode: data.responseCode,
    responseMessage: data.responseMessage,
    scrapped: data.scrapped,
    scrappedYn: data.scrappedYn,
    seizureCount: data.seizureCount,
    transferDate: data.transferDate,
    usage: data.usage,
    vehicleType: data.vehicleType,
  };
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
  const detailedHistory = getKotsaDetailedHistory(data);
  const maintenanceHistoryCount = detailedHistory.maintenance.length;
  const performanceCheckCount = detailedHistory.performance.length;
  const inspectionHistoryCount = detailedHistory.inspection.length;

  return {
    brand: rawManufacturer,
    carName: data.carName ?? rawCarName,
    firstRegistrationDate,
    fuelType,
    generation: vehicleType,
    detailedHistory,
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
