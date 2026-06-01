# 第 03 章：App Router・layout・ルートグループ

## この章の目標

> **CHECK**
> - [ ] `app/` ディレクトリの構造と URL の対応を説明できる
> - [ ] `layout.tsx` のネストと「器 → 中身」の関係を説明できる
> - [ ] ルートグループ `(authed)` の意味を説明できる
> - [ ] ルートレイアウト → `(authed)` レイアウト（共通シェル）→ 各ページの順に組み立て、`/`・`/tasks`・`/login` が表示できる
> - [ ] 画面遷移に `<Link>` を使う理由を説明できる

---

> [!TIP]
> **共通シェル（`AppSidebar` / `AppHeader` / `PageContainer`）と shadcn 部品はリポジトリに同梱済みです。**
> この章では、それらを**レイアウトに組み込む（合成する）こと**と、**ファイル構造で URL が決まる仕組み**の理解に集中します。
> シェルの中身（サイドバーの見た目など）は完成系を参照してください。
>
> ```bash
> git show answer/main:app/\(authed\)/components/AppSidebar/index.tsx
> git show answer/main:app/\(authed\)/components/AppHeader/index.tsx
> ```

---

## 3-1. App Router の基本：ファイルで URL を決める

Next.js App Router では、**`app/` 以下のディレクトリ構造がそのまま URL になります**。

```
app/
├── page.tsx           → http://localhost:3000/
├── login/
│   └── page.tsx       → http://localhost:3000/login
└── tasks/
    ├── page.tsx        → http://localhost:3000/tasks
    └── create/
        └── page.tsx    → http://localhost:3000/tasks/create
```

### 特別なファイル名

| ファイル名      | 役割                                  |
| --------------- | ------------------------------------- |
| `page.tsx`      | そのパスの画面を定義する（必須）      |
| `layout.tsx`    | 複数ページで共有する**器**（レイアウト） |
| `loading.tsx`   | データ取得中に表示するローディング UI |
| `error.tsx`     | エラー時に表示する UI                 |
| `not-found.tsx` | 404 時に表示する UI                   |

> NOTE
> 動的セグメント（`[id]`）とクエリ（URL 状態）はこの章では扱いません。
> `[id]`（例: `/tasks/123/edit`）は**編集ページを作る章**で、URL のフィルタ状態は **nuqs の章（第 08 章）**で扱います。

---

## 3-2. `layout.tsx` のネスト構造（器 → 中身）

`layout.tsx` は**ネスト（入れ子）** して使います。外側の layout が内側を `children` として包みます。

```
ルートレイアウト（app/layout.tsx）         ← 全ページ共通（html / body / フォント）
  └─ 認証エリアのレイアウト（app/(authed)/layout.tsx）  ← サイドバー + ヘッダー（共通シェル）
       └─ ページ（app/(authed)/tasks/page.tsx）          ← 各画面の中身
```

レンダリングは「外側の器が内側を包む」イメージです。

```
RootLayout( AuthedLayout( TasksPage ) )
```

この章では、この入れ子を**外側（器）から内側（中身）へ**順番に作っていきます。

---

## 3-3. ルートグループ `(authed)` とは

`(authed)` のようにカッコで囲んだディレクトリは **ルートグループ** です。

```
app/
├── (authed)/
│   ├── layout.tsx  ← / と /tasks にだけ適用される共通シェル
│   ├── page.tsx    → /
│   └── tasks/
│       └── page.tsx → /tasks
└── login/
    └── page.tsx    → /login（(authed) の外なのでシェルは付かない）
```

- **URL には影響しません**（`/tasks` であって `/authed/tasks` ではない）。
- **グループ内のページにだけ共通 layout を適用する**ために使います。
- `/login` を `(authed)` の外に置くことで、ログイン画面にはサイドバーが付きません。

> NOTE
> この章の `(authed)/layout.tsx` には認証チェックはまだ入れません。
> DB セッションを検証する `AuthGate` は **第 06 章**で、この同じファイルに追記します。

---

## 3-4. ハンズオン①：レイアウト（器）を組む

実開発と同じく、**先にレイアウト（器）を組んでから**、各ページ（中身）を作ります。

### Step 1：ルートレイアウト（`app/layout.tsx`）

全ページ共通の `<html>` / `<body>` とフォントを定義します。

