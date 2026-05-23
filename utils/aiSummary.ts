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

export function getAiSummary(
  brand: string,
  model: string,
  year: string,
  mileage: string,
  options: AiSummaryOptions = {}
): string[] {
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

  return getUniqueSummaries([
    ...modelSummaries,
    ...evBatterySummaries,
    ...mileageSummaries,
    ...yearSummaries,
    ...brandSummaries,
  ]);
}
