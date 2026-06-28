export interface VehicleIssueKeywordDefinition {
  label: string;
  groupLabel?: string;
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
    label: "하체",
    aliases: ["하체", "언더바디"],
    relatedParts: ["하체 부싱", "로어암", "스태빌라이저 링크", "쇼크업소버"],
    inspectionTitle: "하체 상태 확인",
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
    groupLabel: "터보",
    aliases: ["터보", "터빈", "터보차저", "부스트"],
    relatedParts: ["터보차저", "인터쿨러 호스", "부스트 센서"],
    inspectionTitle: "터보 계통 확인",
  },
  {
    label: "인젝터",
    groupLabel: "인젝터/연료계",
    aliases: ["인젝터", "연료분사", "고압펌프", "연료펌프"],
    relatedParts: ["인젝터", "고압펌프", "연료펌프", "연료 라인"],
    inspectionTitle: "인젝터/연료계 상태 확인",
  },
  {
    label: "DPF",
    groupLabel: "DPF/SCR",
    aliases: ["dpf", "매연저감", "매연 저감"],
    relatedParts: ["DPF", "배기 라인", "차압 센서"],
    inspectionTitle: "DPF/SCR 상태 확인",
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
  {
    label: "판스프링",
    groupLabel: "판스프링/하부",
    aliases: ["판스프링", "판 스프링"],
    relatedParts: ["판스프링", "하부", "프레임"],
    inspectionTitle: "판스프링/하부 상태 확인",
  },
  {
    label: "판스프링 파손",
    groupLabel: "판스프링/하부",
    aliases: ["판스프링파손", "판스프링 파손", "판 스프링 파손"],
    relatedParts: ["판스프링", "하부", "프레임"],
    inspectionTitle: "판스프링 파손 확인",
  },
  {
    label: "판스프링 부식",
    groupLabel: "판스프링/하부",
    aliases: ["판스프링부식", "판스프링 부식", "판 스프링 부식"],
    relatedParts: ["판스프링", "하부", "프레임"],
    inspectionTitle: "판스프링 부식 확인",
  },
  {
    label: "하부부식",
    groupLabel: "판스프링/하부",
    aliases: ["하부부식", "하부 부식"],
    relatedParts: ["하부", "프레임"],
    inspectionTitle: "하부부식 확인",
  },
  {
    label: "프레임부식",
    groupLabel: "판스프링/하부",
    aliases: ["프레임부식", "프레임 부식"],
    relatedParts: ["프레임", "하부"],
    inspectionTitle: "프레임부식 확인",
  },
  {
    label: "적재함",
    aliases: ["적재함"],
    relatedParts: ["적재함", "차체"],
    inspectionTitle: "적재함 상태 확인",
  },
  {
    label: "적재함 부식",
    aliases: ["적재함부식", "적재함 부식"],
    relatedParts: ["적재함", "차체"],
    inspectionTitle: "적재함 부식 확인",
  },
  {
    label: "탑차",
    aliases: ["탑차"],
    relatedParts: ["탑", "차체"],
    inspectionTitle: "탑차 구조물 확인",
  },
  {
    label: "냉동탑",
    aliases: ["냉동탑", "냉동 탑"],
    relatedParts: ["냉동탑", "냉동기"],
    inspectionTitle: "냉동탑 작동 확인",
  },
  {
    label: "윙바디",
    aliases: ["윙바디", "윙 바디"],
    relatedParts: ["윙바디", "도어", "유압 장치"],
    inspectionTitle: "윙바디 작동 확인",
  },
  {
    label: "리프트",
    aliases: ["리프트"],
    relatedParts: ["리프트", "유압 장치"],
    inspectionTitle: "리프트 작동 확인",
  },
  {
    label: "리프트게이트",
    aliases: ["리프트게이트", "리프트 게이트"],
    relatedParts: ["리프트게이트", "유압 장치"],
    inspectionTitle: "리프트게이트 작동 확인",
  },
  {
    label: "데후",
    aliases: ["데후"],
    relatedParts: ["디퍼렌셜", "구동계"],
    inspectionTitle: "디퍼렌셜 상태 확인",
  },
  {
    label: "디퍼렌셜",
    aliases: ["디퍼렌셜", "차동기어"],
    relatedParts: ["디퍼렌셜", "구동계"],
    inspectionTitle: "디퍼렌셜 상태 확인",
  },
  {
    label: "허브베어링",
    aliases: ["허브베어링", "허브 베어링"],
    relatedParts: ["허브베어링", "휠 허브"],
    inspectionTitle: "허브베어링 상태 확인",
  },
  {
    label: "라이닝",
    aliases: ["라이닝"],
    relatedParts: ["브레이크 라이닝", "드럼 브레이크"],
    inspectionTitle: "브레이크 라이닝 확인",
  },
  {
    label: "브레이크 라이닝",
    aliases: ["브레이크라이닝", "브레이크 라이닝"],
    relatedParts: ["브레이크 라이닝", "드럼 브레이크"],
    inspectionTitle: "브레이크 라이닝 확인",
  },
  {
    label: "클러치",
    aliases: ["클러치"],
    relatedParts: ["클러치", "변속기"],
    inspectionTitle: "클러치 상태 확인",
  },
  {
    label: "미션오일",
    aliases: ["미션오일", "미션 오일", "변속기오일", "변속기 오일"],
    relatedParts: ["미션오일", "변속기"],
    inspectionTitle: "미션오일 상태 확인",
  },
  {
    label: "촉매",
    groupLabel: "DPF/SCR",
    aliases: ["촉매"],
    relatedParts: ["촉매", "배기 라인"],
    inspectionTitle: "촉매 상태 확인",
  },
  {
    label: "요소수",
    groupLabel: "DPF/SCR",
    aliases: ["요소수", "애드블루", "adblue"],
    relatedParts: ["요소수/SCR", "요소수 탱크", "SCR"],
    inspectionTitle: "요소수/SCR 상태 확인",
  },
  {
    label: "SCR",
    groupLabel: "DPF/SCR",
    aliases: ["scr", "선택적환원촉매", "선택적 환원 촉매"],
    relatedParts: ["요소수/SCR", "SCR", "배기 라인"],
    inspectionTitle: "요소수/SCR 상태 확인",
  },
  {
    label: "냄새",
    groupLabel: "냄새",
    aliases: ["냄새"],
    relatedParts: ["실내", "공조 장치"],
    inspectionTitle: "실내 냄새 확인",
  },
  {
    label: "흡연",
    groupLabel: "냄새",
    aliases: ["흡연"],
    relatedParts: ["실내", "시트", "천장 내장재"],
    inspectionTitle: "흡연 흔적 확인",
  },
  {
    label: "담배",
    groupLabel: "냄새",
    aliases: ["담배"],
    relatedParts: ["실내", "시트", "천장 내장재"],
    inspectionTitle: "담배 흔적 확인",
  },
  {
    label: "담배냄새",
    groupLabel: "냄새",
    aliases: ["담배냄새", "담배 냄새"],
    relatedParts: ["실내", "시트", "천장 내장재"],
    inspectionTitle: "담배냄새 확인",
  },
  {
    label: "실내냄새",
    groupLabel: "냄새",
    aliases: ["실내냄새", "실내 냄새"],
    relatedParts: ["실내", "공조 장치", "시트"],
    inspectionTitle: "실내냄새 확인",
  },
  {
    label: "악취",
    groupLabel: "냄새",
    aliases: ["악취"],
    relatedParts: ["실내", "공조 장치"],
    inspectionTitle: "실내 악취 확인",
  },
  {
    label: "곰팡이냄새",
    groupLabel: "냄새",
    aliases: ["곰팡이냄새", "곰팡이 냄새"],
    relatedParts: ["실내", "공조 장치", "카펫"],
    inspectionTitle: "곰팡이냄새 확인",
  },
  {
    label: "퀴퀴한냄새",
    groupLabel: "냄새",
    aliases: ["퀴퀴한냄새", "퀴퀴한 냄새"],
    relatedParts: ["실내", "공조 장치", "시트"],
    inspectionTitle: "퀴퀴한냄새 확인",
  },
  {
    label: "역한냄새",
    groupLabel: "냄새",
    aliases: ["역한냄새", "역한 냄새"],
    relatedParts: ["실내", "공조 장치"],
    inspectionTitle: "역한냄새 확인",
  },
  {
    label: "찌든냄새",
    groupLabel: "냄새",
    aliases: ["찌든냄새", "찌든 냄새"],
    relatedParts: ["실내", "시트", "천장 내장재"],
    inspectionTitle: "찌든냄새 확인",
  },
  {
    label: "방향제냄새",
    groupLabel: "냄새",
    aliases: ["방향제냄새", "방향제 냄새"],
    relatedParts: ["실내", "공조 장치"],
    inspectionTitle: "방향제냄새 확인",
  },
  {
    label: "탈취",
    groupLabel: "냄새",
    aliases: ["탈취"],
    relatedParts: ["실내", "공조 장치", "시트"],
    inspectionTitle: "탈취 흔적 확인",
  },
];

