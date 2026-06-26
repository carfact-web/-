import type { MetadataRoute } from "next";
import { getCanonicalUrl, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth", "/my"],
    },
    sitemap: getCanonicalUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
