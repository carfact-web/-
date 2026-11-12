import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/webtoons/pdf-upload": ["./lib/server/webtoons/pdf-validate-worker.cjs", "./node_modules/pdf-lib/**/*", "./node_modules/@pdf-lib/**/*", "./node_modules/pako/**/*", "./node_modules/tslib/**/*"],
    "/api/webtoons/pdfjs/*": ["./node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "./node_modules/pdfjs-dist/cmaps/**/*", "./node_modules/pdfjs-dist/standard_fonts/**/*", "./node_modules/pdfjs-dist/wasm/**/*"],
  },
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
