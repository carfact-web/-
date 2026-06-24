export interface VehicleIssueKeywordDefinition {
  label: string;
  aliases: string[];
  relatedParts: string[];
  inspectionTitle: string;
}

export const vehicleIssueKeywordDefinitions: VehicleIssueKeywordDefinition[] = [
  {
    label: "워터펌프",
    aliases: ["워터펌프", "워터 펌프"],
    relatedParts: ["워터펌프", "워터펌프 가스켓", "냉각수 라인"],
    inspectionTitle: "워터펌프 누수 확인",
  },
  {
    label: "냉각수",
    aliases: ["냉각수", "부동액"],
    relatedParts: ["냉각수", "냉각수 호스", "보조탱크"],
    inspectionTitle: "냉각수 누수 확인",
  },
  {
    label: "누수",
    aliases: ["누수", "물이 샘", "물샘"],
    relatedParts: ["냉각수 라인", "호스", "가스켓"],
    inspectionTitle: "누수 흔적 확인",
  },
  {
    label: "엔진오일",
    aliases: ["엔진오일", "엔진 오일", "오일 누유", "오일누유"],
    relatedParts: ["엔진오일", "오일팬", "가스켓"],
    inspectionTitle: "엔진오일 누유 확인",
  },
  {
    label: "미션충격",
    aliases: ["미션충격", "미션 충격", "변속충격", "변속 충격", "저속 울컥"],
    relatedParts: ["자동변속기", "미션오일", "밸브바디", "미션 마운트"],
    inspectionTitle: "변속 충격 확인",
  },
  {
    label: "변속충격",
    aliases: ["변속충격", "변속 충격", "기어 충격"],
    relatedParts: ["자동변속기", "미션오일", "밸브바디"],
    inspectionTitle: "변속 충격 확인",
  },
  {
    label: "하체소음",
    aliases: ["하체소음", "하체 소음", "하체잡소리", "하체 잡소리"],
    relatedParts: ["하체 부싱", "로어암", "스태빌라이저 링크"],
    inspectionTitle: "하체 소음 확인",
  },
  {
    label: "잡소리",
    aliases: ["잡소리", "잡 소리", "딸깍", "덜그럭"],
    relatedParts: ["하체 부싱", "내장재", "체결부"],
    inspectionTitle: "주행 중 잡소리 확인",
  },
  {
    label: "부싱",
    aliases: ["부싱", "부쉬"],
    relatedParts: ["로어암 부싱", "스태빌라이저 부싱"],
    inspectionTitle: "부싱 마모 확인",
  },
  {
    label: "점화코일",
    aliases: ["점화코일", "점화 코일"],
    relatedParts: ["점화코일", "점화 배선"],
    inspectionTitle: "점화코일 노후 확인",
  },
  {
    label: "점화플러그",
    aliases: ["점화플러그", "점화 플러그", "플러그"],
    relatedParts: ["점화플러그", "점화코일"],
    inspectionTitle: "점화플러그 노후 확인",
  },
  {
    label: "냉각팬",
    aliases: ["냉각팬", "냉각 팬", "라디에이터 팬"],
    relatedParts: ["냉각팬", "팬 모터", "팬 릴레이"],
    inspectionTitle: "냉각팬 작동 확인",
  },
  {
    label: "서모스탯",
    aliases: ["서모스탯", "써모스탯", " thermostat"],
    relatedParts: ["서모스탯", "서모스탯 하우징", "가스켓"],
    inspectionTitle: "서모스탯 하우징 누수 확인",
  },
  {
    label: "터보",
    aliases: ["터보", "터보차저", "부스트"],
    relatedParts: ["터보차저", "인터쿨러 호스", "부스트 센서"],
    inspectionTitle: "터보 계통 확인",
  },
  {
    label: "인젝터",
    aliases: ["인젝터", "연료분사"],
    relatedParts: ["인젝터", "연료 라인"],
    inspectionTitle: "인젝터 상태 확인",
  },
  {
    label: "DPF",
    aliases: ["dpf", "매연저감", "매연 저감"],
    relatedParts: ["DPF", "배기 라인", "차압 센서"],
    inspectionTitle: "DPF 상태 확인",
  },
  {
    label: "EGR",
    aliases: ["egr", "배기가스재순환"],
    relatedParts: ["EGR 밸브", "흡기 라인"],
    inspectionTitle: "EGR 작동 확인",
  },
  {
    label: "배터리",
    aliases: ["배터리", "방전", "전압"],
    relatedParts: ["배터리", "발전기", "배터리 센서"],
    inspectionTitle: "배터리 전압 확인",
  },
  {
    label: "에어컨",
    aliases: ["에어컨", "냉방", "컴프레서"],
    relatedParts: ["에어컨 컴프레서", "냉매 라인", "콘덴서"],
    inspectionTitle: "에어컨 냉방 확인",
  },
  {
    label: "히터",
    aliases: ["히터", "난방", "온풍"],
    relatedParts: ["히터 코어", "공조 장치"],
    inspectionTitle: "히터 작동 확인",
  },
  {
    label: "브레이크",
    aliases: ["브레이크", "제동", "패드", "디스크"],
    relatedParts: ["브레이크 패드", "디스크", "캘리퍼"],
    inspectionTitle: "브레이크 소모 상태 확인",
  },
  {
    label: "타이어",
    aliases: ["타이어", "편마모", "마모"],
    relatedParts: ["타이어", "휠 얼라인먼트"],
    inspectionTitle: "타이어 마모 확인",
  },
  {
    label: "쇼바",
    aliases: ["쇼바", "쇼크업소버", "쇼크 업소버"],
    relatedParts: ["쇼크업소버", "마운트"],
    inspectionTitle: "쇼바 누유 및 소음 확인",
  },
  {
    label: "로어암",
    aliases: ["로어암", "로워암", "로어 암"],
    relatedParts: ["로어암", "볼조인트", "부싱"],
    inspectionTitle: "로어암 부싱 확인",
  },
  {
    label: "등속조인트",
    aliases: ["등속조인트", "등속 조인트", "드라이브 샤프트"],
    relatedParts: ["등속조인트", "부트", "드라이브 샤프트"],
    inspectionTitle: "등속조인트 부트 확인",
  },
];

const normalizeKeywordText = (value: string) =>
  value.toLowerCase().replace(/[^0-9a-z가-힣]+/g, "");

export const normalizeVehicleIssueKeyword = normalizeKeywordText;

export const findVehicleIssueKeywordDefinition = (keyword: string) => {
  const normalizedKeyword = normalizeKeywordText(keyword);

  return vehicleIssueKeywordDefinitions.find(
    (definition) => normalizeKeywordText(definition.label) === normalizedKeyword,
  );
};

export const extractVehicleIssueKeywords = (content: string) => {
  const normalizedContent = normalizeKeywordText(content);

  if (!normalizedContent) {
    return [] as string[];
  }

  return vehicleIssueKeywordDefinitions
    .filter((definition) =>
      definition.aliases.some((alias) =>
        normalizedContent.includes(normalizeKeywordText(alias)),
      ),
    )
    .map((definition) => definition.label);
};

export const countVehicleIssueKeywordMentions = (
  content: string,
  keyword: string,
) => {
  const definition = findVehicleIssueKeywordDefinition(keyword);
  const aliases = definition?.aliases ?? [keyword];
  const normalizedContent = normalizeKeywordText(content);

  return aliases.reduce((count, alias) => {
    const normalizedAlias = normalizeKeywordText(alias);

    if (!normalizedAlias) {
      return count;
    }

    return count + normalizedContent.split(normalizedAlias).length - 1;
  }, 0);
};
