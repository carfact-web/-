import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "차량번호로 실제 후기와 차량 정보를 검색하세요.",
  path: "/lookup",
  title: "차량번호 조회 | 카팩트",
});

export default function LookupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
