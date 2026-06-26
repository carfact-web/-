import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "내가 작성한 카팩트 후기와 커뮤니티 활동을 확인하세요.",
  path: "/my",
  title: "마이페이지 | 카팩트",
});

export default function MyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
