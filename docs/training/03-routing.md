# 第 03 章：App Router・layout・ルートグループ

## この章の目標

> **CHECK**
> - [ ] `app/` ディレクトリの構造と URL の対応を説明できる
> - [ ] `layout.tsx` が何をしているか説明できる
> - [ ] ルートグループ `(authed)` の意味を説明できる
> - [ ] `/login`・`/`・`/tasks` の 3 画面が存在し、`(authed)` グループの共通レイアウトが表示できる

---

## 3-1. App Router の基本：ファイルで URL を決める

Next.js App Router では、**`app/` 以下のディレクトリ構造が URL になります**。

```
app/
├── page.tsx           → http://localhost:3000/
├── login/
│   └── page.tsx       → http://localhost:3000/login
└── tasks/
    ├── page.tsx        → http://localhost:3000/tasks
    ├── create/
    │   └── page.tsx    → http://localhost:3000/tasks/create
    └── [id]/
        └── edit/
            └── page.tsx → http://localhost:3000/tasks/123/edit
```

### 特別なファイル名

| ファイル名       | 役割                                           |
| ---------------- | ---------------------------------------------- |
| `page.tsx`       | そのパスの画面を定義する（必須）               |
| `layout.tsx`     | 複数ページで共有するレイアウト                 |
| `loading.tsx`    | データ取得中に表示するローディング UI          |
| `error.tsx`      | エラー時に表示する UI                          |
| `not-found.tsx`  | 404 時に表示する UI                            |

---

## 3-2. `layout.tsx` のネスト構造

`layout.tsx` は**ネスト（入れ子）** して使います。

```
app/
├── layout.tsx                    ← ルートレイアウト（全ページ共通）
│   └── (authed)/
│       ├── layout.tsx            ← 認証必須エリアのレイアウト
│       │   ├── page.tsx          ← / （ダッシュボード）
│       │   └── tasks/
│       │       └── page.tsx      ← /tasks
│       └── ...
└── login/
    └── page.tsx                  ← /login（レイアウトなし）
```

レンダリングの仕組み：

```
ルートレイアウト（app/layout.tsx）
  ↓ children として
  認証レイアウト（app/(authed)/layout.tsx）
    ↓ children として
    ページ（app/(authed)/tasks/page.tsx）
```

---

## 3-3. ルートグループ `(authed)` とは

`(authed)` のようにカッコで囲んだディレクトリは **ルートグループ** と呼ばれます。

```
(authed)/         ← URL には影響しない
└── tasks/
    └── page.tsx  → /tasks（URL に "authed" は入らない）
```

**URL には影響せず、ディレクトリをグループ化するだけの仕組み**です。

なぜ使うかというと、**グループ内のページだけに共通の `layout.tsx` を適用できる**からです。

```
app/
├── (authed)/
│   ├── layout.tsx  ← /と/tasksにだけ適用される認証チェック付きレイアウト
│   ├── page.tsx    → /
│   └── tasks/
│       └── page.tsx → /tasks
└── login/
    └── page.tsx    → /login（上の layout.tsx は適用されない）
```

---

## 3-4. このプロジェクトのレイアウト構成を読む

### ルートレイアウト（`app/layout.tsx`）

```bash
cat app/layout.tsx
```

