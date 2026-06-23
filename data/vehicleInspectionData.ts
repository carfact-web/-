export type InspectionImportance = "상" | "중" | "하";

export interface VehicleInspectionItem {
  title: string;
  symptoms: string[];
  relatedParts: string[];
  importance: InspectionImportance;
  estimatedRepairCost: string;
  aiSummary: string;
}

export interface VehicleYearInspectionNote {
  minYear: number;
  maxYear: number;
  label: string;
  summary: string;
}

export interface VehicleEngineInspectionNote {
  engine: string;
  summary: string;
}

export interface VehicleInspectionProfile {
  brand: string;
  model?: string;
  models?: string[];
  generations?: string[];
  summary: string;
  checkItems: VehicleInspectionItem[];
  yearNotes: VehicleYearInspectionNote[];
  engineNotes: VehicleEngineInspectionNote[];
}

const normalizeMatchText = (value: string) =>
  value.replace(/\s+/g, "").trim().toLowerCase();

const matchesText = (target: string, candidates: string[]) => {
  const normalizedTarget = normalizeMatchText(target);

  return candidates.some(
    (candidate) => normalizeMatchText(candidate) === normalizedTarget,
  );
};

const matchesLooseText = (target: string, candidates: string[]) => {
  const normalizedTarget = normalizeMatchText(target);

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeMatchText(candidate);

    return (
      normalizedTarget === normalizedCandidate ||
      normalizedTarget.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedTarget)
    );
  });
};

const matchesProfileModel = (profile: VehicleInspectionProfile, model: string) => {
  if (profile.model) {
    return matchesText(model, [profile.model]);
  }

  if (profile.models) {
    return matchesText(model, profile.models);
  }

  return true;
};

const matchesProfileGeneration = (
  profile: VehicleInspectionProfile,
  generation?: string,
) => {
  if (!profile.generations || profile.generations.length === 0) {
    return true;
  }

  if (!generation) {
    return true;
  }

  return matchesLooseText(generation, profile.generations);
};

