import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Next.js Dashboard Training",
  description: "新人フロントエンドエンジニア向け Next.js ハンズオン研修教材",
  lang: "ja",
  // GitHub Pages のサブパス
  base: "/nextjs-dashboard-training/",

  themeConfig: {
    nav: [
      { text: "ホーム", link: "/" },
      { text: "研修を始める", link: "/training/00-orientation" },
      {
        text: "GitHub",
        link: "https://github.com/GentaAmeku/nextjs-dashboard-training",
      },
    ],

    sidebar: {
      "/training/": [
        {
          text: "研修ハンズオン手順書",
          items: [
            { text: "目次・進め方", link: "/training/" },
            { text: "第 00 章：はじめに / 完成形ツアー", link: "/training/00-orientation" },
            { text: "第 01 章：プロジェクト基盤の仕組み", link: "/training/01-foundation" },
            { text: "第 02 章：Tailwind v4 + shadcn/ui", link: "/training/02-tailwind-shadcn" },
            { text: "第 03 章：App Router・layout・ルート", link: "/training/03-routing" },
            { text: "第 04 章：Drizzle + SQLite", link: "/training/04-drizzle-sqlite" },
            { text: "第 05 章：Result 型 / Repository 層", link: "/training/05-result-repository" },
            { text: "第 06 章：Zod + Service 層", link: "/training/06-zod-service" },
            { text: "第 07 章：Server Actions + フォーム", link: "/training/07-server-actions" },
            { text: "第 08 章：Better Auth + Google OAuth", link: "/training/08-better-auth" },
            { text: "第 09 章：Cache Components", link: "/training/09-cache-components" },
            { text: "第 10 章：nuqs + Zustand", link: "/training/10-nuqs-zustand" },
            { text: "第 11 章：Vitest でテストを書く", link: "/training/11-vitest-biome" },
            { text: "第 12 章：React Compiler + Turbopack", link: "/training/12-react-compiler" },
            { text: "第 13 章：仕上げ・デプロイ準備", link: "/training/13-finishing" },
          ],
        },
      ],
    },

    // 見出しの深さ（H2 + H3 まで表示）
    outline: {
      level: [2, 3],
      label: "このページの内容",
    },

    // 前後ナビゲーション
    docFooter: {
      prev: "前の章",
      next: "次の章",
    },

    // 検索
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "検索",
                buttonAriaLabel: "検索",
              },
              modal: {
                noResultsText: "見つかりませんでした",
                resetButtonTitle: "クリア",
                footer: {
                  selectText: "選択",
                  navigateText: "移動",
                  closeText: "閉じる",
                },
              },
            },
          },
        },
      },
    },

    // フッター
    footer: {
      message: "Next.js Dashboard Training — 研修教材",
      copyright: "Copyright © 2026",
    },

    // 編集リンク
    editLink: {
      pattern: "https://github.com/GentaAmeku/nextjs-dashboard-training/edit/main/docs/:path",
      text: "この章を GitHub で編集",
    },

    // ソーシャルリンク
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/GentaAmeku/nextjs-dashboard-training",
      },
    ],
  },
});
