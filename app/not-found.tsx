import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SeoBreadcrumb } from "@/components/SeoBreadcrumb";
import { createPageMetadata } from "@/lib/seo";
import { createBreadcrumbListJsonLd } from "@/lib/structuredData";

export const metadata: Metadata = {
  ...createPageMetadata({
    description: "요청하신 카팩트 페이지를 찾을 수 없습니다.",
    path: "/404",
    title: "페이지를 찾을 수 없습니다 | 카팩트",
  }),
  robots: {
    follow: false,
    index: false,
  },
};

const breadcrumbItems = [
  { href: "/", name: "홈" },
  { href: "/404", name: "페이지를 찾을 수 없습니다" },
];

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white">
      <JsonLd data={createBreadcrumbListJsonLd(breadcrumbItems)} />
      <SeoBreadcrumb items={breadcrumbItems} />
      <section className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-sm font-bold text-red-300">404</p>
        <h1 className="text-3xl font-black">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm leading-6 text-zinc-400">
          주소가 변경되었거나 삭제된 페이지입니다. 홈에서 차량번호를 다시
          조회해주세요.
        </p>
        <Link
          href="/"
          className="inline-flex w-fit rounded-lg bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-400"
        >
          홈으로
        </Link>
      </section>
    </main>
  );
}
