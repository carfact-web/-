import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SeoBreadcrumb } from "@/components/SeoBreadcrumb";
import { fetchCommunityPostById } from "@/lib/communityData";
import { createPageMetadata, getTextExcerpt } from "@/lib/seo";
import {
  createBreadcrumbListJsonLd,
  createCommunityArticleJsonLd,
} from "@/lib/structuredData";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import { stripCommunityTextColorMarkup } from "@/utils/communityTextColor";
import CommunityPostDetailPageClient from "./CommunityPostDetailPageClient";

type CommunityPostDetailPageProps = {
  params: Promise<{ postId: string }>;
};

const getPostId = async (params: CommunityPostDetailPageProps["params"]) => {
  const { postId } = await params;

  return decodeURIComponent(postId);
};

export async function generateMetadata({
  params,
}: CommunityPostDetailPageProps): Promise<Metadata> {
  const postId = await getPostId(params);
  const post = await fetchCommunityPostById(postId).catch(() => null);
  const path = "/community/post/" + encodeURIComponent(postId);

  if (!post) {
    return createPageMetadata({
      description: "카팩트 커뮤니티 글과 댓글을 확인하세요.",
      path,
      title: "커뮤니티 글 | 카팩트",
      type: "article",
    });
  }

  const title = stripCommunityTextColorMarkup(post.title);
  const description = getTextExcerpt(stripCommunityTextColorMarkup(post.content), 90);

  return createPageMetadata({
    description: description || "카팩트 커뮤니티 글과 댓글을 확인하세요.",
    image: post.images[0]?.url ?? undefined,
    path,
    title: title + " | 카팩트",
    type: "article",
  });
}

export default async function CommunityPostDetailPage({
  params,
}: CommunityPostDetailPageProps) {
  const postId = await getPostId(params);
  const post = await fetchCommunityPostById(postId).catch(() => null);
  const path = "/community/post/" + encodeURIComponent(postId);
  const postTitle = post
    ? stripCommunityTextColorMarkup(post.title)
    : "커뮤니티 글";
  const breadcrumbItems = [
    { href: "/", name: "홈" },
    { href: "/community", name: "커뮤니티" },
    {
      href: post?.isNotice ? "/community?category=notice" : "/community",
      name: post?.isNotice
        ? "공지사항"
        : post
          ? getCommunityCategoryLabel(post.category)
          : "게시글",
    },
    { href: path, name: postTitle },
  ];

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbListJsonLd(breadcrumbItems),
          ...(post ? [createCommunityArticleJsonLd({ path, post })] : []),
        ]}
      />
      <SeoBreadcrumb items={breadcrumbItems} />
      <CommunityPostDetailPageClient />
    </>
  );
}
