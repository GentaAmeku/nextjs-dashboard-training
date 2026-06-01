import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard | Next.js",
  description: "dashboard playground next.js",
};

// ルートレイアウト（全ページ共通の器）。
// この出発版は html / body とフォントのみ。
// - 第 08 章で URL 状態管理の NuqsAdapter を追加
// - 第 10 章でテーマ用の ThemeProvider と suppressHydrationWarning を追加
// 共通シェル（サイドバー・ヘッダー）は (authed)/layout.tsx に置く（第 03 章）。
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
