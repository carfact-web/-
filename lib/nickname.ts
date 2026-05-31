const nicknameAdjectives = [
  "슬퍼하는",
  "달리는",
  "조용한",
  "빛나는",
  "빠른",
  "수상한",
  "차분한",
  "웃는",
  "푸른",
  "든든한",
  "느긋한",
  "반짝이는",
] as const;

const nicknameNouns = [
  "자몽",
  "고라니",
  "엔진",
  "핸들",
  "부엉이",
  "타이어",
  "라디에이터",
  "브레이크",
  "계기판",
  "스포일러",
  "라이트",
  "범퍼",
] as const;

const randomItem = <T>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

const randomNumericSuffix = () => String(Math.floor(Math.random() * 900) + 100);

export const createRandomNickname = () => {
  const nickname = randomItem(nicknameAdjectives) + randomItem(nicknameNouns);

  if (Math.random() < 0.2) {
    return nickname + randomNumericSuffix();
  }

  return nickname;
};
