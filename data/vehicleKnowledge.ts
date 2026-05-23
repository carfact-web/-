export interface VehicleKnowledge {
  brand?: string;
  model?: string;
  models?: string[];
  generation?: string;
  fuelType?: string;
  transmission?: string;
  engineCode?: string;
  checkPoints: string[];
  warningMessage: string;
}

export const vehicleKnowledge: VehicleKnowledge[] = [
  {
    brand: "포르쉐",
    model: "타이칸",
    fuelType: "전기",
    transmission: "2단 전기차 변속기",
    checkPoints: [
      "타이칸은 일반 PDK가 아니라 후륜 2단 전기차 변속기 구조라 변속 충격, 경고등, 감속기 소음을 확인해보세요.",
      "고전압 배터리 SOH, 급속충전 이력, 배터리 냉각계통과 잔여 보증을 확인해보세요.",
    ],
    warningMessage: "타이칸을 PDK 차량처럼 판단하지 말고 전기 구동계와 2단 변속기 상태를 따로 점검하는 것이 좋습니다.",
  },
  {
    brand: "현대",
    models: ["쏘나타", "그랜저"],
    engineCode: "세타",
    checkPoints: [
      "현대 세타/GDI 계열은 엔진오일 감소, 냉간 소음, 노킹, 누유 여부를 확인해보세요.",
      "엔진 관련 리콜, 보증 연장, 쇼트엔진 교체 이력이 있는지 확인하는 것이 좋습니다.",
    ],
    warningMessage: "세타엔진 계열은 단순 소모품 관리뿐 아니라 리콜/보증 정비 이력 확인이 중요합니다.",
  },
  {
    brand: "기아",
    models: ["K5", "스포티지", "쏘렌토"],
    engineCode: "세타",
    checkPoints: [
      "기아 세타/GDI 계열은 엔진오일 감소, 엔진 소음, 노킹과 누유 이력을 확인해보세요.",
      "리콜 대상 여부, 보증 연장, 엔진 교체 또는 관련 정비 내역을 확인하는 것이 좋습니다.",
    ],
    warningMessage: "세타엔진 적용 가능 차량은 오일 관리 이력과 제조사 보증/리콜 이력을 함께 확인해야 합니다.",
  },
  {
    brand: "기아",
    model: "EV6",
    generation: "EV6 CV",
    fuelType: "전기",
    transmission: "전기차 구동계",
    checkPoints: [
      "EV6 CV는 히터/PTC/공조 계통이 정상 작동하는지 점검을 권장합니다.",
      "EV6 CV는 ICCU 관련 점검 또는 정비 이력이 있는지 확인을 권장합니다.",
      "EV6 CV는 가능하다면 고전압 배터리 SOH 확인을 권장합니다.",
      "EV6 CV는 급속충전 비율과 충전 이력 확인을 권장합니다.",
    ],
    warningMessage: "EV6 CV는 배터리 상태뿐 아니라 히터/PTC/공조 및 ICCU 관련 이력까지 함께 점검하는 것을 권장합니다.",
  },
];