const normalizeKeywordText = (value: string) =>
  value.toLowerCase().replace(/[^0-9a-z가-힣]+/g, "");

export const normalizeVehicleIssueKeyword = normalizeKeywordText;

export const getVehicleIssueKeywordGroupLabel = (
  definition: VehicleIssueKeywordDefinition,
) => definition.groupLabel ?? definition.label;

export const getGroupedVehicleIssueKeywordDefinitions = () => {
  const groupedDefinitions = new Map<string, VehicleIssueKeywordDefinition>();

  vehicleIssueKeywordDefinitions.forEach((definition) => {
    const groupLabel = getVehicleIssueKeywordGroupLabel(definition);
    const group = groupedDefinitions.get(groupLabel);

    if (!group) {
      groupedDefinitions.set(groupLabel, {
        ...definition,
        label: groupLabel,
        groupLabel,
        aliases: [...definition.aliases],
      });
      return;
    }

    const nextAliases = [...group.aliases, definition.label, ...definition.aliases];

    group.aliases = Array.from(new Set(nextAliases));
    group.relatedParts = Array.from(
      new Set([...group.relatedParts, ...definition.relatedParts]),
    );
  });

  return Array.from(groupedDefinitions.values());
};

export const findVehicleIssueKeywordDefinition = (keyword: string) => {
  const normalizedKeyword = normalizeKeywordText(keyword);

  return getGroupedVehicleIssueKeywordDefinitions().find(
    (definition) =>
      normalizeKeywordText(definition.label) === normalizedKeyword ||
      definition.aliases.some(
        (alias) => normalizeKeywordText(alias) === normalizedKeyword,
      ),
  );
};

export const extractVehicleIssueKeywords = (content: string) => {
  const normalizedContent = normalizeKeywordText(content);

  if (!normalizedContent) {
    return [] as string[];
  }

  const matchedKeywords = getGroupedVehicleIssueKeywordDefinitions()
    .filter((definition) =>
      definition.aliases.some((alias) =>
        normalizedContent.includes(normalizeKeywordText(alias)),
      ),
    )
    .map((definition) => definition.label);

  return Array.from(new Set(matchedKeywords));
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
