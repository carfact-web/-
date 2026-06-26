import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "최근 조회한 차량과 후기를 다시 확인하세요.",
  path: "/recent",
  title: "최근 조회 차량 | 카팩트",
});

export default function RecentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
