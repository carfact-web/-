export const indexNowKey = "c80d2b6f9a0b4c15a437e8d02f3c6b91";
export const indexNowHost = "www.carfact.kr";
export const indexNowBaseUrl = "https://" + indexNowHost;
export const indexNowKeyLocation =
  indexNowBaseUrl + "/" + indexNowKey + ".txt";
export const indexNowSitemapUrl = indexNowBaseUrl + "/sitemap.xml";

const normalizePath = (path: string) =>
  path.startsWith("/") ? path : "/" + path;

export const createIndexNowUrl = (path: string) =>
  indexNowBaseUrl + normalizePath(path);

export const createVehicleIndexNowUrl = (carNumber: string) =>
  createIndexNowUrl("/car/" + encodeURIComponent(carNumber));

export const createReviewIndexNowUrl = (carNumber: string, reviewId: string) =>
  createIndexNowUrl(
    "/car/" +
      encodeURIComponent(carNumber) +
      "/review?reviewId=" +
      encodeURIComponent(reviewId),
  );

export const createCommunityPostIndexNowUrl = (postId: string) =>
  createIndexNowUrl("/community/post/" + encodeURIComponent(postId));

export const isAllowedIndexNowUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.protocol === "https:" &&
      parsedUrl.hostname === indexNowHost
    );
  } catch {
    return false;
  }
};
