import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "카팩트 로그인 처리를 완료합니다.",
  path: "/auth/callback",
  title: "로그인 처리 | 카팩트",
});

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
