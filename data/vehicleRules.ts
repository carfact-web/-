export interface ModelIssueRule {
  brand?: string;
  model?: string;
  models?: string[];
  message: string;
}

export interface YearCheckRule {
  minYear?: number;
  maxYear?: number;
  message: string;
}

export interface MileageCheckRule {
  minMileage: number;
  message: string;
}

export interface EvCheckRule {
  brand?: string;
  model?: string;
  models?: string[];
  message: string;
}

export const modelIssues: ModelIssueRule[] = [
  {
    brand: "현대",
    model: "쏘나타",
    message: "쏘나타는 세타/GDI 계열 엔진의 오일 감소, 엔진 소음, 누유 이력을 확인해보세요.",
  },
  {
    brand: "현대",
    model: "쏘나타",
    message: "쏘나타는 연식에 따라 MDPS 조향 소음과 하체 부싱, 쇼크업소버 상태 점검을 권장합니다.",
  },
  {
    brand: "현대",
    model: "쏘나타",
    message: "쏘나타는 변속 충격이나 저속 울컥거림 사례가 있어 시운전 확인이 중요합니다.",
  },
  {
    brand: "현대",
    model: "아반떼",
    message: "아반떼는 MDPS 조향 소음, 핸들 유격, 조향 모터 교체 이력을 확인해보세요.",
  },
  {
    brand: "현대",
    model: "아반떼",
    message: "아반떼는 GDI 엔진 오일 감소와 노킹, 냉간 시동 소음 사례를 점검하는 것이 좋습니다.",
  },
  {
    brand: "현대",
    model: "아반떼",
    message: "아반떼는 하체 잡소리, 등속조인트, 브레이크 떨림 여부를 시운전에서 확인해보세요.",
  },
  {
    brand: "현대",
    model: "그랜저",
    message: "그랜저는 엔진 오일 감소, 누유, 냉각수 누수 이력을 우선 확인해보세요.",
  },
  {
    brand: "현대",
    model: "그랜저",
    message: "그랜저는 전자식 파킹브레이크, 전동시트, 공조 장치 등 전장품 작동 상태를 확인하는 것이 좋습니다.",
  },
  {
    brand: "현대",
    model: "그랜저",
    message: "그랜저는 하체 부싱, 쇼크업소버, 브레이크 디스크 떨림 사례가 있어 소모품 정비 이력을 확인해보세요.",
  },
  {
    brand: "기아",
    model: "K5",
    message: "K5는 일부 엔진에서 오일 감소와 엔진 소음 사례가 있어 오일 관리 이력을 확인해보세요.",
  },
  {
    brand: "기아",
    model: "K5",
    message: "K5는 MDPS 조향 소음, 핸들 유격, 하체 잡소리 여부를 시운전에서 확인하는 것이 좋습니다.",
  },
  {
    brand: "기아",
    model: "K5",
    message: "K5는 변속 충격과 저속 울컥거림 사례가 있어 냉간/저속 주행 테스트를 권장합니다.",
  },
  {
    brand: "기아",
    model: "K8",
    message: "K8은 스마트스트림 2.5 계열의 엔진 오일 감소 이슈 언급이 있어 오일 소모량과 보증 정비 이력을 확인해보세요.",
  },
  {
    brand: "기아",
    model: "K8",
    message: "K8은 전자 장비가 많은 편이라 계기판, 공조, 시트, 주차 보조 장치 작동 상태를 꼼꼼히 확인해보세요.",
  },
  {
    brand: "기아",
    model: "K8",
    message: "K8 하이브리드는 저속 변속감, 회생제동 이질감, 배터리 관련 경고등 이력을 확인하는 것이 좋습니다.",
  },
  {
    brand: "기아",
    model: "스포티지",
    message: "스포티지는 디젤 모델의 EGR, DPF, 인젝터 관리 이력을 확인해보세요.",
  },
  {
    brand: "기아",
    model: "스포티지",
    message: "스포티지는 DCT 적용 모델에서 저속 울컥거림과 클러치 떨림 사례가 있어 시운전을 권장합니다.",
  },
  {
    brand: "기아",
    model: "스포티지",
    message: "스포티지는 하체 부싱, 쇼크업소버, 실내 잡소리 여부를 확인하는 것이 좋습니다.",
  },
  {
    brand: "기아",
    model: "쏘렌토",
    message: "쏘렌토는 디젤 모델의 EGR, DPF, 인젝터, 터보 관련 정비 이력을 확인해보세요.",
  },
  {
    brand: "기아",
    model: "쏘렌토",
    message: "쏘렌토는 DCT 또는 자동변속기 변속 충격, 저속 울컥거림 여부를 시운전에서 확인하는 것이 좋습니다.",
  },
  {
    brand: "기아",
    model: "쏘렌토",
    message: "쏘렌토 하이브리드는 냉각수 누수, 배터리 경고등, 회생제동 이질감 이력을 확인해보세요.",
  },
  {
    brand: "BMW",
    message: "BMW 계열 차량은 냉각계통 관리 여부를 확인해보세요.",
  },
];

