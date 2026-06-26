import { createPageMetadata } from "@/lib/seo";

type CommunityPostLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ postId: string }>;
};

export async function generateMetadata({ params }: CommunityPostLayoutProps) {
  const { postId } = await params;

  return createPageMetadata({
    description: "카팩트 커뮤니티 글과 댓글을 확인하세요.",
    path: "/community/post/" + encodeURIComponent(postId),
    title: "커뮤니티 글 | 카팩트",
    type: "article",
  });
}

export default function CommunityPostLayout({
  children,
}: CommunityPostLayoutProps) {
  return children;
}
