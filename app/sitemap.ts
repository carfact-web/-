import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { getCanonicalUrl } from "@/lib/seo";

export const revalidate = 3600;

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: getCanonicalUrl("/"),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: getCanonicalUrl("/lookup"),
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: getCanonicalUrl("/community"),
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: getCanonicalUrl("/community?category=notice"),
    changeFrequency: "daily",
    priority: 0.7,
  },
];

const toLastModified = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!supabase) {
    return staticRoutes;
  }

  const [vehiclesResult, reviewsResult, postsResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id,car_number,updated_at,created_at")
      .order("updated_at", { ascending: false })
      .limit(5000),
    supabase
      .from("reviews")
      .select("id,vehicle_id,updated_at,created_at")
      .eq("is_hidden", false)
      .order("updated_at", { ascending: false })
      .limit(5000),
    supabase
      .from("community_posts")
      .select("id,updated_at,created_at,is_notice")
      .eq("is_hidden", false)
      .order("updated_at", { ascending: false })
      .limit(5000),
  ]);

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  if (reviewsResult.error) {
    throw reviewsResult.error;
  }

  if (postsResult.error) {
    throw postsResult.error;
  }

  const vehicleById = new Map(
    (vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );

  const vehicleRoutes = (vehiclesResult.data ?? []).map((vehicle) => ({
    url: getCanonicalUrl("/car/" + encodeURIComponent(vehicle.car_number)),
    lastModified: toLastModified(vehicle.updated_at ?? vehicle.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const reviewRoutes: MetadataRoute.Sitemap = (reviewsResult.data ?? [])
    .flatMap((review) => {
      const vehicle = vehicleById.get(review.vehicle_id);

      if (!vehicle?.car_number) {
        return [];
      }

      return [
        {
          url: getCanonicalUrl(
            "/car/" +
              encodeURIComponent(vehicle.car_number) +
              "/review?reviewId=" +
              encodeURIComponent(review.id),
          ),
          lastModified: toLastModified(review.updated_at ?? review.created_at),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        },
      ];
    });

  const communityRoutes = (postsResult.data ?? []).map((post) => ({
    url: getCanonicalUrl("/community/post/" + encodeURIComponent(post.id)),
    lastModified: toLastModified(post.updated_at ?? post.created_at),
    changeFrequency: post.is_notice ? ("weekly" as const) : ("monthly" as const),
    priority: post.is_notice ? 0.7 : 0.6,
  }));

  return [
    ...staticRoutes,
    ...vehicleRoutes,
    ...reviewRoutes,
    ...communityRoutes,
  ];
}