export const defaultModelIssues: ModelIssueRule[] = [
  {
    brand: "현대",
    message: "현대차는 GDI/터보 엔진의 오일 소모, 냉각수 누수, 리콜 및 보증 정비 이력을 확인해보세요.",
  },
  {
    brand: "기아",
    message: "기아차는 엔진오일 관리 이력, MDPS 조향 소음, 변속 충격 여부를 시운전에서 확인해보세요.",
  },
  {
    brand: "제네시스",
    message: "제네시스는 전자제어 서스펜션, 전동시트, 공조, 주행 보조 장치 등 전장품 작동 상태를 꼼꼼히 확인해보세요.",
  },
  {
    brand: "BMW",
    message: "BMW는 누유, 냉각계통, 오일필터 하우징, 하체 부싱과 런플랫 타이어 마모 상태를 확인해보세요.",
  },
  {
    brand: "벤츠",
    message: "벤츠는 에어매틱 적용 여부, 냉각수 누수, 오일 누유, 전장 경고등 이력을 확인하는 것이 좋습니다.",
  },
  {
    brand: "쉐보레",
    message: "쉐보레는 미션 변속 충격, 냉각수 누수, 엔진 마운트와 하체 소음 여부를 확인해보세요.",
  },
  {
    brand: "르노",
    message: "르노는 CVT 변속감, 전자식 부품 경고등, 에어컨/공조 장치와 하체 잡소리를 확인해보세요.",
  },
  {
    brand: "쌍용",
    message: "쌍용은 디젤 인젝터, EGR/DPF, 4WD 작동 상태와 하체 부식 여부를 확인해보세요.",
  },
  {
    brand: "KG모빌리티",
    message: "KG모빌리티는 전장 경고등, 변속 충격, 하체 부싱과 보증 정비 이력을 확인하는 것이 좋습니다.",
  },
  {
    brand: "폭스바겐",
    message: "폭스바겐은 DSG 변속기 울컥거림, 워터펌프 누수, 타이밍 체인/벨트 정비 이력을 확인해보세요.",
  },
  {
    brand: "아우디",
    message: "아우디는 엔진오일 소모, 냉각수 누수, S트로닉 변속 충격, 콰트로 구동계 누유를 확인해보세요.",
  },
  {
    brand: "포르쉐",
    message: "포르쉐는 PDK 변속감, 냉각수 누수, 브레이크/타이어 소모품 비용과 누유 이력을 확인해보세요.",
  },
  {
    brand: "마세라티",
    message: "마세라티는 전자장비 경고등, 누유, 하체 부싱, 브레이크와 타이어 소모품 상태를 꼼꼼히 확인해보세요.",
  },
  {
    brand: "볼보",
    message: "볼보는 전장 경고등, 어댑티브 크루즈/파일럿 어시스트, 냉각수 누수와 하체 부싱 상태를 확인해보세요.",
  },
  {
    brand: "렉서스",
    message: "렉서스는 하이브리드 배터리 상태, 냉각계통, 하체 부싱과 정숙성 저하 여부를 확인해보세요.",
  },
  {
    brand: "랜드로버",
    message: "랜드로버는 에어서스펜션, 냉각수 누수, 전장 경고등, 터레인 리스폰스와 4WD 작동 상태를 확인해보세요.",
  },
  {
    brand: "미니",
    message: "미니는 엔진오일 누유, 냉각수 누수, 미션 충격, 하체 부싱과 실내 잡소리를 확인해보세요.",
  },
  {
    brand: "토요타",
    message: "토요타는 하이브리드 배터리 상태, 냉각수 펌프, 브레이크 부스터와 정비 이력을 확인해보세요.",
  },
  {
    brand: "혼다",
    message: "혼다는 CVT 변속감, 엔진 마운트, 에어컨 컴프레서, 하체 부싱 상태를 확인해보세요.",
  },
  {
    brand: "닛산",
    message: "닛산은 CVT 변속 충격과 소음, 냉각계통, 엔진 마운트, 전장 경고등 이력을 확인해보세요.",
  },
  {
    brand: "포드",
    message: "포드는 터보 엔진 누유, 미션 변속 충격, 냉각수 누수, 전장 경고등 이력을 확인해보세요.",
  },
  {
    brand: "지프",
    message: "지프는 4WD 로우기어 작동, 하체 부식, 누유, 냉각계통과 전장 경고등을 확인해보세요.",
  },
];

