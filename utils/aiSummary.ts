import { evBatteryInfo } from "@/data/evBatteryInfo";
import type { EvBatteryInfo } from "@/data/evBatteryInfo";
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

interface AiSummaryOptions {
  generation?: string;
  fuelType?: string;
}

export interface StructuredAiSummary {
  mileageSummary: string;
  modelIssues: string[];
  checkPoints: string[];
  conclusion: string;
}

interface AiSummaryParts {
  modelSummaries: string[];
  evBatterySummaries: string[];
  mileageSummaries: string[];
  yearSummaries: string[];
  brandSummaries: string[];
}

const MAX_SUMMARY_COUNT = 5;

const hasValue = (value: string) => value.trim().length > 0;

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

const formatMileageLabel = (mileageNumber: number) =>
  mileageNumber.toLocaleString("ko-KR") + "km";

const getMileageBandLabel = (mileageNumber: number) => {
  if (mileageNumber >= 200000) {
    return "20만km 이상";
  }

  if (mileageNumber >= 150000) {
    return "15만km 이상";
  }

  if (mileageNumber >= 120000) {
    return "12만km 이상";
  }

  if (mileageNumber >= 100000) {
    return "10만km 이상";
  }

  if (mileageNumber >= 80000) {
    return "8만km 이상";
  }

  if (mileageNumber >= 50000) {
    return "5만km 이상";
  }

  return "5만km 미만";
};

const getMileageSummary = (mileage: string) => {
  const mileageNumber = Number(mileage);

  if (!hasValue(mileage) || !Number.isFinite(mileageNumber)) {
    return "현재 주행거리 정보가 없어 구간별 판단은 제한됩니다. 방문 시 계기판 주행거리와 정비내역서의 기록이 일치하는지 먼저 확인하는 것이 좋습니다.";
  }

  const mileageLabel = formatMileageLabel(mileageNumber);
  const bandLabel = getMileageBandLabel(mileageNumber);

  if (mileageNumber >= 120000) {
    return (
      "이 차량은 현재 " +
      mileageLabel +
      " 주행한 " +
      bandLabel +
      " 차량으로, 단순 소모품보다 누적 관리 상태가 중요한 구간입니다. 이전 구간에서 관리되지 않은 오일류, 냉각계통, 변속기, 하체 정비 이력이 누적되어 있을 수 있으므로 최근 정비내역 확인이 중요합니다."
    );
  }

  if (mileageNumber >= 80000) {
    return (
      "이 차량은 현재 " +
      mileageLabel +
      " 주행한 " +
      bandLabel +
      " 차량으로, 기본 소모품 점검을 넘어 오일류와 냉각수, 변속기 상태까지 함께 봐야 하는 구간입니다. 이전 관리 이력이 부족하면 방문 후 추가 정비 비용이 생길 수 있습니다."
    );
  }

  if (mileageNumber >= 50000) {
    return (
      "이 차량은 현재 " +
      mileageLabel +
      " 주행한 " +
      bandLabel +
      " 차량으로, 타이어와 브레이크, 배터리 같은 소모품 교체 이력이 가격 판단에 영향을 주는 구간입니다. 큰 고장보다 관리 주기 누락 여부를 먼저 확인하는 것이 좋습니다."
    );
  }

  return (
    "이 차량은 현재 " +
    mileageLabel +
    " 주행한 " +
    bandLabel +
    " 차량으로, 누적 마모 부담은 비교적 낮은 편입니다. 다만 연식과 운행 환경에 따라 소모품 상태 차이가 커질 수 있어 기본 점검과 정비 기록 확인은 필요합니다."
  );
};

const addUniqueCheckPoint = (checkPoints: string[], checkPoint: string) => {
  if (!checkPoints.includes(checkPoint)) {
    checkPoints.push(checkPoint);
  }
};

const addCheckPointsFromMessage = (checkPoints: string[], message: string) => {
  if (/엔진|오일 소모|오일 감소|누유|GDI|노킹/.test(message)) {
    addUniqueCheckPoint(checkPoints, "엔진룸 누유 및 오일 소모 흔적");
  }

  if (/냉각수|냉각계통|워터펌프/.test(message)) {
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

  if (/전장|경고등|계기판|공조|시트|주행 보조|전자/.test(message)) {
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

const getConclusion = (mileage: string, hasModelIssues: boolean) => {
  const mileageNumber = Number(mileage);

  if (!hasValue(mileage) || !Number.isFinite(mileageNumber)) {
    return "주행거리와 정비 이력이 확인되기 전까지는 가격만 보고 판단하기 어렵습니다.";
  }

  if (mileageNumber >= 120000) {
    return "가격이 좋아도 정비 이력이 빈약하면 추가 비용 가능성이 있는 구간입니다.";
  }

  if (mileageNumber >= 80000) {
    return hasModelIssues
      ? "차종 이슈와 정비 이력이 함께 확인되면 구매 판단이 훨씬 명확해지는 구간입니다."
      : "상태가 좋아 보여도 오일류와 소모품 교체 이력은 가격 협상 전에 확인해야 합니다.";
  }

  if (mileageNumber >= 50000) {
    return "소모품 관리가 잘 되어 있다면 부담은 낮지만, 교체 주기 누락 여부는 확인해야 합니다.";
  }

  return "주행거리는 낮은 편이지만 사고, 침수, 정비 기록 확인 없이 안심하기는 어렵습니다.";
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
  const checkPoints = [
    ...getMileageCheckPoints(mileage, options.fuelType === "전기"),
  ];

  [
    ...modelIssuesOnly,
    ...parts.yearSummaries,
    ...parts.brandSummaries,
    ...parts.mileageSummaries,
  ].forEach((message) => {
    addCheckPointsFromMessage(checkPoints, message);
  });

  addUniqueCheckPoint(checkPoints, "최근 정비내역서 유무");

  return {
    mileageSummary: getMileageSummary(mileage),
    modelIssues:
      modelIssuesOnly.length > 0
        ? modelIssuesOnly
        : ["등록된 차종별 이슈 정보가 아직 없습니다."],
    checkPoints: checkPoints.slice(0, 6),
    conclusion: getConclusion(mileage, modelIssuesOnly.length > 0),
  };
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
