import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Next.js Dashboard Training",
  description: "フロントエンドエンジニア向け Next.js ハンズオン研修教材",
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
            { text: "目次・進め方", link: "/training/README" },
            {
              text: "第 00 章：はじめに / 完成形ツアー",
              link: "/training/00-orientation",
            },
            {
              text: "第 01 章：プロジェクト基盤の仕組み [FE]",
              link: "/training/01-foundation",
            },
            {
              text: "第 02 章：Tailwind v4 + shadcn/ui [FE]",
              link: "/training/02-tailwind-shadcn",
            },
            {
              text: "第 03 章：App Router・layout・ルートグループ [FE]",
              link: "/training/03-routing",
            },
            {
              text: "第 04 章：Drizzle + SQLite [BE・必須]",
              link: "/training/04-drizzle-sqlite",
            },
            {
              text: "第 05 章：Server Actions + フォーム [FE]",
              link: "/training/05-server-actions",
            },
            {
              text: "第 06 章：Better Auth + Google OAuth [FE]",
              link: "/training/06-better-auth",
            },
            {
              text: "第 07 章：Cache Components [FE]",
              link: "/training/07-cache-components",
            },
            {
              text: "第 08 章：nuqs + Zustand [FE]",
              link: "/training/08-nuqs-zustand",
            },
            {
              text: "第 09 章：仕上げ：Dashboard + デプロイ準備 [FE]",
              link: "/training/09-finishing",
            },
            {
              text: "第 10 章：テーマを導入してみよう [FE]",
              link: "/training/10-theme",
            },
            {
              text: "第 11 章：Result 型 / Repository 層 [BE・より深く]",
              link: "/training/11-result-repository",
            },
            {
              text: "第 12 章：Zod + Service 層 [BE・より深く]",
              link: "/training/12-zod-service",
            },
            {
              text: "第 13 章：Vitest でテストを書く [BE・より深く]",
              link: "/training/13-vitest-biome",
            },
            {
              text: "第 14 章：React Compiler + Turbopack [より深く]",
              link: "/training/14-react-compiler",
            },
          ],
        },
        {
          text: "補足・参考",
          items: [
            {
              text: "Server Actions アーキテクチャと REST API との違い",
              link: "/training/appendix-backend-architecture",
            },
            {
              text: "ページ実装の設計思想（フロントエンド・アーキテクチャ）",
              link: "/training/appendix-frontend-architecture",
            },
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
      pattern:
        "https://github.com/GentaAmeku/nextjs-dashboard-training/edit/main/docs/:path",
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
