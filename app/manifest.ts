import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "카팩트",
    short_name: "카팩트",
    description:
      "중고차 실매물 후기 공유 플랫폼. 판매글에서는 볼 수 없는 실제 후기와 차량 정보를 확인하세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ef4444",
    icons: [
      {
        src: "/icons/icon-192x192.png?v=20260610-favicon-fill",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192.png?v=20260610-favicon-fill",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png?v=20260610-favicon-fill",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png?v=20260610-favicon-fill",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png?v=20260610-favicon-fill",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
