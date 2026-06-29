export interface VehicleIssueKeywordDefinition {
  label: string;
  groupLabel?: string;
  aliases: string[];
  relatedParts: string[];
  inspectionTitle: string;
}

export const vehicleIssueKeywordDefinitions: VehicleIssueKeywordDefinition[] = [
  {
    label: "엔진",
    groupLabel: "엔진",
    aliases: [
      "엔진소음",
      "엔진 소음",
      "엔진잡소리",
      "엔진 잡소리",
      "엔진떨림",
      "엔진 떨림",
      "진동",
      "부조",
      "엔진부조",
      "엔진 부조",
      "출력저하",
      "출력 저하",
      "시동불량",
      "시동 불량",
      "시동꺼짐",
      "시동 꺼짐",
      "엔진경고등",
      "엔진 경고등",
      "체크등",
      "체크엔진",
      "오일감소",
      "엔진오일감소",
      "엔진오일 감소",
      "오일먹음",
      "오일 소모",
    ],
    relatedParts: ["엔진", "점화계통", "흡기계통", "엔진오일"],
    inspectionTitle: "엔진 상태 확인",
  },
  {
    label: "스커핑",
    groupLabel: "스커핑",
    aliases: [
      "스커핑",
      "엔진스커핑",
      "엔진 스커핑",
      "실린더스커핑",
      "실린더 스커핑",
      "피스톤스커핑",
      "피스톤 스커핑",
      "보어스커핑",
      "보어 스커핑",
      "스크래치",
      "실린더스크래치",
      "실린더 스크래치",
    ],
    relatedParts: ["실린더", "피스톤", "보어"],
    inspectionTitle: "스커핑 상태 확인",
  },
  {
    label: "헤드/실린더",
    groupLabel: "헤드/실린더",
    aliases: [
      "헤드",
      "실린더",
      "헤드실린더",
      "헤드 실린더",
      "실린더헤드",
      "실린더 헤드",
      "헤드 실린더 이음",
      "헤드실린더이음",
      "실린더 이음",
      "실린더이음",
      "헤드 이음",
      "헤드이음",
      "압축압력",
      "압축 압력",
      "압축불량",
      "압축 불량",
    ],
    relatedParts: ["헤드", "실린더", "압축압력"],
    inspectionTitle: "헤드/실린더 상태 확인",
  },
  {
    label: "미션",
    groupLabel: "미션",
    aliases: [
      "미션",
      "변속기",
      "변속충격",
      "변속 충격",
      "미션충격",
      "미션 충격",
      "변속지연",
      "변속 지연",
      "슬립",
      "미션슬립",
      "미션 슬립",
      "클러치",
      "듀얼클러치",
      "dct",
      "토크컨버터",
      "밸브바디",
      "미션오일",
      "미션오일누유",
      "변속불량",
      "저속 울컥",
      "기어 충격",
    ],
    relatedParts: ["변속기", "미션오일", "밸브바디", "토크컨버터", "클러치"],
    inspectionTitle: "미션/변속기 상태 확인",
  },
  {
    label: "냉각계통",
    groupLabel: "냉각계통",
    aliases: [
      "냉각수",
      "부동액",
      "냉각수누수",
      "냉각수 누수",
      "냉각수감소",
      "냉각수 감소",
      "워터펌프",
      "워터 펌프",
      "써모스탯",
      "서모스탯",
      "thermostat",
      "라디에이터",
      "냉각팬",
      "냉각 팬",
      "팬모터",
      "팬 모터",
      "오버히트",
      "과열",
      "리저브탱크",
      "리저브 탱크",
      "보조탱크",
      "보조 탱크",
      "냉각수호스",
      "냉각수 호스",
    ],
    relatedParts: ["냉각수", "워터펌프", "서모스탯", "라디에이터", "냉각팬"],
    inspectionTitle: "냉각계통 상태 확인",
  },
  {
    label: "누유",
    groupLabel: "누유",
    aliases: [
      "누유",
      "오일누유",
      "오일 누유",
      "미세누유",
      "미세 누유",
      "엔진오일누유",
      "엔진오일 누유",
      "미션오일누유",
      "미션오일 누유",
      "로커암누유",
      "로커암 누유",
      "로커암커버누유",
      "로커암커버 누유",
      "로커암 커버 누유",
      "파워오일누유",
      "파워오일 누유",
      "브레이크오일",
      "브레이크 오일",
      "오일팬",
      "가스켓",
      "헤드가스켓",
      "헤드 가스켓",
      "밸브커버가스켓",
      "밸브커버 가스켓",
      "리데나",
      "씰",
      "오일씰",
      "오일 씰",
    ],
    relatedParts: ["엔진오일", "오일팬", "가스켓", "리데나", "오일씰"],
    inspectionTitle: "누유 상태 확인",
  },
  {
    label: "누수",
    groupLabel: "누수",
    aliases: [
      "누수",
      "미세누수",
      "미세 누수",
      "트렁크누수",
      "트렁크 누수",
      "실내누수",
      "실내 누수",
      "물샘",
      "물이 샘",
      "물유입",
      "물 유입",
    ],
    relatedParts: ["트렁크", "실내", "차체 실링", "웨더스트립"],
    inspectionTitle: "누수 상태 확인",
  },
  {
    label: "하체",
    groupLabel: "하체",
    aliases: [
      "하체",
      "언더바디",
      "하체소음",
      "하체 소음",
      "하체잡소리",
      "하체 잡소리",
      "잡소리",
      "잡 소리",
      "찌그덕",
      "덜그럭",
      "뚝뚝",
      "딸깍",
      "소음",
      "쇼바",
      "쇽업쇼버",
      "쇼크업소버",
      "쇼크 업소버",
      "서스펜션",
      "로어암",
      "로워암",
      "로어 암",
      "어퍼암",
      "어퍼 암",
      "활대링크",
      "활대 링크",
      "스테빌라이저",
      "스태빌라이저",
      "부싱",
      "부쉬",
      "허브베어링",
      "허브 베어링",
      "베어링",
      "등속조인트",
      "등속 조인트",
      "조인트",
      "드라이브 샤프트",
      "타이로드",
      "엔드볼",
      "조향",
      "핸들떨림",
      "핸들 떨림",
      "휠얼라인먼트",
      "휠 얼라인먼트",
      "얼라이먼트",
    ],
    relatedParts: ["하체", "쇼크업소버", "로어암", "부싱", "허브베어링", "등속조인트"],
    inspectionTitle: "하체/조향 상태 확인",
  },
  {
    label: "브레이크",
    groupLabel: "브레이크",
    aliases: [
      "브레이크",
      "제동",
      "브레이크패드",
      "브레이크 패드",
      "패드",
      "디스크",
      "디스크로터",
      "디스크 로터",
      "로터",
      "캘리퍼",
      "브레이크소음",
      "브레이크 소음",
      "밀림",
      "라이닝",
      "브레이크라이닝",
      "브레이크 라이닝",
    ],
    relatedParts: ["브레이크 패드", "디스크", "로터", "캘리퍼", "라이닝"],
    inspectionTitle: "브레이크 상태 확인",
  },
  {
    label: "전장",
    groupLabel: "전장",
    aliases: [
      "배터리",
      "agm",
      "제네레이터",
      "알터네이터",
      "발전기",
      "스타트모터",
      "스타트 모터",
      "시동모터",
      "시동 모터",
      "센서",
      "산소센서",
      "산소 센서",
      "맵센서",
      "맵 센서",
      "크랭크각센서",
      "크랭크각 센서",
      "캠각센서",
      "캠각 센서",
      "ecu",
      "bcm",
      "전장",
      "전장오류",
      "전장 오류",
      "경고등",
      "계기판",
      "디스플레이",
      "후방카메라",
      "후방 카메라",
      "카메라",
      "네비",
      "내비",
      "터치불량",
      "터치 불량",
      "방전",
      "전압",
    ],
    relatedParts: ["배터리", "발전기", "스타트모터", "센서", "ECU", "BCM"],
    inspectionTitle: "전기/전자장비 상태 확인",
  },
  {
    label: "DPF",
    aliases: ["dpf", "cpf", "매연저감", "매연 저감"],
    relatedParts: ["DPF", "차압 센서", "배기 라인"],
    inspectionTitle: "DPF 상태 확인",
  },
  {
    label: "SCR",
    aliases: ["scr", "요소수", "adblue", "애드블루"],
    relatedParts: ["SCR", "요소수/SCR", "요소수 탱크"],
    inspectionTitle: "SCR 상태 확인",
  },
  {
    label: "터보",
    aliases: ["터보", "터빈", "터보차저", "부스트"],
    relatedParts: ["터보차저", "인터쿨러 호스", "부스트 센서"],
    inspectionTitle: "터보 상태 확인",
  },
  {
    label: "인젝터",
    aliases: ["인젝터"],
    relatedParts: ["인젝터", "연료 라인"],
    inspectionTitle: "인젝터 상태 확인",
  },
  {
    label: "고압펌프",
    aliases: ["고압펌프", "고압 펌프"],
    relatedParts: ["고압펌프", "연료 라인"],
    inspectionTitle: "고압펌프 상태 확인",
  },
  {
    label: "EGR",
    aliases: ["egr", "배기가스재순환"],
    relatedParts: ["EGR 밸브", "흡기 라인"],
    inspectionTitle: "EGR 상태 확인",
  },
  {
    label: "흡기",
    aliases: ["흡기", "흡기계통", "흡기 계통", "흡기클리닝", "흡기 클리닝", "카본"],
    relatedParts: ["흡기 라인", "스로틀바디", "흡기 매니폴드"],
    inspectionTitle: "흡기 상태 확인",
  },
  {
    label: "매연",
    aliases: ["매연"],
    relatedParts: ["배기 라인", "DPF", "EGR"],
    inspectionTitle: "매연 상태 확인",
  },
  {
    label: "촉매",
    aliases: ["촉매"],
    relatedParts: ["촉매", "배기 라인"],
    inspectionTitle: "촉매 상태 확인",
  },
  {
    label: "판스프링",
    groupLabel: "판스프링",
    aliases: [
      "판스프링",
      "판 스프링",
      "판스프링파손",
      "판스프링 파손",
      "판 스프링 파손",
      "판스프링부식",
      "판스프링 부식",
      "판 스프링 부식",
      "판스프링깨짐",
      "판스프링 깨짐",
      "판스프링교환",
      "판스프링 교환",
      "판스프링수리",
      "판스프링 수리",
      "스프링부러짐",
      "스프링 부러짐",
    ],
    relatedParts: ["판스프링", "하부", "프레임"],
    inspectionTitle: "판스프링 상태 확인",
  },
  {
    label: "적재함",
    aliases: ["적재함", "적재함부식", "적재함 부식"],
    relatedParts: ["적재함", "차체"],
    inspectionTitle: "적재함 상태 확인",
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
    aliases: ["리프트", "리프트게이트", "리프트 게이트"],
    relatedParts: ["리프트", "유압 장치"],
    inspectionTitle: "리프트 작동 확인",
  },
  {
    label: "프레임부식",
    aliases: ["하부부식", "하부 부식", "프레임부식", "프레임 부식"],
    relatedParts: ["하부", "프레임"],
    inspectionTitle: "프레임/하부 부식 확인",
  },
  {
    label: "데후",
    aliases: [
      "데후",
      "디퍼렌셜",
      "차동기어",
    ],
    relatedParts: ["디퍼렌셜", "구동계"],
    inspectionTitle: "디퍼렌셜 상태 확인",
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
    label: "타이어",
    aliases: ["타이어", "편마모", "마모"],
    relatedParts: ["타이어", "휠 얼라인먼트"],
    inspectionTitle: "타이어 마모 확인",
  },
  {
    label: "냄새",
    groupLabel: "냄새",
    aliases: [
      "냄새",
      "흡연",
      "담배",
      "담배냄새",
      "담배 냄새",
      "실내냄새",
      "실내 냄새",
      "악취",
      "곰팡이냄새",
      "곰팡이 냄새",
      "퀴퀴한냄새",
      "퀴퀴한 냄새",
      "역한냄새",
      "역한 냄새",
      "찌든냄새",
      "찌든 냄새",
      "방향제냄새",
      "방향제 냄새",
      "탈취",
    ],
    relatedParts: ["실내", "공조 장치", "시트"],
    inspectionTitle: "실내 냄새 확인",
  },
  {
    label: "외관/사고",
    groupLabel: "외관/사고",
    aliases: [
      "외판",
      "판금",
      "도색",
      "교환",
      "단순교환",
      "단순 교환",
      "사고",
      "보험이력",
      "보험 이력",
      "부식",
      "녹",
      "침수",
    ],
    relatedParts: ["외판", "도장면", "프레임", "사고 이력"],
    inspectionTitle: "외관/사고 이력 확인",
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

interface MatchedVehicleIssueKeyword {
  label: string;
  aliases: string[];
}

const getMatchedVehicleIssueKeywords = (
  content: string,
): MatchedVehicleIssueKeyword[] => {
  const normalizedContent = normalizeKeywordText(content);

  if (!normalizedContent) {
    return [];
  }

  const matchedDefinitions = getGroupedVehicleIssueKeywordDefinitions()
    .map((definition) => {
      const aliases = definition.aliases.filter((alias) => {
        const normalizedAlias = normalizeKeywordText(alias);

        return (
          normalizedAlias.length > 0 &&
          normalizedContent.includes(normalizedAlias)
        );
      });

      return {
        label: definition.label,
        aliases,
      };
    })
    .filter((definition) => definition.aliases.length > 0);

  return matchedDefinitions.filter((definition) =>
    definition.aliases.some((alias) => {
      const normalizedAlias = normalizeKeywordText(alias);

      return !matchedDefinitions.some(
        (otherDefinition) =>
          otherDefinition.label !== definition.label &&
          otherDefinition.aliases.some((otherAlias) => {
            const normalizedOtherAlias = normalizeKeywordText(otherAlias);

            return (
              normalizedOtherAlias.length > normalizedAlias.length &&
              normalizedOtherAlias.includes(normalizedAlias)
            );
          }),
      );
    }),
  );
};

export const extractVehicleIssueKeywords = (content: string) => {
  const matchedKeywords = getMatchedVehicleIssueKeywords(content).map(
    (definition) => definition.label,
  );

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