```tsx
// app/layout.tsx の役割：
// - フォントの設定（Geist など）
// - <html> と <body> タグ
// - NuqsAdapter（URL 状態管理のプロバイダ）でアプリ全体を包む
// - グローバル CSS の読み込み

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Dashboard Playground",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={geist.variable}>
        <NuqsAdapter shallow={false}>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

### 認証レイアウト（`app/(authed)/layout.tsx`）

```bash
cat "app/(authed)/layout.tsx"
```

このファイルには 2 つの重要な役割があります：

**① `AuthGate`：DB でセッションを検証する**

```tsx
// AuthGate は (authed)/layout.tsx の中に定義されている
async function AuthGate({ children }: { children: React.ReactNode }) {
  // サーバーサイドでセッションを DB から取得する
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    // DB にセッションが無ければ /login へリダイレクト
    redirect("/login");
  }

  return <>{children}</>;
}
```

**② サイドバー + ヘッダー + コンテンツエリアの共通レイアウト**

```tsx
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>          {/* AuthGate の非同期処理をストリームできるようにする */}
      <AuthGate>
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <AppHeader />
            <PageContainer>{children}</PageContainer>
          </div>
        </SidebarProvider>
      </AuthGate>
    </Suspense>
  );
}
```

> NOTE
> `<Suspense>` で `AuthGate` を包むことで、セッション取得中もページ全体がブロックされなくなります。
> これにより、Next.js のストリーミングレンダリングが有効になります。

---

## 3-5. ハンズオン：3 画面を作る

### Step 1：ルートレイアウトを作る

`app/layout.tsx` を以下のように書きます：

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Dashboard Playground",
  description: "Next.js ダッシュボード学習プロジェクト",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geist.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### Step 2：ログインページを作る

```bash
mkdir -p app/login
```

```tsx
// app/login/page.tsx
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">ログイン</h1>
        <p className="text-muted-foreground">Google でサインインしてください</p>
        {/* 第 08 章で Google ボタンを追加します */}
        <button
          type="button"
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Google でログイン（準備中）
        </button>
      </div>
    </div>
  );
}
```

### Step 3：認証必須エリアを作る

```bash
# ルートグループのディレクトリを作成（カッコ付き）
mkdir -p "app/(authed)"
```

> NOTE
> ディレクトリ名にカッコが含まれるので、`mkdir` コマンドではクォートで囲みます。

```tsx
// app/(authed)/layout.tsx（最小限の実装）
// 第 08 章で認証チェックを追加します
export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* サイドバー（第 03 章後半で追加） */}
      <nav className="w-64 bg-sidebar p-4 border-r border-sidebar-border">
        <p className="font-bold text-sidebar-foreground">Dashboard</p>
        <ul className="mt-4 space-y-2">
          <li>
            <a href="/" className="text-sm text-sidebar-foreground hover:underline">
              ホーム
            </a>
          </li>
          <li>
            <a href="/tasks" className="text-sm text-sidebar-foreground hover:underline">
              タスク
            </a>
          </li>
        </ul>
      </nav>
      {/* メインコンテンツ */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

### Step 4：ダッシュボードページ（`/`）を作る

```tsx
// app/(authed)/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      <p className="text-muted-foreground">
        タスク統計がここに表示されます（第 13 章で実装）
      </p>
    </div>
  );
}
```

### Step 5：タスク一覧ページ（`/tasks`）を作る

```bash
mkdir -p "app/(authed)/tasks"
```

```tsx
// app/(authed)/tasks/page.tsx
export default function TasksPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">タスク一覧</h1>
      <p className="text-muted-foreground">
        タスクがここに表示されます（第 05〜07 章で実装）
      </p>
    </div>
  );
}
```

### Step 6：動作確認

```bash
pnpm dev
```

以下の URL にアクセスして確認します：

- `http://localhost:3000/` → ダッシュボード（サイドバー付き）
- `http://localhost:3000/login` → ログイン画面
- `http://localhost:3000/tasks` → タスク一覧（サイドバー付き）

> TRY
> - サイドバーのリンクをクリックして画面遷移することを確認しましょう
> - `/login` にはサイドバーが表示されないことを確認しましょう（`(authed)/layout.tsx` が適用されないため）

<details>
<summary>HINT：`/login` にもサイドバーが表示されてしまう場合</summary>

`app/login/page.tsx` が `app/(authed)/layout.tsx` と **同じネスト階層にない**か確認してください。

正しい構造：
```
app/
├── (authed)/
│   ├── layout.tsx   ← /と/tasksに適用
│   ├── page.tsx     → /
│   └── tasks/
│       └── page.tsx → /tasks
└── login/           ← (authed) の外に出す
    └── page.tsx     → /login
```

</details>

---

## 3-6. 動的ルートと `searchParams`

このプロジェクトでは以下の動的ルートが使われています。

### 動的セグメント `[id]`

```
app/(authed)/tasks/[id]/edit/page.tsx → /tasks/123/edit
```

`params` として ID を受け取ります：

```tsx
// app/(authed)/tasks/[id]/edit/page.tsx
export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;  // Next.js 16 では Promise
  return <div>タスク {id} を編集</div>;
}
```

> NOTE
> Next.js 16 では `params` と `searchParams` が `Promise<...>` になりました。
> 必ず `await` してから使います。

### `searchParams`（URL クエリパラメータ）

```
/tasks?name=会議&status=in_progress
```

```tsx
// page.tsx で searchParams を受け取る
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; status?: string }>;
}) {
  const { name, status } = await searchParams;
  // ...
}
```

---

## 3-7. `Link` コンポーネントでページ遷移する

```tsx
import Link from "next/link";

// <a> タグの代わりに Link を使う
// → ページ全体のリロードなしにクライアントサイドで遷移する
<Link href="/tasks">タスク一覧へ</Link>
<Link href={`/tasks/${task.id}/edit`}>編集</Link>
```

> NOTE
> Next.js では `<a href="...">` の代わりに `<Link href="...">` を使うことを推奨しています。
> `Link` はプリフェッチ（事前読み込み）も行うため、遷移が素早くなります。

---

## まとめと次のステップ

この章では以下を学びました：

- `app/` のディレクトリ構造が URL になる
- `layout.tsx` はネストして共通レイアウトを定義する
- `(authed)` ルートグループは URL に影響せずレイアウトをグループ化する
- `[id]` で動的セグメント、`searchParams` でクエリパラメータを受け取る

次の第 04 章では **Drizzle ORM と SQLite** を使ってデータベースを構築します。タスクテーブルのスキーマを定義し、実際にデータを操作します。

→ [第 04 章：Drizzle + SQLite](./04-drizzle-sqlite.md)
