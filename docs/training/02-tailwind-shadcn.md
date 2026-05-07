# 第 02 章：Tailwind v4 + shadcn/ui

## この章の目標

> **CHECK**
> - [ ] `app/globals.css` の `@theme` がどう動くか説明できる
> - [ ] `cn()` の役割を説明できる
> - [ ] shadcn/ui の `Button` と `Card` を自分のプロジェクトに追加できる
> - [ ] shadcn コンポーネントが追加されたとき何が起きるか説明できる

---

## 2-1. Tailwind CSS v4 の変わったこと

Tailwind CSS v4 は v3 と比べて設定ファイルの構造が大きく変わりました。

### v3 と v4 の違い

| 比較           | v3                                | v4                                  |
| -------------- | --------------------------------- | ----------------------------------- |
| 設定ファイル   | `tailwind.config.ts`（必須）      | **不要**（CSS ファイルに書く）      |
| テーマ拡張     | JS で `extend: { colors: {...} }` | CSS の `@theme` で書く              |
| PostCSS 設定   | `tailwindcss` プラグイン          | `@tailwindcss/postcss` プラグイン   |

v4 では **CSS がすべての設定場所** になります。

### `postcss.config.mjs` を確認する

```bash
cat postcss.config.mjs
```

```javascript
// このプロジェクトの postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

たった 1 つのプラグインで Tailwind v4 が動きます。`tailwind.config.ts` は存在しません。

---

## 2-2. `app/globals.css` の構造を読む

```bash
cat app/globals.css
```

このプロジェクトの `globals.css` は大きく 3 つのパートに分かれています。

### パート 1：Tailwind と外部スタイルの読み込み

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

- `@import "tailwindcss"` — Tailwind v4 本体を読み込む
- `@import "tw-animate-css"` — アニメーション用ユーティリティ
- `@import "shadcn/tailwind.css"` — shadcn/ui の基本スタイル

### パート 2：ダークモードの定義

```css
@custom-variant dark (&:is(.dark *));
```

`.dark` クラスが親要素に付いたとき、`dark:` プレフィックスのスタイルが適用されます。

### パート 3：`@theme inline` でテーマ変数を定義する

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
  --font-sans: var(--font-geist-sans);
}
```

`@theme inline` は Tailwind v4 の新機能です。CSS 変数を Tailwind のユーティリティクラスとして使えるようにします。

```
CSS 変数 `--color-primary`
    ↓ @theme inline で登録
Tailwind クラス `bg-primary`, `text-primary` などが使えるようになる
```

### パート 4：ライトモード / ダークモードのカラーパレット

```css
:root {
  --background: oklch(1 0 0);          /* 白 */
  --foreground: oklch(0.141 0.005 286); /* ほぼ黒 */
  --primary: oklch(0.21 0.006 285.75);
  /* ... */
}

.dark {
  --background: oklch(0.141 0.005 286);
  --foreground: oklch(0.985 0 0);
  /* ... */
}
```

**oklch** は新しいカラー記法です。`oklch(明度 彩度 色相)` で色を指定します。従来の `#ffffff` や `rgb()` より直感的に色を操作できます。

> NOTE
> v4 では CSS 変数がすべての出発点です。
> `:root` で定義した CSS 変数 → `@theme inline` で Tailwind に登録 → クラス名で使う、という流れを覚えておきましょう。

---

## 2-3. shadcn/ui とは

**shadcn/ui** は、Radix UI プリミティブを基にした UI コンポーネントライブラリです。

他のコンポーネントライブラリと異なる特徴として、**コンポーネントのコードを自分のプロジェクトにコピーする**方式を取っています。

```
通常のライブラリ:
  npm install ui-library → node_modules に入る → コードを変更できない

shadcn/ui:
  pnpm dlx shadcn add button → components/ui/button.tsx が生成される → コードを自由に編集できる
```

### `components.json` を確認する

```bash
cat components.json
```

```json
{
  "style": "radix-sera",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css"
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- `"rsc": true` — Server Components に対応したコードを生成する
- `"aliases"` — `@/components/ui/button` のような短いパスで import できるよう設定

---

## 2-4. `cn()` の役割

`lib/utils.ts` に `cn()` という関数があります。

```bash
cat lib/utils.ts
```

```typescript
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`cn()` は **条件付きでクラスを結合し、競合するクラスを自動で解決する** ユーティリティです。

