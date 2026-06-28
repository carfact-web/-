import { evBatteryInfo } from "@/data/evBatteryInfo";
import type { EvBatteryInfo } from "@/data/evBatteryInfo";
import { getVehicleInspectionProfile } from "@/data/vehicleInspectionData";
import type { VehicleInspectionProfile } from "@/data/vehicleInspectionData";
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
  hasScr?: boolean | number | string | null;
  inspectionProfile?: VehicleInspectionProfile | null;
  productUrl?: string;
  reviewCount?: number;
  reviewKeywordStats?: ReviewKeywordStat[];
  scrType?: boolean | number | string | null;
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
  hasScr?: boolean | number | string | null;
  scrType?: boolean | number | string | null;
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
  reviewMentionScore: number | null;
  symptoms: string[];
  causes: string[];
  replacementParts: string[];
  additionalDescription: string;
}

interface MaintenanceIssueCategory {
  key: string;
  title: string;
  description: string;
  causes: string[];
  pattern: RegExp;
}

export interface StructuredAiSummary {
  vehicle: AiSummaryVehicleSource;
  oneLineReview: string;
  overviewSentences: string[];
  preDeliveryChecks: string[];
  reviewAnalysisLabel: string;
  reviewKeywords: ReviewKeywordStat[];
  representativeIssues: string[];
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
): AiSummaryVehicleSource &
  Pick<AiSummaryOptions, "hasScr" | "reviewKeywordStats" | "scrType"> => ({
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
  hasScr: response.hasScr,
  scrType: response.scrType,
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
    .trim() || "이 차";

const joinKoreanList = (items: string[]) => {
  if (items.length <= 2) {
    return items.join(", ");
  }

  return items.slice(0, -1).join(", ") + ", " + items[items.length - 1];
};

const getReviewAnalysisLabel = (reviewCount = 0) => {
  if (reviewCount <= 0) {
    return "등록 후기 기반 분석 준비 중";
  }

  return "등록 후기 " + reviewCount.toLocaleString("ko-KR") + "건 기반 분석";
};

const getDataBasedOverview = (
  reviewKeywords: ReviewKeywordStat[],
  maintenanceIssues: AiSummaryMaintenanceIssue[],
) => {
  const keywordLabels = reviewKeywords.slice(0, 3).map((keyword) => keyword.label);
  const issueTitles = maintenanceIssues.slice(0, 3).map((issue) => issue.title);
  const sentences: string[] = [];

  if (keywordLabels.length > 0) {
    sentences.push(
      "후기에서 " +
        joinKoreanList(keywordLabels) +
        " 관련 언급이 반복적으로 확인됩니다.",
    );
  } else if (issueTitles.length > 0) {
    sentences.push(
      "구매 전 " + joinKoreanList(issueTitles) + " 상태를 먼저 확인해 보세요.",
    );
  } else {
    sentences.push("등록 후기가 쌓이면 주요 언급 항목을 먼저 보여드립니다.");
  }

  if (issueTitles.length > 0) {
    sentences.push(
      "구매 전 " +
        joinKoreanList(issueTitles) +
        " 관련 상태 확인을 권장합니다.",
    );
  }

  if (keywordLabels.length > 0 && issueTitles.length > 0) {
    sentences.push(
      "실제 후기와 주요 정비 항목을 함께 보고 판단해 보세요.",
    );
  }

  return sentences.slice(0, 3);
};

const getVehicleAge = (year: string) => {
  const yearNumber = Number(year);

  if (!hasValue(year) || !Number.isFinite(yearNumber)) {
    return null;
  }

  return new Date().getFullYear() - yearNumber;
};

const getKeywordOneLineReview = (keyword: string) => {
  if (/냉각|워터펌프|서모스탯/.test(keyword)) {
    return "냉각계통 관리 이력만 봐도 이 차의 컨디션을 어느 정도 짐작할 수 있습니다. 냉각수 보충이나 워터펌프 수리 이력을 한번 봐주세요.";
  }

  if (/미션|변속|DCT|클러치|울컥/.test(keyword)) {
    return "저속에서 울컥거린다면 미션이 보내는 신호일 수도 있습니다. 시험주행에서 변속감을 꼭 느껴보세요.";
  }

  if (/하체|부싱|로어암|소음|베어링/.test(keyword)) {
    return "하체 소음은 작은 잡소리처럼 보여도 관리 상태를 꽤 솔직하게 보여줍니다. 요철 구간에서 소리를 한번 들어보세요.";
  }

  if (/점화|엔진 떨림|실화|공회전/.test(keyword)) {
    return "시동과 공회전이 매끄러운지만 봐도 엔진 컨디션이 어느 정도 드러납니다. 점화계통 정비 이력이 있으면 더 안심입니다.";
  }

  if (/터보|부스트/.test(keyword)) {
    return "터보차는 가속할 때 힘이 자연스럽게 붙는지가 핵심입니다. 출력 저하나 휘파람 소리는 그냥 넘기지 마세요.";
  }

  if (/누유|오일/.test(keyword)) {
    return "누유 흔적은 이 차가 어떻게 관리됐는지 보여주는 빠른 단서입니다. 리프트 점검에서 하부를 꼭 봐주세요.";
  }

  if (/배터리|전장|방전/.test(keyword)) {
    return "전장과 배터리는 멀쩡할 땐 티가 안 나도 한번 꼬이면 꽤 번거롭습니다. 경고등과 시동 전압을 먼저 봐주세요.";
  }

  return keyword + " 이야기가 많이 나오는 차입니다. 그 부분부터 보면 판단이 훨씬 빨라집니다.";
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

  if (topKeyword) {
    return getKeywordOneLineReview(topKeyword);
  }

  if (hasMileage && mileageNumber >= 120000) {
    return "주행거리가 쌓인 차는 정비 이력이 곧 컨디션입니다. 기록이 깔끔하면 오히려 믿고 볼 만합니다.";
  }

  if (vehicle.fuelType === "전기") {
    return "전기차는 배터리 상태가 차값만큼 중요합니다. SOH와 충전 이력부터 먼저 봐주세요.";
  }

  if (vehicle.fuelType === "디젤") {
    return "DPF와 EGR 관리 상태가 유지비를 크게 좌우하는 차량입니다. 관련 정비 이력이 있으면 오히려 안심할 수 있습니다.";
  }

  if (vehicleAge !== null && vehicleAge >= 8) {
    return "연식이 있는 차는 겉모습보다 하부와 누유 흔적이 더 많은 걸 말해줍니다. 리프트 점검은 꼭 챙겨보세요.";
  }

  if (hasMileage && mileageNumber < 50000) {
    return "주행거리가 낮아도 무조건 안심할 차는 아닙니다. 사고 이력과 소모품 상태를 같이 봐주세요.";
  }

  const vehicleTitle = getVehicleTitle(vehicle);

  return vehicleTitle === "이 차"
    ? "기본 관리 이력이 첫인상을 좌우하는 차입니다. 정비 기록이 깔끔하면 훨씬 편하게 볼 수 있습니다."
    : vehicleTitle + "는 기본 관리 이력이 첫인상을 좌우하는 차입니다. 정비 기록이 깔끔하면 훨씬 편하게 볼 수 있습니다.";
};

const getPreDeliveryChecks = (
  year: string,
  mileage: string,
  fuelType: string | undefined,
  summaryMessages: string[],
) => {
  const checkPoints: string[] = [];

  summaryMessages.forEach((message) => {
    addCheckPointsFromMessage(checkPoints, message);
  });

  getMileageCheckPoints(mileage, fuelType === "전기").forEach((checkPoint) => {
    addUniqueCheckPoint(checkPoints, checkPoint);
  });

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

  addUniqueCheckPoint(checkPoints, "사고, 침수, 보험 이력");
  addUniqueCheckPoint(checkPoints, "타이어와 브레이크 소모 상태");
  addUniqueCheckPoint(checkPoints, "최근 정비내역서 유무");

  return checkPoints.slice(0, MAX_PRE_DELIVERY_CHECK_COUNT);
};

const maintenanceIssueCategories: MaintenanceIssueCategory[] = [
  {
    key: "cooling",
    title: "냉각계통 점검",
    description: "냉각수 감소와 과열 이력 확인",
    causes: ["냉각계통 노후", "가스켓 또는 하우징 열화"],
    pattern: /냉각|서모스탯|워터펌프/,
  },
  {
    key: "ignition",
    title: "점화계통 점검",
    description: "시동, 공회전, 가속 떨림 확인",
    causes: ["점화 플러그/코일 노후", "실화 코드 또는 커넥터 문제"],
    pattern: /점화코일|점화플러그|점화/,
  },
  {
    key: "suspension",
    title: "하체 소음 점검",
    description: "요철 주행 소음과 유격 확인",
    causes: ["고무 부싱 마모", "하체 부품 유격"],
    pattern: /하체|부싱|로어암|스태빌|활대|링크|베어링|쇼크|등속/,
  },
  {
    key: "transmission",
    title: "미션변속 점검",
    description: "시운전에서 변속 충격 확인",
    causes: ["변속기 오일 관리 부족", "밸브바디 또는 마운트 노후"],
    pattern: /변속|미션|DCT|DSG|CVT|PDK/,
  },
  {
    key: "turbo",
    title: "터보계통 점검",
    description: "가속 시 출력과 터보 소음 확인",
    causes: ["터보차저 노후", "흡기 라인 누설"],
    pattern: /터보|부스트|웨이스트게이트/,
  },
  {
    key: "electrical",
    title: "전장/배터리 점검",
    description: "경고등과 실내 전장 작동 확인",
    causes: ["배터리 전압 저하", "커넥터 또는 모듈 오류"],
    pattern: /배터리|전장|디스플레이|BCM|모니터|헤드유닛/,
  },
  {
    key: "engine",
    title: "엔진 상태 점검",
    description: "누유, 떨림, 출력 저하 확인",
    causes: ["엔진오일 관리 부족", "흡배기 또는 연소계통 노후"],
    pattern: /엔진|누유|오일|실화|인젝터|EGR|DPF/,
  },
];

const escapeRegExp = (value: string) =>
  value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");

const getMaintenanceIssueCategory = (title: string): MaintenanceIssueCategory =>
  maintenanceIssueCategories.find((category) => category.pattern.test(title)) ?? {
    key: title,
    title,
    description: "현장 점검 때 확인",
    causes: ["연식과 주행거리 누적", "소모품 교체 주기 지연"],
    pattern: new RegExp(escapeRegExp(title)),
  };

const getMaintenanceIssueDescription = (
  category: MaintenanceIssueCategory,
  mileage: string,
) => {
  const mileageNumber = Number(mileage);
  const isHighMileage = Number.isFinite(mileageNumber) && mileageNumber >= 100000;

  if (category.key === "cooling" && isHighMileage) {
    return "10만km 이상이면 먼저 확인";
  }

  return category.description;
};

const addUniqueValues = (target: string[], values: string[]) => {
  values.forEach((value) => {
    if (!target.includes(value)) {
      target.push(value);
    }
  });
};

const getMergedRepairCost = (costs: string[]) => {
  const values = costs.flatMap((cost) =>
    Array.from(cost.matchAll(/(\d+)\s*만/g)).map((match) => Number(match[1])),
  );

  if (values.length === 0) {
    return costs[0] ?? "현장 확인";
  }

  return Math.min(...values) + "만~" + Math.max(...values) + "만원";
};

const getMaintenanceIssueCategoryOrder = (key: string) => {
  const index = maintenanceIssueCategories.findIndex(
    (category) => category.key === key,
  );

  return index === -1 ? maintenanceIssueCategories.length : index;
};

const getMatchedReviewKeywordStat = (
  category: MaintenanceIssueCategory,
  replacementParts: string[],
  reviewKeywordStats: ReviewKeywordStat[],
) =>
  reviewKeywordStats.find((stat) => {
    const searchText = [stat.label, ...replacementParts].join(" ");

    return category.pattern.test(searchText);
  });

const getReviewMentionScore = (stat?: ReviewKeywordStat) => {
  if (!stat) {
    return null;
  }

  if (stat.percentage >= 40 || stat.count >= 20) {
    return 5;
  }

  if (stat.percentage >= 25 || stat.count >= 10) {
    return 4;
  }

  if (stat.percentage >= 15 || stat.count >= 5) {
    return 3;
  }

  return 2;
};

const hasDieselFuelType = (fuelType?: string) =>
  /디젤|diesel/i.test(fuelType ?? "");

const hasGasolineOrLpgFuelType = (fuelType?: string) =>
  /가솔린|휘발유|gasoline|petrol|lpg/i.test(fuelType ?? "");

const parseVehicleYear = (year: string) => {
  const yearNumber = Number(String(year).match(/\d{4}/)?.[0] ?? year);

  return Number.isFinite(yearNumber) ? yearNumber : null;
};

const parseVehicleMileage = (mileage: string) => {
  const mileageNumber = Number(String(mileage).replace(/[^0-9]/g, ""));

  return Number.isFinite(mileageNumber) ? mileageNumber : null;
};

const normalizeMaintenancePart = (part: string) =>
  part.toLowerCase().replace(/[^0-9a-z가-힣/]+/g, "");

const isExplicitScrValue = (
  value: boolean | number | string | null | undefined,
) => {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    !normalizedValue ||
    /^(false|0|no|none|null|unknown|미상|없음|미적용)$/.test(normalizedValue)
  ) {
    return false;
  }

  return /scr|adblue|요소수|적용|true|yes/.test(normalizedValue);
};

const shouldIncludeScrMaintenance = (
  options: AiSummaryOptions,
) => isExplicitScrValue(options.hasScr) || isExplicitScrValue(options.scrType);

interface DefaultMaintenanceRule {
  fuelType: "gasoline-lpg";
  minAgeYears?: number;
  minMileage?: number;
  replacementParts: string[];
  title: string;
  description: string;
  additionalDescription: string;
}

const defaultMaintenanceRules: DefaultMaintenanceRule[] = [
  {
    fuelType: "gasoline-lpg",
    minAgeYears: 5,
    minMileage: 50000,
    replacementParts: ["점화코일", "점화플러그"],
    title: "기본 소모품 참고 항목",
    description: "연식/주행거리 기준 확인 항목",
    additionalDescription:
      "연식 또는 주행거리 기준으로 함께 확인할 참고 정비 항목입니다.",
  },
];

const matchesDefaultMaintenanceRule = (
  rule: DefaultMaintenanceRule,
  year: string,
  mileage: string,
  options: AiSummaryOptions,
) => {
  if (
    rule.fuelType === "gasoline-lpg" &&
    !hasGasolineOrLpgFuelType(options.fuelType)
  ) {
    return false;
  }

  const yearNumber = parseVehicleYear(year);
  const mileageNumber = parseVehicleMileage(mileage);
  const vehicleAge =
    yearNumber === null ? null : new Date().getFullYear() - yearNumber;
  const matchesAge =
    rule.minAgeYears !== undefined &&
    vehicleAge !== null &&
    vehicleAge >= rule.minAgeYears;
  const matchesMileage =
    rule.minMileage !== undefined &&
    mileageNumber !== null &&
    mileageNumber >= rule.minMileage;

  return matchesAge || matchesMileage;
};

const getExistingMaintenancePartSet = (
  issues: AiSummaryMaintenanceIssue[],
  reviewKeywordStats: ReviewKeywordStat[],
) =>
  new Set(
    [
      ...issues.flatMap((issue) => issue.replacementParts),
      ...reviewKeywordStats.map((keyword) => keyword.label),
    ].map(normalizeMaintenancePart),
  );

const addDefaultMaintenanceIssue = (
  issues: AiSummaryMaintenanceIssue[],
  year: string,
  mileage: string,
  options: AiSummaryOptions,
  reviewKeywordStats: ReviewKeywordStat[],
) => {
  const existingParts = getExistingMaintenancePartSet(
    issues,
    reviewKeywordStats,
  );
  const defaultIssues: AiSummaryMaintenanceIssue[] = [];

  defaultMaintenanceRules.forEach((rule) => {
    if (!matchesDefaultMaintenanceRule(rule, year, mileage, options)) {
      return;
    }

    const replacementParts = rule.replacementParts.filter(
      (part) => !existingParts.has(normalizeMaintenancePart(part)),
    );

    if (replacementParts.length === 0) {
      return;
    }

    replacementParts.forEach((part) =>
      existingParts.add(normalizeMaintenancePart(part)),
    );
    defaultIssues.push({
      title: rule.title,
      description: rule.description,
      estimatedRepairCost: "현장 확인",
      reviewMentionScore: null,
      symptoms: [],
      causes: [],
      replacementParts,
      additionalDescription: rule.additionalDescription,
    });
  });

  if (!hasDieselFuelType(options.fuelType)) {
    return [...defaultIssues, ...issues];
  }

  const defaultParts = ["DPF", "터보", "인젝터", "촉매"];

  if (shouldIncludeScrMaintenance(options)) {
    defaultParts.push("요소수/SCR");
  }

  const replacementParts = defaultParts.filter(
    (part) => !existingParts.has(normalizeMaintenancePart(part)),
  );

  return [
    ...defaultIssues,
    ...(replacementParts.length > 0
      ? [
          {
            title: "디젤 참고 정비 항목",
            description: "디젤 차량 기본 확인 항목",
            estimatedRepairCost: "현장 확인",
            reviewMentionScore: null,
            symptoms: [],
            causes: [],
            replacementParts,
            additionalDescription: "디젤 차량에서 함께 확인할 참고 정비 항목입니다.",
          },
        ]
      : []),
    ...issues,
  ];
};

const getMaintenanceIssues = (
  brand: string,
  model: string,
  year: string,
  mileage: string,
  options: AiSummaryOptions,
) => {
  const inspectionProfile =
    options.inspectionProfile ??
    getVehicleInspectionProfile(brand, model, options.generation);
  const reviewKeywordStats = options.reviewKeywordStats ?? [];

  const groupedIssues = new Map<
    string,
    {
      category: MaintenanceIssueCategory;
      symptoms: string[];
      replacementParts: string[];
      descriptions: string[];
      repairCosts: string[];
    }
  >();

  inspectionProfile?.checkItems.forEach((item) => {
    const category = getMaintenanceIssueCategory(item.title);
    const group = groupedIssues.get(category.key) ?? {
      category,
      symptoms: [],
      replacementParts: [],
      descriptions: [],
      repairCosts: [],
    };

    addUniqueValues(group.symptoms, item.symptoms);
    addUniqueValues(group.replacementParts, item.relatedParts);
    addUniqueValues(group.descriptions, [item.aiSummary]);
    addUniqueValues(group.repairCosts, [item.estimatedRepairCost]);
    groupedIssues.set(category.key, group);
  });

  const issues = Array.from(groupedIssues.values())
    .sort(
      (left, right) =>
        getMaintenanceIssueCategoryOrder(left.category.key) -
        getMaintenanceIssueCategoryOrder(right.category.key),
    )
    .slice(0, MAX_MAINTENANCE_ISSUE_COUNT)
    .map((group) => {
      const replacementParts = group.replacementParts.slice(0, 6);
      const matchedReviewKeyword = getMatchedReviewKeywordStat(
        group.category,
        replacementParts,
        reviewKeywordStats,
      );

      return {
        title: group.category.title,
        description: getMaintenanceIssueDescription(group.category, mileage),
        estimatedRepairCost: getMergedRepairCost(group.repairCosts),
        reviewMentionScore: getReviewMentionScore(matchedReviewKeyword),
        symptoms: group.symptoms.slice(0, 4),
        causes: group.category.causes,
        replacementParts,
        additionalDescription: group.descriptions[0] ?? group.category.description,
      };
    });

  return addDefaultMaintenanceIssue(
    issues,
    year,
    mileage,
    options,
    reviewKeywordStats,
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

  const inspectionProfile =
    options.inspectionProfile ??
    getVehicleInspectionProfile(brand, model, options.generation);

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

  if (/누수|물샘/.test(message)) {
    addUniqueCheckPoint(checkPoints, "누수 흔적 확인");
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
  const maintenanceIssues = getMaintenanceIssues(
    brand,
    model,
    year,
    mileage,
    options,
  );
  const overviewSentences = getDataBasedOverview(
    reviewKeywords,
    maintenanceIssues,
  );

  return {
    vehicle,
    oneLineReview: overviewSentences[0] ?? getOneLineReview(vehicle, reviewKeywords),
    overviewSentences,
    preDeliveryChecks: getPreDeliveryChecks(
      year,
      mileage,
      options.fuelType,
      summaryMessages,
    ),
    reviewAnalysisLabel: getReviewAnalysisLabel(options.reviewCount),
    reviewKeywords,
    representativeIssues: maintenanceIssues.map((issue) => issue.title),
    maintenanceIssues,
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
      hasScr: input.hasScr,
      productUrl: input.productUrl,
      reviewKeywordStats: input.reviewKeywordStats,
      scrType: input.scrType,
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
