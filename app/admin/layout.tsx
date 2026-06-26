import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "카팩트 운영 현황, 후기, 회원, 신고, 트래픽 데이터를 관리합니다.",
  path: "/admin",
  title: "관리자 Dashboard | 카팩트",
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
