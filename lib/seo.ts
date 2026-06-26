import type { Metadata } from "next";

export const siteUrl = "https://carfact.kr";
export const siteName = "카팩트";
export const siteTitle = "카팩트 - 판매글에는 없는 이야기";
export const siteDescription =
  "중고차 실매물 후기 공유 플랫폼.\n판매글에서는 볼 수 없는 실제 후기와 차량 정보를 확인하세요.";
export const defaultOgImagePath = "/og-image-v2.png";
export const defaultOgImageUrl = siteUrl + defaultOgImagePath;

const normalizePath = (path = "/") =>
  path.startsWith("/") ? path : "/" + path;

export const getCanonicalUrl = (path = "/") => siteUrl + normalizePath(path);

export const createPageMetadata = ({
  description = siteDescription,
  image = defaultOgImageUrl,
  path = "/",
  title = siteTitle,
  type = "website",
}: {
  description?: string;
  image?: string;
  path?: string;
  title?: string;
  type?: "article" | "website";
} = {}): Metadata => {
  const canonical = getCanonicalUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "ko_KR",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    other: {
      "twitter:url": canonical,
    },
  };
};

export const getVehicleDisplayName = (vehicle?: {
  brand?: string | null;
  generation?: string | null;
  model?: string | null;
} | null) =>
  [vehicle?.brand, vehicle?.model, vehicle?.generation]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

export const getTextExcerpt = (value: string, maxLength = 42) => {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return normalizedValue.slice(0, maxLength).trim() + "...";
};
