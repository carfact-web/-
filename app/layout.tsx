import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomTabNav } from "@/components/BottomTabNav";
import {
  createPageMetadata,
  defaultOgImageUrl,
  siteName,
  siteUrl,
} from "@/lib/seo";
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
        <div className="flex-1 pb-24">{children}</div>
        <BottomTabNav />
      </body>
    </html>
  );
}
