import { cn } from "@/utils/cn";

interface MaintenanceModeScreenProps {
  expectedEndAt?: string | null;
  message?: string | null;
  startedAt?: string | null;
}

const formatOptionalDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export function MaintenanceModeScreen({
  expectedEndAt,
  message,
  startedAt,
}: MaintenanceModeScreenProps) {
  const startedAtLabel = formatOptionalDate(startedAt);
  const expectedEndAtLabel = formatOptionalDate(expectedEndAt);

  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white">
      <section
        className={cn(
          "mx-auto grid w-full max-w-xl gap-4 rounded-lg border border-zinc-800",
          "bg-zinc-950 p-6 shadow-2xl shadow-black/40",
        )}
      >
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
          Maintenance Mode
        </p>
        <h1 className="text-2xl font-black text-white">서비스 점검 중</h1>
        <p className="text-sm leading-6 text-zinc-300">
          {message || "현재 서비스 점검 중입니다. 잠시 후 다시 이용해주세요."}
        </p>
        <div className="grid gap-2 rounded-lg border border-zinc-800 bg-black p-3 text-xs font-semibold text-zinc-400">
          <p>점검 시작: {startedAtLabel ?? "확인 중"}</p>
          {expectedEndAtLabel ? <p>예상 종료: {expectedEndAtLabel}</p> : null}
        </div>
      </section>
    </main>
  );
}
