import { evBatteryInfo } from "@/data/evBatteryInfo";
import type { EvBatteryInfo } from "@/data/evBatteryInfo";
import { getVehicleInspectionProfile } from "@/data/vehicleInspectionData";
import { vehicleKnowledge } from "@/data/vehicleKnowledge";
import type { VehicleKnowledge } from "@/data/vehicleKnowledge";
import {
  defaultModelIssues,
  evCheckRules,
  mileageCheckRules,
  modelIssues,
  yearCheckRules,
} from "@/data/vehicleRules";
import type {
  EvCheckRule,
  ModelIssueRule,
  YearCheckRule,
} from "@/data/vehicleRules";
import type { ReviewKeywordStat } from "@/utils/reviewKeywordStats";

interface AiSummaryOptions {
  generation?: string;
  fuelType?: string;
  grade?: string;
  productUrl?: string;
  reviewKeywordStats?: ReviewKeywordStat[];
  vehicleNumber?: string;
}

export interface UsedCarProductApiResponse {
  vehicleNumber?: string | null;
  productUrl?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  modelName?: string | null;
  model?: string | null;
  generation?: string | null;
  year?: string | number | null;
  mileage?: string | number | null;
  fuelType?: string | null;
  grade?: string | null;
  trim?: string | null;
  reviewKeywords?: ReviewKeywordStat[];
}

export interface AiSummaryVehicleSource {
  vehicleNumber?: string;
  productUrl?: string;
  brand: string;
  modelName: string;
  generation?: string;
  year?: string;
  mileage?: string;
  fuelType?: string;
  grade?: string;
}

export interface AiSummaryMaintenanceIssue {
  title: string;
  description: string;
  estimatedRepairCost: string;
  symptoms: string[];
  causes: string[];
  replacementParts: string[];
  additionalDescription: string;
}

export interface StructuredAiSummary {
  vehicle: AiSummaryVehicleSource;
  oneLineReview: string;
  preDeliveryChecks: string[];
  reviewKeywords: ReviewKeywordStat[];
  maintenanceIssues: AiSummaryMaintenanceIssue[];
  source: "manual" | "product-api" | "vehicle-number";
}

interface AiSummaryParts {
  modelSummaries: string[];
  evBatterySummaries: string[];
  mileageSummaries: string[];
  yearSummaries: string[];
  brandSummaries: string[];
}

const MAX_SUMMARY_COUNT = 5;
const MAX_PRE_DELIVERY_CHECK_COUNT = 5;
const MAX_MAINTENANCE_ISSUE_COUNT = 5;

const hasValue = (value: string) => value.trim().length > 0;

const stringifyApiValue = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value).trim();

export const mapUsedCarProductApiResponseToAiSummaryInput = (
  response: UsedCarProductApiResponse,
): AiSummaryVehicleSource & { reviewKeywordStats?: ReviewKeywordStat[] } => ({
  vehicleNumber: stringifyApiValue(response.vehicleNumber) || undefined,
  productUrl: stringifyApiValue(response.productUrl) || undefined,
  brand:
    stringifyApiValue(response.brand) ||
    stringifyApiValue(response.manufacturer),
  modelName:
    stringifyApiValue(response.modelName) || stringifyApiValue(response.model),
  generation: stringifyApiValue(response.generation) || undefined,
  year: stringifyApiValue(response.year) || undefined,
  mileage: stringifyApiValue(response.mileage) || undefined,
  fuelType: stringifyApiValue(response.fuelType) || undefined,
  grade:
    stringifyApiValue(response.grade) ||
    stringifyApiValue(response.trim) ||
    undefined,
  reviewKeywordStats: response.reviewKeywords,
});

