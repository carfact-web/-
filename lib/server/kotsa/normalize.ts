import type { KotsaVehicleHistory } from "@/types/kotsa";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null;

const asNumber = (value: unknown) => {
  const stringValue = asString(value);

  if (stringValue === null) {
    return null;
  }

  const numberValue = Number(stringValue);

  return Number.isFinite(numberValue) ? numberValue : null;
};

const asYnBoolean = (value: unknown) => {
  const stringValue = asString(value)?.toUpperCase();

  if (stringValue === "Y") {
    return true;
  }

  if (stringValue === "N") {
    return false;
  }

  return null;
};

const asDate = (value: unknown) => {
  const stringValue = asString(value);

  if (!stringValue) {
    return null;
  }

  const digits = stringValue.replace(/\D/g, "");

  if (digits.length !== 8) {
    return stringValue;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

export const normalizeKotsaVehicleHistory = (payload: unknown): KotsaVehicleHistory => {
  const root = asRecord(payload);
  const data = Array.isArray(root.data) ? root.data : [];
  const first = asRecord(data[0]);
  const carBscInfo = Array.isArray(first.carBscInfo)
    ? asRecord(first.carBscInfo[0])
    : asRecord(first.carBscInfo);
  const records = Array.isArray(first.record) ? first.record : [];
  const insuranceYn = asString(first.insrncYn);
  const scrappedYn = asString(first.scrcarYn);
  const maintenanceList = Array.isArray(first.imprmnList) ? first.imprmnList : [];
  const performanceList = Array.isArray(first.sttusList1)
    ? first.sttusList1
    : Array.isArray(first.sttusList2)
      ? first.sttusList2
      : [];

  return {
    carName: asString(first.atmbNm) ?? asString(carBscInfo.atmbNm),
    firstRegistrationDate:
      asDate(first.frstRegYmd) ?? asDate(carBscInfo.frstRegYmd),
    inspectionRecords: records.map((record) => {
      const inspection = asRecord(record);

      return {
        inspectionDate: asDate(inspection.inspYmd),
        inspectionSequence: asString(inspection.inspSn),
        inspectionType: asString(inspection.inspSeNm),
      };
    }),
    insuranceActive: asYnBoolean(insuranceYn),
    insuranceYn,
    maintenanceHistoryCount:
      asNumber(first.imprmnHstryCnt) ?? maintenanceList.length,
    mortgageCount: asNumber(first.mrtgCnt),
    overdueTaxCount: asNumber(first.npmntCnt),
    performanceCheckCount: asNumber(first.prfomncChckCnt) ?? performanceList.length,
    responseCode: asString(first.linkRsltCd),
    responseMessage: asString(first.linkRsltDtl),
    scrapped: asYnBoolean(scrappedYn),
    scrappedYn,
    seizureCount: asNumber(first.szrCnt),
    transferDate: asDate(first.trnsfrYmd),
    usage: asString(first.usgSeNm) ?? asString(carBscInfo.usgSeNm),
    vehicleNumber: asString(first.vhrno),
    vehicleType:
      asString(first.carmdlAsortNm) ?? asString(carBscInfo.carmdlAsortNm),
    raw: payload,
  };
};
