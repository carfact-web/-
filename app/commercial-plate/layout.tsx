import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description:
    "택시·화물·렌터카 등 영업용 번호판 차량의 운행 여부와 기본 이력을 확인하세요.",
  path: "/commercial-plate",
  title: "영업넘버 확인 | 카팩트",
});

export default function CommercialPlateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
