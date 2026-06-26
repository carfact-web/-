import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  description: "카팩트에 로그인하고 실제 차량 후기를 확인하세요.",
  path: "/login",
  title: "로그인 | 카팩트",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
