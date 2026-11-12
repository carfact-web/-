import Link from "next/link";
import { isLocalSandboxServer } from "@/lib/local/sandbox.server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomTabNav } from "@/components/BottomTabNav";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { MaintenanceModeGate } from "@/components/MaintenanceModeGate";
import { PageViewTracker } from "@/components/PageViewTracker";
import {
  createPageMetadata,
  defaultOgImageUrl,
  siteName,
  siteUrl,
} from "@/lib/seo";
import { createWebSiteJsonLd } from "@/lib/structuredData";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...createPageMetadata(),
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260610-favicon-fill", sizes: "any" },
      {
        url: "/icons/icon-32x32.png?v=20260610-favicon-fill",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icons/icon-48x48.png?v=20260610-favicon-fill",
        sizes: "48x48",
        type: "image/png",
      },
      {
        url: "/icon.png?v=20260610-favicon-fill",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: ["/favicon.ico?v=20260610-favicon-fill"],
    apple: [
      {
        url: "/apple-touch-icon.png?v=20260610-favicon-fill",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  applicationName: siteName,
  appleWebApp: {
    capable: true,
    title: siteName,
  },
  category: "automotive",
  creator: siteName,
  publisher: siteName,
  other: {
    "twitter:url": siteUrl,
    "twitter:image": defaultOgImageUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isLocalSandboxServer() ? (
          <aside aria-label="로컬 테스트 환경 안내" className="sticky top-0 z-[100001] border-b-2 border-amber-500 bg-amber-100 px-4 py-3 text-sm text-black">
            <div className="mx-auto max-w-5xl">
              <p className="font-black">로컬 테스트 전용 · 운영 서비스가 아닙니다</p>
              <p>123가4567은 합성 테스트 차량입니다. 차량 이력은 모의 응답이며, 후기·회원·이미지는 분리된 로컬 환경에만 저장됩니다.</p>
              <nav aria-label="테스트 시연 순서" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-bold underline">
                <Link href="/">① 홈</Link>
                <Link href="/lookup">② 차량조회</Link>
                <Link href="/car/123가4567/review">③ 후기 작성</Link>
                <Link href="/car/123가4567">④ 등록된 후기 확인</Link>
                <Link href="/local-test">테스트 로그인</Link>
                <Link href="/webtoons">웹툰 열람</Link>
                <Link href="/admin/webtoons">웹툰 관리</Link>
              </nav>
            </div>
          </aside>
        ) : null}
        <GoogleAnalytics />
        <JsonLd data={createWebSiteJsonLd()} />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <MaintenanceModeGate />
        <div className="flex-1 pb-24">{children}</div>
        <BottomTabNav />
      </body>
    </html>
  );
}