export const vehicleInspectionProfiles: VehicleInspectionProfile[] = [
  {
    brand: "쉐보레",
    model: "말리부",
    generations: ["올 뉴 말리부", "올뉴 말리부", "더 뉴 말리부", "더뉴 말리부"],
    summary:
      "말리부는 냉각계통과 하체 부싱류 점검이 자주 권장되는 차량입니다. 특히 10만km 이상 차량은 냉각수 누수와 하체 소음을 우선 확인해보세요.",
    checkItems: [
      {
        title: "냉각팬 모터 소음",
        symptoms: [
          "정차 중 냉각팬 작동음이 크게 들림",
          "저속 주행 후 팬 진동 또는 거친 회전음 발생",
        ],
        relatedParts: ["냉각팬 모터", "팬 슈라우드", "팬 릴레이"],
        importance: "중",
        estimatedRepairCost: "20만~45만원",
        aiSummary:
          "정차 또는 저속에서 팬 소음이 크면 냉각팬 모터와 팬 슈라우드 체결 상태를 한번 봐주세요.",
      },
      {
        title: "서모스탯 하우징 누수",
        symptoms: [
          "냉각수 보충 주기가 짧아짐",
          "하우징 주변에 냉각수 자국이나 냄새 발생",
        ],
        relatedParts: ["서모스탯 하우징", "가스켓", "냉각수 호스"],
        importance: "상",
        estimatedRepairCost: "20만~45만원",
        aiSummary:
          "냉각수 감소가 보이면 서모스탯 하우징 주변 누수 흔적과 수온 안정성을 먼저 확인해보세요.",
      },
      {
        title: "워터펌프 누수",
        symptoms: [
          "엔진룸 하부 냉각수 누수 흔적",
          "냉각수 냄새 또는 수온 상승 경고",
        ],
        relatedParts: ["워터펌프", "워터펌프 가스켓", "구동 벨트"],
        importance: "상",
        estimatedRepairCost: "30만~70만원",
        aiSummary:
          "워터펌프 누수는 과열로 이어질 수 있어 냉각수 라인과 펌프 주변 누수 여부를 우선 점검해야 합니다.",
      },
      {
        title: "점화코일 노후",
        symptoms: [
          "가속 시 울컥거림",
          "엔진 경고등 또는 실화 코드 발생",
        ],
        relatedParts: ["점화코일", "점화 배선", "ECU 실화 진단"],
        importance: "중",
        estimatedRepairCost: "8만~25만원",
        aiSummary:
          "가속 중 떨림이나 실화 코드가 있으면 점화코일 노후와 커넥터 상태를 함께 확인해보세요.",
      },
      {
        title: "점화플러그 노후",
        symptoms: [
          "냉간 시동성 저하",
          "공회전 떨림 또는 연비 저하",
        ],
        relatedParts: ["점화플러그", "점화코일", "연소실"],
        importance: "하",
        estimatedRepairCost: "8만~18만원",
        aiSummary:
          "주행거리가 누적된 말리부는 점화플러그 교체 이력과 공회전 안정성을 확인하면 좋습니다.",
      },
      {
        title: "터보차저 계통 이상",
        symptoms: [
          "가속력 저하 또는 부스트 압력 부족",
          "터보 작동음, 흡기 라인 누설, 엔진 경고등",
        ],
        relatedParts: ["터보차저", "웨이스트게이트", "인터쿨러 호스", "부스트 센서"],
        importance: "상",
        estimatedRepairCost: "80만~180만원",
        aiSummary:
          "터보 모델은 가속 시 출력 저하, 부스트 누설, 터보 소음과 관련 정비 이력을 확인하는 것이 중요합니다.",
      },
      {
        title: "변속 충격",
        symptoms: [
          "저속 변속 시 울컥거림",
          "D/R 전환 충격 또는 지연",
        ],
        relatedParts: ["자동변속기", "미션오일", "밸브바디", "미션 마운트"],
        importance: "상",
        estimatedRepairCost: "20만~180만원",
        aiSummary:
          "시운전에서는 냉간과 열간 모두 D/R 전환 충격, 저속 변속감, 미션오일 관리 이력을 확인해보세요.",
      },
      {
        title: "AGM 배터리 방전",
        symptoms: [
          "시동 지연 또는 전압 저하 경고",
          "스탑앤고 기능 제한",
        ],
        relatedParts: ["AGM 배터리", "발전기", "배터리 센서"],
        importance: "중",
        estimatedRepairCost: "25만~45만원",
        aiSummary:
          "전장 장비가 많은 차량은 AGM 배터리 상태와 충전 전압을 확인해 방전 이력을 점검하는 것이 좋습니다.",
      },
      {
        title: "BCM 및 전장 오류",
        symptoms: [
          "간헐적 경고등 점등",
          "도어락, 조명, 편의장비 오작동",
        ],
        relatedParts: ["BCM", "배선 커넥터", "퓨즈박스", "접지부"],
        importance: "중",
        estimatedRepairCost: "20만~80만원",
        aiSummary:
          "간헐적 전장 오류는 진단기로 이력 코드를 확인하고 BCM, 접지, 커넥터 상태를 함께 봐야 합니다.",
      },
      {
        title: "디스플레이 먹통",
        symptoms: [
          "센터 디스플레이 꺼짐",
          "후방카메라 또는 터치 반응 불량",
        ],
        relatedParts: ["인포테인먼트 모니터", "헤드유닛", "후방카메라 배선"],
        importance: "중",
        estimatedRepairCost: "20만~120만원",
        aiSummary:
          "실내 점검 때 디스플레이 부팅, 터치, 후방카메라 전환이 정상인지 반드시 확인해보세요.",
      },
      {
        title: "로어암 부싱 마모",
        symptoms: [
          "방지턱 통과 시 둔탁한 소음",
          "제동 또는 조향 시 차체 흔들림",
        ],
        relatedParts: ["로어암", "로어암 부싱", "볼조인트"],
        importance: "중",
        estimatedRepairCost: "20만~60만원",
        aiSummary:
          "하체에서는 로어암 부싱 갈라짐, 유격, 방지턱 통과 소음을 중점적으로 봐주세요.",
      },
      {
        title: "스태빌라이저 링크 소음",
        symptoms: [
          "요철 통과 시 딸깍거림",
          "저속 조향 중 하체 잡소리",
        ],
        relatedParts: ["스태빌라이저 링크", "스태빌라이저 부싱"],
        importance: "하",
        estimatedRepairCost: "10만~25만원",
        aiSummary:
          "가벼운 하체 잡소리는 스태빌라이저 링크와 부싱 마모 여부를 점검해보세요.",
      },
      {
        title: "허브베어링 소음",
        symptoms: [
          "속도 증가에 따라 웅웅거리는 주행 소음",
          "코너링 시 특정 바퀴 쪽 소음 변화",
        ],
        relatedParts: ["허브베어링", "휠 허브", "타이어"],
        importance: "중",
        estimatedRepairCost: "15만~40만원",
        aiSummary:
          "주행 중 속도에 비례하는 소음이 있으면 타이어 편마모와 허브베어링 소음을 구분해서 확인해야 합니다.",
      },
      {
        title: "에어컨 컴프레서 불량",
        symptoms: [
          "냉방 성능 저하",
          "컴프레서 작동 시 이음 또는 간헐적 냉방",
        ],
        relatedParts: ["에어컨 컴프레서", "냉매 라인", "콘덴서", "압력 센서"],
        importance: "중",
        estimatedRepairCost: "50만~120만원",
        aiSummary:
          "냉방 성능과 컴프레서 작동음을 확인하고, 냉매 누설 정비 이력이 있는지도 함께 확인해보세요.",
      },
    ],
    yearNotes: [
      {
        minYear: 2016,
        maxYear: 2018,
        label: "2016~2018 초기형",
        summary: "초기형은 냉각계통 누수와 하체 소음 점검을 우선 권장합니다.",
      },
      {
        minYear: 2019,
        maxYear: 2023,
        label: "2019~2023 페이스리프트",
        summary: "페이스리프트 모델은 전반적인 완성도가 개선되었지만 기본 냉각계통과 전장 점검은 필요합니다.",
      },
    ],
    engineNotes: [
      {
        engine: "1.35 터보",
        summary: "연비가 우수한 편이며, 터보 계통과 냉각수 상태를 기본 점검 항목으로 두는 것이 좋습니다.",
      },
      {
        engine: "1.5 터보",
        summary: "거래량이 많은 엔진으로, 냉각계통 누수와 점화계통 정비 이력을 확인하는 것을 권장합니다.",
      },
      {
        engine: "2.0 터보",
        summary: "고성능 모델 특성상 터보차저, 변속기, 냉각계통 관리 상태가 구매 판단에 중요합니다.",
      },
    ],
  },
];

export const getVehicleInspectionProfile = (
  brand: string,
  model: string,
  generation?: string,
) =>
  vehicleInspectionProfiles.find(
    (profile) =>
      matchesText(brand, [profile.brand]) &&
      matchesProfileModel(profile, model) &&
      matchesProfileGeneration(profile, generation),
  );

export const getVehicleYearInspectionNotes = (
  profile: VehicleInspectionProfile,
  year: string,
) => {
  const yearNumber = Number(year);

  if (!Number.isFinite(yearNumber)) {
    return profile.yearNotes;
  }

  return profile.yearNotes.filter(
    (note) => yearNumber >= note.minYear && yearNumber <= note.maxYear,
  );
};
