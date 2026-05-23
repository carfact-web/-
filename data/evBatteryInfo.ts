export interface EvBatteryInfo {
  brand: string;
  model: string;
  generation?: string;
  batterySuppliers: string[];
  batteryType: string;
  notes: string[];
}

export const evBatteryInfo: EvBatteryInfo[] = [
  {
    brand: "현대",
    model: "아이오닉5",
    batterySuppliers: ["SK온 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/트림에 따라 배터리 사양이 다를 수 있어 제조사와 셀 타입 확인을 권장합니다.",
      "배터리 SOH, 급속충전 비율, ICCU 관련 점검 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "현대",
    model: "아이오닉6",
    batterySuppliers: ["SK온 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/트림에 따라 배터리 사양이 다를 수 있어 출고 사양 확인을 권장합니다.",
      "배터리 SOH, 급속충전 비율, 충전 오류 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "기아",
    model: "EV6",
    generation: "EV6 CV",
    batterySuppliers: ["SK온 등"],
    batteryType: "NCM 계열",
    notes: [
      "트림/연식에 따라 배터리 사양이 다를 수 있어 제조사와 셀 타입 확인을 권장합니다.",
      "배터리 SOH, 급속충전 비율, ICCU 관련 점검 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "기아",
    model: "EV9",
    batterySuppliers: ["SK온 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/트림에 따라 배터리 사양이 다를 수 있어 출고 사양 확인을 권장합니다.",
      "대용량 배터리 차량이라 SOH, 급속충전 이력, 충전 포트 상태 확인을 권장합니다.",
    ],
  },
  {
    brand: "현대",
    model: "코나 일렉트릭",
    batterySuppliers: ["LG에너지솔루션", "CATL 등"],
    batteryType: "NCM 또는 LFP 계열",
    notes: [
      "세대/연식에 따라 배터리 제조사와 셀 타입이 다를 수 있어 확인을 권장합니다.",
      "배터리 리콜/보증 이력, SOH, 충전 오류 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "기아",
    model: "니로 EV",
    batterySuppliers: ["SK온", "CATL 등"],
    batteryType: "NCM 또는 LFP 계열",
    notes: [
      "연식/트림에 따라 배터리 제조사와 셀 타입이 다를 수 있어 확인을 권장합니다.",
      "SOH, 급속충전 비율, 감속기 소음과 충전 계통 경고 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "테슬라",
    model: "모델3",
    batterySuppliers: ["파나소닉", "LG에너지솔루션", "CATL"],
    batteryType: "NCA, NCM 또는 LFP 계열",
    notes: [
      "트림/연식/생산지에 따라 배터리 제조사와 셀 타입이 달라 확인을 권장합니다.",
      "LFP 적용 차량은 충전 습관과 BMS 보정 이력, 장거리 모델은 SOH 확인을 권장합니다.",
    ],
  },
  {
    brand: "테슬라",
    model: "모델Y",
    batterySuppliers: ["파나소닉", "LG에너지솔루션", "CATL"],
    batteryType: "NCA, NCM 또는 LFP 계열",
    notes: [
      "트림/연식/생산지에 따라 배터리 제조사와 셀 타입이 달라 확인을 권장합니다.",
      "SOH, 급속충전 비율, 충전 포트와 열관리 계통 이상 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "폴스타",
    model: "폴스타2",
    batterySuppliers: ["LG에너지솔루션", "CATL 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/트림에 따라 배터리 사양이 다를 수 있어 제조사와 셀 타입 확인을 권장합니다.",
      "SOH, 급속충전 이력, 구동계 경고등과 OTA 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "폴스타",
    model: "폴스타4",
    batterySuppliers: ["CATL 등"],
    batteryType: "NCM 계열",
    notes: [
      "초기 유통 차량은 사양 차이가 있을 수 있어 배터리 제조사와 셀 타입 확인을 권장합니다.",
      "SOH, 급속충전 이력, 열관리 계통과 소프트웨어 업데이트 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "포르쉐",
    model: "타이칸",
    batterySuppliers: ["LG에너지솔루션 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/트림에 따라 배터리 사양이 다를 수 있어 배터리 옵션과 보증 확인을 권장합니다.",
      "SOH, 급속충전 비율, 배터리 냉각계통과 2단 변속기 관련 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "벤츠",
    model: "EQA",
    batterySuppliers: ["CATL", "SK온 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/생산지에 따라 배터리 제조사가 다를 수 있어 확인을 권장합니다.",
      "SOH, 급속충전 이력, 충전 계통 경고등 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "벤츠",
    model: "EQB",
    batterySuppliers: ["CATL", "SK온 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/생산지에 따라 배터리 제조사가 다를 수 있어 확인을 권장합니다.",
      "SOH, 급속충전 이력, 7인승 사용 차량의 하체/타이어 마모 확인을 권장합니다.",
    ],
  },
  {
    brand: "벤츠",
    model: "EQE",
    batterySuppliers: ["CATL", "Farasis 등"],
    batteryType: "NCM 계열",
    notes: [
      "트림/연식에 따라 배터리 제조사가 다를 수 있어 확인을 권장합니다.",
      "SOH, 급속충전 비율, 에어컨/히트펌프와 충전 계통 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "벤츠",
    model: "EQS",
    batterySuppliers: ["CATL", "Farasis 등"],
    batteryType: "NCM 계열",
    notes: [
      "트림/연식에 따라 배터리 제조사가 다를 수 있어 확인을 권장합니다.",
      "대용량 배터리 차량이라 SOH, 급속충전 이력, 열관리 계통 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "BMW",
    model: "i4",
    batterySuppliers: ["삼성SDI", "CATL 등"],
    batteryType: "NCM 계열",
    notes: [
      "연식/생산지에 따라 배터리 제조사가 다를 수 있어 확인을 권장합니다.",
      "SOH, 급속충전 비율, 충전 포트와 냉각계통 이상 이력 확인을 권장합니다.",
    ],
  },
  {
    brand: "BMW",
    model: "iX3",
    batterySuppliers: ["CATL 등"],
    batteryType: "NCM 계열",
    notes: [
      "생산지/연식에 따라 배터리 사양이 다를 수 있어 제조사와 셀 타입 확인을 권장합니다.",
      "SOH, 급속충전 이력, 구동모터와 감속기 소음 확인을 권장합니다.",
    ],
  },
];