```tsx
// 条件によってクラスを切り替えたい場合
<div className={cn(
  "px-4 py-2 rounded",           // 常に適用
  isActive && "bg-primary",      // isActive が true のとき
  isDisabled && "opacity-50",    // isDisabled が true のとき
)}>

// tailwind-merge が競合を解決してくれる例
cn("px-4", "px-8")   // → "px-8"（後の値が優先）
cn("text-sm", "text-lg") // → "text-lg"
```

> NOTE
> shadcn/ui のすべてのコンポーネントは内部で `cn()` を使っています。
> コンポーネントにカスタムクラスを追加するときも `cn()` を使いましょう。

---

## 2-5. ハンズオン：shadcn/ui のセットアップ

### Step 1：shadcn を初期化する

```bash
pnpm dlx shadcn@latest init
```

プロンプトへの回答例：

```
✔ Which style would you like to use? → Default
✔ Which color would you like to use as base color? → Slate
✔ Would you like to use CSS variables for colors? → Yes
```

`components.json` と `app/globals.css`（テーマ変数入り）が生成されます。

### Step 2：`lib/utils.ts` の確認

```bash
cat lib/utils.ts
```

`cn()` 関数が生成されていることを確認します。

### Step 3：Button コンポーネントを追加する

```bash
pnpm dlx shadcn@latest add button
```

```bash
ls components/ui/
# button.tsx が生成されている
cat components/ui/button.tsx
```

生成された `button.tsx` を読んでみましょう。`cva`（class-variance-authority）でバリアント（サイズ・スタイルの違い）を管理しています。

### Step 4：Card コンポーネントを追加する

```bash
pnpm dlx shadcn@latest add card
ls components/ui/
# card.tsx が追加されている
```

### Step 5：動作確認

`app/page.tsx` を書き換えて、ボタンとカードを表示してみましょう。

```tsx
// app/page.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-80">
        <CardHeader>
          <CardTitle>ダッシュボード</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            タスク管理アプリへようこそ
          </p>
          <Button>はじめる</Button>
          <Button variant="outline">詳細を見る</Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

```bash
pnpm dev
```

`http://localhost:3000` にアクセスし、カードとボタンが表示されることを確認します。

> CHECK
> - ボタンがプライマリカラー（濃い色）で表示されているか
> - `variant="outline"` のボタンは枠線スタイルになっているか
> - ブラウザの DevTools でボタン要素を確認し、Tailwind のクラスが付いているか

<details>
<summary>HINT：ボタンが表示されない場合</summary>

- `import` パスに誤りがないか確認 (`@/components/ui/button`)
- `pnpm dlx shadcn add button` を実行したか確認
- `components/ui/button.tsx` が生成されているか `ls components/ui/` で確認

</details>

---

## 2-6. よく使う Tailwind クラスの確認

このプロジェクトで頻出するクラスを把握しておきましょう。

```tsx
// レイアウト
<div className="flex items-center gap-4">     // 横並び、中央揃え、間隔 4
<div className="grid grid-cols-3 gap-6">      // 3 列グリッド
<div className="flex flex-col min-h-screen">  // 縦並び、画面の高さ全体

// スペーシング
<div className="p-4 px-6 py-2">   // padding（全体・横・縦）
<div className="m-4 mt-8">        // margin（全体・上）
<div className="space-y-4">       // 子要素の縦間隔

// テキスト
<p className="text-sm text-muted-foreground">   // 小さい、薄い色
<h1 className="text-2xl font-bold">             // 大きい、太字
<span className="truncate">                     // はみ出したら省略

// カラー（shadcn のテーマ変数を使う）
<div className="bg-background text-foreground"> // 背景・テキスト
<div className="bg-primary text-primary-foreground"> // プライマリ色
<div className="border border-border">          // ボーダー

// レスポンシブ
<div className="w-full md:w-1/2 lg:w-1/3">   // 画面幅で変化
```

---

## まとめと次のステップ

この章では以下を学びました：

- Tailwind v4 は `tailwind.config.ts` が不要で、CSS の `@theme` で設定する
- `:root` で CSS 変数 → `@theme inline` で Tailwind クラスに変換
- shadcn/ui はコードをプロジェクトにコピーする方式
- `cn()` はクラスの条件付き結合と競合解決に使う

次の第 03 章では **App Router のルーティング** を実装し、`/login`・`/`・`/tasks` の 3 画面と認証必須エリアの共通レイアウトを作ります。

→ [第 03 章：App Router・layout・ルートグループ](./03-routing.md)