```tsx
// app/layout.tsx
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

> NOTE
> ルートレイアウトはこの先の章で**追記して育てます**。
> - 第 08 章：URL 状態管理の `NuqsAdapter` を追加
> - 第 10 章：テーマ用の `ThemeProvider` と `suppressHydrationWarning` を追加
>
> 今は最小の出発版でかまいません。

### Step 2：認証エリアのレイアウト（`app/(authed)/layout.tsx`）

`(authed)` グループに共通シェル（サイドバー＋ヘッダー）を組み込みます。
**シェルの部品はリポジトリに同梱済み**（`app/(authed)/components/`）なので、それを `import` して合成するだけです。

```bash
mkdir -p "app/(authed)"
touch "app/(authed)/layout.tsx"
```

> NOTE
> ディレクトリ名にカッコが含まれるので、`mkdir` ではクォートで囲みます。

```tsx
// app/(authed)/layout.tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import PageContainer from "./components/PageContainer";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* 左：サイドバー（同梱済み。ナビリンクのみ。第 06 章でユーザー情報とログアウトを追記） */}
      <AppSidebar />
      <main className="w-full">
        {/* 上：ヘッダー（同梱済み。第 10 章でテーマ切替ボタンを配線） */}
        <AppHeader />
        {/* 各ページの中身がここに入る */}
        <PageContainer>{children}</PageContainer>
      </main>
    </SidebarProvider>
  );
}
```

> NOTE
> ここに**認証チェックはまだありません**。第 06 章で、この `AuthedLayout` の `children` を
> `<Suspense>` と `AuthGate`（DB セッション検証）で包む形に追記します。
> 完成形は `git show answer/main:app/\(authed\)/layout.tsx` で確認できます。

---

## 3-5. ハンズオン②：ページ（中身）を作る

器ができたので、各画面の `page.tsx` を作ります。中身はこの章ではプレースホルダで OK です（各機能は後続章で実装します）。

### Step 3：ダッシュボード（`/`）

> NOTE
> ルートグループの `(authed)/page.tsx` が `/` を担当します。クローン時点の仮トップページ `app/page.tsx` は不要になる（`/` が重複する）ので削除します。
>
> ```bash
> rm app/page.tsx
> ```

```tsx
// app/(authed)/page.tsx
export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>
      <p className="text-muted-foreground">
        タスク統計をここに表示します（第 09 章で実装）
      </p>
    </div>
  );
}
```

### Step 4：タスク一覧（`/tasks`）

```bash
mkdir -p "app/(authed)/tasks"
```

```tsx
// app/(authed)/tasks/page.tsx
export default function TasksPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">タスク一覧</h1>
      <p className="text-muted-foreground">
        タスクをここに表示します（第 05・07・08 章で実装）
      </p>
    </div>
  );
}
```

### Step 5：ログイン（`/login`）

`(authed)` の**外**に置くので、サイドバーは付きません。

```bash
mkdir -p app/login
```

```tsx
// app/login/page.tsx
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-2 text-muted-foreground">
          Google でサインインします（第 06 章で実装）
        </p>
      </div>
    </div>
  );
}
```

---

## 3-6. ハンズオン③：動作確認

```bash
pnpm dev
```

| URL | 期待する表示 |
| --- | --- |
| `http://localhost:3000/` | ダッシュボード（**サイドバー＋ヘッダー付き**） |
| `http://localhost:3000/tasks` | タスク一覧（**サイドバー＋ヘッダー付き**） |
| `http://localhost:3000/login` | ログイン（**サイドバーなし**） |

> TRY
> - サイドバーの「Dashboard」「Tasks」をクリックして遷移を確認しましょう。
> - `/login` にだけサイドバーが付かないことを確認しましょう（`(authed)/layout.tsx` が適用されないため）。

<details>
<summary>HINT：`/login` にもサイドバーが表示されてしまう</summary>

`app/login/page.tsx` が `(authed)` の**外**にあるか確認してください。

```
app/
├── (authed)/
│   ├── layout.tsx   ← / と /tasks に適用
│   ├── page.tsx     → /
│   └── tasks/page.tsx → /tasks
└── login/page.tsx   ← (authed) の外
```

</details>

<details>
<summary>HINT：サイドバーが表示されない / import エラーになる</summary>

- 共通シェルは `app/(authed)/components/` に同梱済みです。`import AppSidebar from "./components/AppSidebar";` のパスが正しいか確認してください。
- `SidebarProvider` は `@/components/ui/sidebar` から import します（`(authed)/layout.tsx` で `AppSidebar` を `SidebarProvider` で包む必要があります）。

</details>

---

## 3-7. `<Link>` でページ遷移する

サイドバーのナビゲーションは、すでに **`<Link>`** で実装されています（同梱済みの `AppSidebar`）。

```tsx
// app/(authed)/components/AppSidebar/index.tsx（抜粋）
import Link from "next/link";
// ...
<SidebarMenuButton asChild>
  <Link href={item.url}>
    <item.icon />
    <span>{item.title}</span>
  </Link>
</SidebarMenuButton>
```

> NOTE
> 画面遷移には `<a href="...">` ではなく **`<Link href="...">`** を使います。
> `<Link>` はページ全体をリロードせずクライアントサイドで遷移し、さらにリンク先を**プリフェッチ**するため遷移が高速です。
> `<a>` を使うと毎回フルリロードが発生します。

---

## まとめと次のステップ

この章では以下を学びました：

- `app/` のディレクトリ構造が URL になる
- `layout.tsx` はネストし、外側の器が内側（`children`）を包む
- 実開発の流れに沿って **レイアウト（器）→ ページ（中身）** の順に組む
- `(authed)` ルートグループは URL に影響せず、共通シェルをグループ化する
- 共通シェルは同梱済みの実物を `import` して合成する（この先の章で**同じファイルに追記して育てる**）
- 画面遷移は `<Link>` を使う

次の第 04 章では **Drizzle ORM と SQLite** でデータベースを構築します。

→ [第 04 章：Drizzle + SQLite](./04-drizzle-sqlite.md)
