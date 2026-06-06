import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "카팩트",
    short_name: "카팩트",
    description: "카팩트 - 이 차량을 본 사람들이 남긴 이야기",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ef4444",
    icons: [
      {
        src: "/icon.png?v=20260606-carfact-logo",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png?v=20260606-carfact-logo",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png?v=20260606-carfact-logo",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
