import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomTabNav } from "@/components/BottomTabNav";
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
  title: "카팩트",
  description: "카팩트 - 이 차량을 본 사람들이 남긴 이야기",
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
  openGraph: {
    title: "카팩트",
    description: "이 차량을 본 사람들이 남긴 이야기",
    siteName: "카팩트",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "카팩트",
    description: "이 차량을 본 사람들이 남긴 이야기",
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
