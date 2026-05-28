import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomTabNavigation } from "@/components/BottomTabNavigation";
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
  description: "카팩트 - 차주가 알려주지 않는 이야기",
  manifest: "/manifest.webmanifest",
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
      <body className="min-h-full flex flex-col pb-20 md:pb-0">
        {children}
        <BottomTabNavigation />
      </body>
    </html>
  );
}
