import { fetchCommunityPostsByAuthor } from "@/lib/communityData";
import { getCommunityCategoryLabel } from "@/lib/communityCategories";
import { supabase } from "@/lib/supabase";
import { mapReviewRow } from "@/lib/supabaseData";
import { getCommunityPreviewText } from "@/utils/communityRichContent";
import { getVehicleDisplayName } from "@/utils/vehicleDisplayName";
import { stripCommunityTextColorMarkup } from "@/utils/communityTextColor";
import type { CommunityCategory, CommunityPost } from "@/types/community";
import type { Review, ReviewRow } from "@/types/review";

export interface AccountActivity {
  communityLikeCount: number;
  communityPosts: CommunityPost[];
  receivedActivity: AccountReceivedActivity[];
  reviewCount: number;
  reviewHelpfulCount: number;
  reviews: Review[];
}

export interface AccountReceivedActivity {
  count: number;
  href: string;
  label: string;
  searchText: string;
  title: string;
}

const getReviewHref = (review: Review) => {
  const plateNumber = review.vehicleSnapshot?.plateNumber;

  return plateNumber ? "/car/" + encodeURIComponent(plateNumber) : "/";
};

const getCommunityHref = (post: CommunityPost) =>
  "/community?category=" +
  encodeURIComponent(post.category) +
  "&post=" +
  encodeURIComponent(post.id);

const getCommunityCategoryTitle = (category: CommunityCategory) =>
  getCommunityCategoryLabel(category);

export const getEmptyAccountActivity = (): AccountActivity => ({
  communityLikeCount: 0,
  communityPosts: [],
  receivedActivity: [],
  reviewCount: 0,
  reviewHelpfulCount: 0,
  reviews: [],
});

export const fetchAccountActivity = async (
  userId: string,
): Promise<AccountActivity> => {
  if (!supabase) {
    return getEmptyAccountActivity();
  }

  const [reviewsResult, communityPosts] = await Promise.all([
    supabase
      .from("reviews")
      .select("*")
      .eq("author_id", userId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false }),
    fetchCommunityPostsByAuthor(userId),
  ]);

  if (reviewsResult.error) {
    throw reviewsResult.error;
  }

  const reviewRows = (reviewsResult.data ?? []) as ReviewRow[];
  const reviews = reviewRows.map((review) => mapReviewRow(review));
  const reviewHelpfulCount = reviews.reduce(
    (total, review) => total + (review.helpfulCount ?? 0),
    0,
  );
  const communityLikeCount = communityPosts.reduce(
    (total, post) => total + post.likeCount,
    0,
  );
  const receivedActivity: AccountReceivedActivity[] = [
    ...reviews
      .filter((review) => (review.helpfulCount ?? 0) > 0)
      .map((review) => ({
        count: review.helpfulCount ?? 0,
        href: getReviewHref(review),
        label: "차량 후기",
        searchText: [
          getVehicleDisplayName(review.vehicleSnapshot),
          review.vehicleSnapshot?.plateNumber,
          review.content,
        ]
          .filter(Boolean)
          .join(" "),
        title: review.vehicleSnapshot
          ? [
              getVehicleDisplayName(review.vehicleSnapshot),
              review.vehicleSnapshot.plateNumber,
            ]
              .filter(Boolean)
              .join(" · ")
          : "내가 쓴 차량 후기",
      })),
    ...communityPosts
      .filter((post) => post.likeCount > 0)
      .map((post) => ({
        count: post.likeCount,
        href: getCommunityHref(post),
        label: getCommunityCategoryTitle(post.category),
        searchText: [
          post.title,
          getCommunityPreviewText(stripCommunityTextColorMarkup(post.content)),
        ]
          .filter(Boolean)
          .join(" "),
        title: post.title,
      })),
  ].sort((left, right) => right.count - left.count);

  return {
    communityLikeCount,
    communityPosts,
    receivedActivity,
    reviewCount: reviews.length,
    reviewHelpfulCount,
    reviews,
  };
};

export const getCommunityPostHref = getCommunityHref;
