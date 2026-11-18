import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IBM_Plex_Mono, Sora } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const display = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "VEGA — 股票 / 加密货币行情与图表",
  description: "参考 TradingView 的行情看板与专业 K 线终端，接入币安公开行情。",
  appleWebApp: {
    capable: true,
    title: "VEGA",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#070a0e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="h-14 border-b border-[var(--border)]" />}>
          <Header />
        </Suspense>
        <main className="flex-1 min-w-0">{children}</main>
      </body>
    </html>
  );
}
