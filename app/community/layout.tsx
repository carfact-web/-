import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "중고차 구매와 정비 정보를 나누는 카팩트 커뮤니티입니다.",
  path: "/community",
  title: "커뮤니티 | 카팩트",
});

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
