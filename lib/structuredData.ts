import {
  getCanonicalUrl,
  getTextExcerpt,
  siteDescription,
  siteName,
  siteUrl,
} from "@/lib/seo";
import { stripCommunityTextColorMarkup } from "@/utils/communityTextColor";
import type { CommunityPost } from "@/types/community";
import type { Review } from "@/types/review";
import type { Vehicle } from "@/types/vehicle";

export type JsonLdGraph = Record<string, unknown>;

export type BreadcrumbJsonLdItem = {
  href: string;
  name: string;
};

const organization = {
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
};

const searchTarget = siteUrl + "/lookup?carNumber={search_term_string}";

export const createWebSiteJsonLd = (): JsonLdGraph => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  publisher: organization,
  potentialAction: {
    "@type": "SearchAction",
    target: searchTarget,
    "query-input": "required name=search_term_string",
  },
});

export const createBreadcrumbListJsonLd = (
  items: BreadcrumbJsonLdItem[],
): JsonLdGraph => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: getCanonicalUrl(item.href),
  })),
});

export const createHomeFaqPageJsonLd = (): JsonLdGraph => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "카팩트에서 어떤 정보를 확인할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "중고차 판매글에서는 보기 어려운 실제 후기, 차량 정보, 정비 이슈를 확인할 수 있습니다.",
      },
    },
    {
      "@type": "Question",
      name: "차량번호로 조회할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "차량번호를 입력해 등록된 차량 정보와 해당 차량의 실제 후기를 확인할 수 있습니다.",
      },
    },
    {
      "@type": "Question",
      name: "후기는 누가 작성하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "차량을 직접 확인했거나 이용 경험이 있는 사용자가 후기를 작성하고 공유합니다.",
      },
    },
  ],
});

export const createVehicleProductJsonLd = ({
  path,
  vehicle,
  vehicleName,
}: {
  path: string;
  vehicle: Vehicle | null;
  vehicleName: string;
}): JsonLdGraph => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: vehicleName,
  brand: vehicle?.brand
    ? {
        "@type": "Brand",
        name: vehicle.brand,
      }
    : undefined,
  model: vehicle?.model || undefined,
  productionDate: vehicle?.year || undefined,
  description:
    getTextExcerpt(vehicleName, 60) +
    "의 실제 후기, 고질병, 정비 이슈와 차량 정보를 확인하세요.",
  url: getCanonicalUrl(path),
});

export const createReviewJsonLd = ({
  path,
  review,
  reviewTitle,
  vehicle,
  vehicleName,
}: {
  path: string;
  review: Review;
  reviewTitle: string;
  vehicle: Vehicle | null;
  vehicleName: string;
}): JsonLdGraph => ({
  "@context": "https://schema.org",
  "@type": "Review",
  name: reviewTitle,
  reviewBody: review.content,
  author: {
    "@type": "Person",
    name: review.authorNickname || "카팩트 사용자",
  },
  datePublished: review.createdAt,
  itemReviewed: {
    "@type": "Product",
    name: vehicleName,
    brand: vehicle?.brand
      ? {
          "@type": "Brand",
          name: vehicle.brand,
        }
      : undefined,
    model: vehicle?.model || undefined,
  },
  publisher: organization,
  url: getCanonicalUrl(path),
});

export const createCommunityArticleJsonLd = ({
  path,
  post,
}: {
  path: string;
  post: CommunityPost;
}): JsonLdGraph => {
  const title = stripCommunityTextColorMarkup(post.title);
  const body = stripCommunityTextColorMarkup(post.content);
  const images = post.images
    .map((image) => image.url ?? image.dataUrl)
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl));

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    articleBody: getTextExcerpt(body, 500),
    author: {
      "@type": "Person",
      name: post.authorNickname || "카팩트 사용자",
    },
    datePublished: post.createdAtRaw || post.createdAt,
    dateModified: post.createdAtRaw || post.createdAt,
    image: images.length > 0 ? images : undefined,
    mainEntityOfPage: getCanonicalUrl(path),
    publisher: organization,
    url: getCanonicalUrl(path),
  };
};