const getVehicleTitle = (vehicle: AiSummaryVehicleSource) =>
  [
    vehicle.brand,
    vehicle.modelName,
    vehicle.generation,
    vehicle.grade,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "이 차량";

const getVehicleAge = (year: string) => {
  const yearNumber = Number(year);

  if (!hasValue(year) || !Number.isFinite(yearNumber)) {
    return null;
  }

  return new Date().getFullYear() - yearNumber;
};

const getOneLineReview = (
  vehicle: AiSummaryVehicleSource,
  reviewKeywords: ReviewKeywordStat[],
) => {
  const mileageNumber = Number(vehicle.mileage);
  const hasMileage =
    hasValue(vehicle.mileage ?? "") && Number.isFinite(mileageNumber);
  const topKeyword = reviewKeywords[0]?.label;
  const vehicleAge = getVehicleAge(vehicle.year ?? "");

  if (topKeyword && hasMileage && mileageNumber >= 120000) {
    return "주행거리가 있는 편이라면 " + topKeyword + " 점검 여부가 차량 상태를 가르는 핵심일 수 있습니다.";
  }

  if (topKeyword && hasMileage && mileageNumber >= 80000) {
    return "8만km를 넘긴 차량은 " + topKeyword + " 언급과 실제 정비 이력을 같이 보는 게 좋습니다.";
  }

  if (topKeyword) {
    return "후기에서 " + topKeyword + " 이야기가 많아, 이 부분만 먼저 확인해도 판단이 빨라집니다.";
  }

  if (hasMileage && mileageNumber >= 120000) {
    return "10만km 이상이라면 소모품보다 누적 정비 이력이 차량 상태를 더 잘 보여줍니다.";
  }

  if (vehicle.fuelType === "전기") {
    return "전기차는 배터리 상태와 충전 이력만 먼저 봐도 구매 판단이 훨씬 쉬워집니다.";
  }

  if (vehicle.fuelType === "디젤") {
    return "디젤 차량은 DPF와 인젝터 관리 이력을 먼저 확인하는 게 좋습니다.";
  }

  if (vehicleAge !== null && vehicleAge >= 8) {
    return "연식이 있는 차량은 주행거리보다 누유와 하체 상태가 더 중요할 때가 많습니다.";
  }

  if (hasMileage && mileageNumber < 50000) {
    return "주행거리는 낮은 편이지만 사고 이력과 기본 소모품 상태는 꼭 따로 보세요.";
  }

  return getVehicleTitle(vehicle) + "은 연식, 주행거리, 정비 이력을 함께 보면 핵심이 빠르게 보입니다.";
};

const getPreDeliveryChecks = (
  year: string,
  mileage: string,
  fuelType: string | undefined,
  summaryMessages: string[],
) => {
  const checkPoints = [
    ...getMileageCheckPoints(mileage, fuelType === "전기"),
  ];
  const vehicleAge = getVehicleAge(year);

  if (vehicleAge !== null && vehicleAge >= 7) {
    addUniqueCheckPoint(checkPoints, "고무 부싱류와 냉각 라인 노후 상태");
  }

  if (vehicleAge !== null && vehicleAge >= 10) {
    addUniqueCheckPoint(checkPoints, "누유, 부식, 전장품 작동 이력");
  }

  if (fuelType === "전기") {
    addUniqueCheckPoint(checkPoints, "고전압 배터리 SOH 및 잔여 보증");
    addUniqueCheckPoint(checkPoints, "급속충전 이력 및 충전 포트 상태");
  } else if (fuelType === "디젤") {
    addUniqueCheckPoint(checkPoints, "DPF, EGR, 인젝터 정비 이력");
  } else if (fuelType === "하이브리드") {
    addUniqueCheckPoint(checkPoints, "구동 배터리 보증과 회생제동 작동 상태");
  }

  summaryMessages.forEach((message) => {
    addCheckPointsFromMessage(checkPoints, message);
  });

  addUniqueCheckPoint(checkPoints, "사고, 침수, 보험 이력");
  addUniqueCheckPoint(checkPoints, "타이어와 브레이크 소모 상태");
  addUniqueCheckPoint(checkPoints, "최근 정비내역서 유무");

  return checkPoints.slice(0, MAX_PRE_DELIVERY_CHECK_COUNT);
};

const getMaintenanceIssueDescription = (title: string, mileage: string) => {
  const mileageNumber = Number(mileage);
  const isHighMileage = Number.isFinite(mileageNumber) && mileageNumber >= 100000;

  if (/냉각|서모스탯|워터펌프/.test(title)) {
    return isHighMileage ? "10만km 이상이면 먼저 확인" : "냉각수 감소 흔적 확인";
  }

  if (/변속|미션/.test(title)) {
    return "시운전에서 변속 충격 확인";
  }

  if (/하체|부싱|링크|베어링/.test(title)) {
    return "요철 주행 소음 확인";
  }

  if (/점화|엔진|터보/.test(title)) {
    return "가속과 공회전 상태 확인";
  }

  if (/배터리|전장|디스플레이|BCM/.test(title)) {
    return "경고등과 전장 작동 확인";
  }

  return isHighMileage ? "주행거리 누적 차량 우선 확인" : "현장 점검 때 확인";
};

const getMaintenanceIssueCauses = (title: string) => {
  if (/냉각|서모스탯|워터펌프/.test(title)) {
    return ["냉각계통 노후", "가스켓 또는 하우징 열화"];
  }

  if (/변속|미션/.test(title)) {
    return ["변속기 오일 관리 부족", "밸브바디 또는 마운트 노후"];
  }

  if (/하체|부싱|링크|베어링/.test(title)) {
    return ["고무 부싱 마모", "하체 부품 유격"];
  }

  if (/점화|엔진|터보/.test(title)) {
    return ["점화계통 노후", "흡배기 또는 터보 계통 관리 부족"];
  }

  if (/배터리|전장|디스플레이|BCM/.test(title)) {
    return ["배터리 전압 저하", "커넥터 또는 모듈 오류"];
  }

  return ["연식과 주행거리 누적", "소모품 교체 주기 지연"];
};

const getMaintenanceIssues = (
  brand: string,
  model: string,
  mileage: string,
  options: AiSummaryOptions,
) => {
  const inspectionProfile = getVehicleInspectionProfile(
    brand,
    model,
    options.generation,
  );

  return (
    inspectionProfile?.checkItems
      .slice(0, MAX_MAINTENANCE_ISSUE_COUNT)
      .map((item) => ({
        title: item.title,
        description: getMaintenanceIssueDescription(item.title, mileage),
        estimatedRepairCost: item.estimatedRepairCost,
        symptoms: item.symptoms,
        causes: getMaintenanceIssueCauses(item.title),
        replacementParts: item.relatedParts,
        additionalDescription: item.aiSummary,
      })) ?? []
  );
};

const matchesModel = (rule: ModelIssueRule | EvCheckRule, model: string) => {
  if (rule.model) {
    return rule.model === model;
  }

  if (rule.models) {
    return rule.models.includes(model);
  }

  return true;
};

const matchesRule = (
  rule: ModelIssueRule | EvCheckRule,
  brand: string,
  model: string
) => {
  const brandMatches = !rule.brand || rule.brand === brand;

  return brandMatches && matchesModel(rule, model);
};

const matchesYearRule = (rule: YearCheckRule, year: number) => {
  const minYearMatches = rule.minYear === undefined || year >= rule.minYear;
  const maxYearMatches = rule.maxYear === undefined || year <= rule.maxYear;

  return minYearMatches && maxYearMatches;
};

const isDedicatedModelIssue = (
  rule: ModelIssueRule,
  brand: string,
  model: string
) => {
  const hasModelTarget = Boolean(rule.model || rule.models);

  return hasModelTarget && matchesRule(rule, brand, model);
};

const matchesKnowledgeModel = (knowledge: VehicleKnowledge, model: string) => {
  if (knowledge.model) {
    return knowledge.model === model;
  }

  if (knowledge.models) {
    return knowledge.models.includes(model);
  }

  return true;
};

const matchesKnowledge = (
  knowledge: VehicleKnowledge,
  brand: string,
  model: string,
  options: AiSummaryOptions
) => {
  const brandMatches = !knowledge.brand || knowledge.brand === brand;
  const modelMatches = matchesKnowledgeModel(knowledge, model);
  const generationMatches =
    !knowledge.generation || knowledge.generation === options.generation;
  const fuelTypeMatches =
    !knowledge.fuelType ||
    !options.fuelType ||
    knowledge.fuelType === options.fuelType;

  return brandMatches && modelMatches && generationMatches && fuelTypeMatches;
};

const matchesEvBatteryInfo = (
  batteryInfo: EvBatteryInfo,
  brand: string,
  model: string,
  options: AiSummaryOptions
) => {
  const brandMatches = batteryInfo.brand === brand;
  const modelMatches = batteryInfo.model === model;
  const generationMatches =
    !batteryInfo.generation || batteryInfo.generation === options.generation;

  return brandMatches && modelMatches && generationMatches;
};

const getMessageTopic = (message: string) => {
  if (/ICCU/.test(message)) {
    return "iccu";
  }

  if (/히터|PTC|공조|열관리/.test(message)) {
    return "hvac";
  }

  if (/PDK|2단 전기차 변속기/.test(message)) {
    return "ev-transmission";
  }

  if (
    /내연기관|엔진|엔진오일|오일 소모|오일 감소|점화계통|인젝터|EGR|DPF|GDI|노킹|누유/.test(
      message
    )
  ) {
    return "engine";
  }

  if (
    /일반 미션|미션|미션오일|변속기 오일|변속기오일|변속 충격|저속 울컥|변속감|클러치|DSG|S트로닉|CVT/.test(
      message
    )
  ) {
    return "transmission";
  }

  if (/SOH|고전압 배터리|배터리|셀 타입|제조사/.test(message)) {
    return "battery";
  }

  if (/급속충전|충전/.test(message)) {
    return "charging";
  }

  if (/주행거리|브레이크|타이어|하체|부싱|소모품/.test(message)) {
    return "wear";
  }

  if (/연식|리콜|보증/.test(message)) {
    return "age";
  }

  return message;
};

const isEvFriendlyMessage = (message: string) => {
  if (
    /전기차|고전압|배터리|SOH|급속충전|충전|구동모터|감속기|ICCU|PTC|공조|열관리|2단 전기차 변속기/.test(
      message
    )
  ) {
    return true;
  }

  return !/내연기관|엔진|엔진오일|오일 소모|오일 감소|미션|미션오일|변속기 오일|변속기오일|PDK|DSG|S트로닉|CVT|터보|디젤|GDI|점화계통|인젝터|EGR|DPF/.test(
    message
  );
};

const pushSummary = (
  messages: string[],
  message: string,
  isElectric: boolean
) => {
  if (isElectric && !isEvFriendlyMessage(message)) {
    return;
  }

  const topic = getMessageTopic(message);
  const hasSimilarMessage = messages.some(
    (item) => getMessageTopic(item) === topic
  );

  if (!hasSimilarMessage) {
    messages.push(message);
  }
};

const getUniqueSummaries = (messages: string[]) => {
  const seenMessages = new Set<string>();
  const seenTopics = new Set<string>();
  const summaries: string[] = [];

  messages.forEach((message) => {
    const normalizedMessage = message.replace(/\s+/g, " ").trim();
    const topic = getMessageTopic(normalizedMessage);

    if (seenMessages.has(normalizedMessage) || seenTopics.has(topic)) {
      return;
    }

    seenMessages.add(normalizedMessage);
    seenTopics.add(topic);
    summaries.push(message);
  });

  return summaries.slice(0, MAX_SUMMARY_COUNT);
};

const collectAiSummaryParts = (
  brand: string,
  model: string,
  year: string,
  mileage: string,
  options: AiSummaryOptions = {}
): AiSummaryParts => {
  const modelSummaries: string[] = [];
  const evBatterySummaries: string[] = [];
  const mileageSummaries: string[] = [];
  const yearSummaries: string[] = [];
  const brandSummaries: string[] = [];
  const mileageNumber = Number(mileage);
  const yearNumber = Number(year);
  const isElectric = options.fuelType === "전기";
  const hasEvBatteryInfo = evBatteryInfo.some((batteryInfo) =>
    matchesEvBatteryInfo(batteryInfo, brand, model, options)
  );

  modelIssues.forEach((rule) => {
    if (matchesRule(rule, brand, model)) {
      pushSummary(modelSummaries, rule.message, isElectric);
    }
  });

  vehicleKnowledge.forEach((knowledge) => {
    if (!matchesKnowledge(knowledge, brand, model, options)) {
      return;
    }

    const knowledgeMessages =
      isElectric && brand === "포르쉐" && model === "타이칸"
        ? knowledge.checkPoints.filter((checkPoint) =>
            /PDK|2단 전기차 변속기/.test(checkPoint)
          )
        : [...knowledge.checkPoints, knowledge.warningMessage];

    knowledgeMessages.forEach((message) => {
      pushSummary(modelSummaries, message, isElectric);
    });
  });

  const inspectionProfile = getVehicleInspectionProfile(
    brand,
    model,
    options.generation
  );

  if (inspectionProfile) {
    pushSummary(modelSummaries, inspectionProfile.summary, isElectric);
    inspectionProfile.checkItems.slice(0, 5).forEach((item) => {
      pushSummary(modelSummaries, item.aiSummary, isElectric);
    });
  }

  evBatteryInfo.forEach((batteryInfo) => {
    if (!matchesEvBatteryInfo(batteryInfo, brand, model, options)) {
      return;
    }

    pushSummary(
      evBatterySummaries,
      model +
        " 배터리는 제조사 " +
        batteryInfo.batterySuppliers.join(", ") +
        ", 셀 타입 " +
        batteryInfo.batteryType +
        "로 알려져 있으나 트림/연식에 따라 다를 수 있어 확인을 권장합니다.",
      isElectric
    );
    batteryInfo.notes.forEach((note) => {
      pushSummary(evBatterySummaries, note, isElectric);
    });
  });

  if (!hasEvBatteryInfo) {
    evCheckRules.forEach((rule) => {
      if (hasValue(model) && matchesRule(rule, brand, model)) {
        pushSummary(evBatterySummaries, rule.message, isElectric);
      }
    });
  }

  mileageCheckRules.forEach((rule) => {
    if (hasValue(mileage) && mileageNumber >= rule.minMileage) {
      pushSummary(mileageSummaries, rule.message, isElectric);
    }
  });

  yearCheckRules.forEach((rule) => {
    if (hasValue(year) && matchesYearRule(rule, yearNumber)) {
      pushSummary(yearSummaries, rule.message, isElectric);
    }
  });

  const hasDedicatedIssue = modelIssues.some((rule) =>
    isDedicatedModelIssue(rule, brand, model)
  );

  if (!hasDedicatedIssue) {
    defaultModelIssues.forEach((rule) => {
      if (matchesRule(rule, brand, model)) {
        pushSummary(brandSummaries, rule.message, isElectric);
      }
    });
  }

  return {
    modelSummaries,
    evBatterySummaries,
    mileageSummaries,
    yearSummaries,
    brandSummaries,
  };
};

const addUniqueCheckPoint = (checkPoints: string[], checkPoint: string) => {
  if (!checkPoints.includes(checkPoint)) {
    checkPoints.push(checkPoint);
  }
};

const addCheckPointsFromMessage = (checkPoints: string[], message: string) => {
  if (/엔진|오일 소모|오일 감소|누유|GDI|노킹|점화|터보/.test(message)) {
    addUniqueCheckPoint(checkPoints, "엔진룸 누유 및 오일 소모 흔적");
  }

  if (/냉각수|냉각계통|워터펌프|서모스탯|냉각팬/.test(message)) {
    addUniqueCheckPoint(checkPoints, "냉각수 보조탱크 및 호스 상태");
  }

  if (/미션|변속|변속기|DCT|DSG|S트로닉|CVT|PDK|울컥/.test(message)) {
    addUniqueCheckPoint(checkPoints, "변속 충격 및 저속 울컥거림");
  }

  if (/하체|부싱|쇼크업소버|등속조인트|잡소리/.test(message)) {
    addUniqueCheckPoint(checkPoints, "하체 소음 및 부싱 상태");
  }

  if (/브레이크|타이어/.test(message)) {
    addUniqueCheckPoint(checkPoints, "타이어와 브레이크 소모 상태");
  }

  if (/리콜|보증|정비 이력|정비내역|교체 이력/.test(message)) {
    addUniqueCheckPoint(checkPoints, "최근 정비내역서 및 리콜 처리 이력");
  }

  if (/전장|경고등|계기판|공조|시트|주행 보조|전자|디스플레이|BCM|에어컨/.test(message)) {
    addUniqueCheckPoint(checkPoints, "계기판 경고등 및 전장품 작동 상태");
  }

  if (/배터리|SOH|고전압/.test(message)) {
    addUniqueCheckPoint(checkPoints, "고전압 배터리 SOH 및 잔여 보증");
  }

  if (/급속충전|충전/.test(message)) {
    addUniqueCheckPoint(checkPoints, "급속충전 이력 및 충전 포트 상태");
  }
};

const getMileageCheckPoints = (mileage: string, isElectric: boolean) => {
  const mileageNumber = Number(mileage);
  const checkPoints: string[] = [];

  if (!hasValue(mileage) || !Number.isFinite(mileageNumber)) {
    return ["계기판 주행거리와 정비내역서 기록 일치 여부"];
  }

  if (mileageNumber >= 50000) {
    addUniqueCheckPoint(checkPoints, "타이어와 브레이크 소모 상태");
    addUniqueCheckPoint(checkPoints, "배터리 또는 12V 배터리 교체 이력");
  }

  if (mileageNumber >= 80000) {
    addUniqueCheckPoint(checkPoints, "냉각수 보조탱크 및 호스 상태");
    addUniqueCheckPoint(
      checkPoints,
      isElectric ? "감속기 오일 및 구동계 소음" : "변속기 오일 및 변속 충격"
    );
  }

  if (mileageNumber >= 120000) {
    addUniqueCheckPoint(checkPoints, "엔진룸 누유 및 오일 소모 흔적");
    addUniqueCheckPoint(checkPoints, "하체 소음 및 부싱 상태");
  }

  if (mileageNumber >= 200000) {
    addUniqueCheckPoint(checkPoints, "엔진 압축 또는 주요 구동계 정비 이력");
  }

  return checkPoints;
};

export function getStructuredAiSummary(
  brand: string,
  model: string,
  year: string,
  mileage: string,
  options: AiSummaryOptions = {}
): StructuredAiSummary {
  const parts = collectAiSummaryParts(brand, model, year, mileage, options);
  const modelIssuesOnly = getUniqueSummaries([
    ...parts.modelSummaries,
    ...parts.evBatterySummaries,
  ]);
  const summaryMessages = [
    ...modelIssuesOnly,
    ...parts.yearSummaries,
    ...parts.brandSummaries,
    ...parts.mileageSummaries,
  ];
  const vehicle: AiSummaryVehicleSource = {
    vehicleNumber: options.vehicleNumber,
    productUrl: options.productUrl,
    brand,
    modelName: model,
    generation: options.generation,
    year,
    mileage,
    fuelType: options.fuelType,
    grade: options.grade,
  };
  const reviewKeywords = (options.reviewKeywordStats ?? []).slice(
    0,
    MAX_SUMMARY_COUNT,
  );

  return {
    vehicle,
    oneLineReview: getOneLineReview(vehicle, reviewKeywords),
    preDeliveryChecks: getPreDeliveryChecks(
      year,
      mileage,
      options.fuelType,
      summaryMessages,
    ),
    reviewKeywords,
    maintenanceIssues: getMaintenanceIssues(brand, model, mileage, options),
    source: options.productUrl
      ? "product-api"
      : options.vehicleNumber
        ? "vehicle-number"
        : "manual",
  };
}

export function getStructuredAiSummaryFromApiResponse(
  response: UsedCarProductApiResponse,
): StructuredAiSummary {
  const input = mapUsedCarProductApiResponseToAiSummaryInput(response);

  return getStructuredAiSummary(
    input.brand,
    input.modelName,
    input.year ?? "",
    input.mileage ?? "",
    {
      fuelType: input.fuelType,
      generation: input.generation,
      grade: input.grade,
      productUrl: input.productUrl,
      reviewKeywordStats: input.reviewKeywordStats,
      vehicleNumber: input.vehicleNumber,
    },
  );
}

export function getAiSummary(
  brand: string,
  model: string,
  year: string,
  mileage: string,
  options: AiSummaryOptions = {}
): string[] {
  const parts = collectAiSummaryParts(brand, model, year, mileage, options);

  return getUniqueSummaries([
    ...parts.modelSummaries,
    ...parts.evBatterySummaries,
    ...parts.mileageSummaries,
    ...parts.yearSummaries,
    ...parts.brandSummaries,
  ]);
}