export const yearCheckRules: YearCheckRule[] = [
  {
    maxYear: 2015,
    message: "10년 전후 차량은 고무 호스, 엔진 마운트, 부싱류와 전장 배선 노후화를 확인해보세요.",
  },
  {
    maxYear: 2018,
    message: "연식이 있는 차량이라 누유 및 부식 점검이 중요합니다.",
  },
  {
    maxYear: 2020,
    message: "5년 이상 지난 차량은 타이어 생산연도, 배터리, 브레이크 소모품과 리콜 이력을 확인해보세요.",
  },
];

export const mileageCheckRules: MileageCheckRule[] = [
  {
    minMileage: 50000,
    message: "5만km 이상 차량은 타이어, 브레이크 패드/디스크, 배터리 교체 이력을 확인해보세요.",
  },
  {
    minMileage: 80000,
    message: "8만km 이상 차량은 변속기 오일, 냉각수, 점화계통 또는 디젤 흡기계통 정비 이력을 확인해보세요.",
  },
  {
    minMileage: 100000,
    message: "10만km 이상 차량이라 미션 상태 확인을 권장합니다.",
  },
  {
    minMileage: 150000,
    message: "하체 및 소모품 상태를 꼭 점검해보세요.",
  },
  {
    minMileage: 200000,
    message: "20만km 이상 차량은 엔진 압축, 터보/미션, 발전기, 하체 전체 정비 이력을 꼼꼼히 확인해보세요.",
  },
];

export const evCheckRules: EvCheckRule[] = [
  {
    models: [
      "GV60",
      "아이오닉5",
      "아이오닉6",
      "코나 일렉트릭",
      "i3",
      "i4",
      "iX3",
      "i5",
      "i7",
      "iX",
      "EQA",
      "EQB",
      "EQC",
      "EQE",
      "EQS",
      "볼트EV",
      "볼트EUV",
      "EV6",
      "EV9",
      "니로 EV",
      "모델3",
      "모델Y",
      "폴스타2",
      "폴스타4",
      "조에",
      "ID.4",
      "e-tron",
      "Q4 e-tron",
      "e-tron GT",
      "타이칸",
      "C40",
      "EX30",
      "리프",
    ],
    message: "전기차는 고전압 배터리 SOH, 잔여 보증, 급속충전 이력과 충전 포트 상태를 확인해보세요.",
  },
  {
    models: [
      "GV60",
      "아이오닉5",
      "아이오닉6",
      "코나 일렉트릭",
      "i3",
      "i4",
      "iX3",
      "i5",
      "i7",
      "iX",
      "EQA",
      "EQB",
      "EQC",
      "EQE",
      "EQS",
      "볼트EV",
      "볼트EUV",
      "EV6",
      "EV9",
      "니로 EV",
      "모델3",
      "모델Y",
      "폴스타2",
      "폴스타4",
      "조에",
      "ID.4",
      "e-tron",
      "Q4 e-tron",
      "e-tron GT",
      "타이칸",
      "C40",
      "EX30",
      "리프",
    ],
    message: "전기차는 구동모터 소음, 감속기 오일 누유, OBC/충전 관련 경고등 이력을 확인하는 것이 좋습니다.",
  },
];
