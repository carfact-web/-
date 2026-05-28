import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "카팩트",
    short_name: "카팩트",
    description: "카팩트 - 차주가 알려주지 않는 이야기",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ef4444",
  };
}
