import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomTabNav } from "@/components/BottomTabNav";
import "./globals.css";

const siteUrl = "https://carfact.kr";
const siteTitle = "카팩트 - 판매글에는 없는 이야기";
const siteDescription = "판매글에는 없는 이야기";
const ogImageUrl = `${siteUrl}/og-image-v2.png`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: siteUrl,
  },
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
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "카팩트",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImageUrl],
  },
  other: {
    "twitter:url": siteUrl,
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
        <div className="flex-1 pb-24">{children}</div>
        <BottomTabNav />
      </body>
    </html>
  );
}
