import { cn } from "@/utils/cn";

const pageClassName = cn("min-h-screen bg-black px-4 py-8 pb-28 text-white sm:px-6");
const shellClassName = cn("mx-auto w-full max-w-3xl");
const panelClassName = cn(
  "rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-sm leading-6 text-zinc-400"
);

export default function CommunityPage() {
  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <h1 className="text-3xl font-black text-white">커뮤니티</h1>
        <p className="mt-2 text-sm text-zinc-500">
          자유게시판은 다음 단계에서 연결됩니다.
        </p>

        <div className={cn(panelClassName, "mt-6")}>
          로그인 사용자는 글을 작성하고, 비로그인 사용자는 글을 읽을 수 있는
          구조로 준비할 예정입니다.
        </div>
      </div>
    </main>
  );
}
