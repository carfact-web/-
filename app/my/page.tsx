import { cn } from "@/utils/cn";

const pageClassName = cn("min-h-screen bg-black px-4 py-8 text-white sm:px-6");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-sm leading-6 text-zinc-400"
);

export default function MyPage() {
  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <h1 className="text-3xl font-black text-white">마이</h1>
        <p className="mt-2 text-sm text-zinc-500">
          로그인과 내 활동 관리는 다음 단계에서 연결됩니다.
        </p>

        <div className={cn(panelClassName, "mt-6")}>
          Supabase Auth 기반 소셜 로그인 준비 후 내 후기와 커뮤니티 활동을
          보여주는 공간으로 확장할 예정입니다.
        </div>
      </div>
    </main>
  );
}
