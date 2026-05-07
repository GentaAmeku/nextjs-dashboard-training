# 第 13 章：仕上げ：Dashboard 統計 + デプロイ準備

## この章の目標

> **CHECK**
> - [ ] ダッシュボードにタスクの統計情報が表示できる
> - [ ] タスクを作成・更新・削除するとダッシュボードの統計も更新される
> - [ ] `pnpm build` が成功する
> - [ ] `pnpm start` で本番サーバーが起動し画面が表示できる

---

## 13-1. ダッシュボードの統計コンポーネントを作る

ダッシュボードには「タスクの総数」「ステータス別件数」「完了率」を表示します。

```bash
mkdir -p "app/(authed)/components/TaskStatistics"
touch "app/(authed)/components/TaskStatistics/index.tsx"
```

```tsx
// app/(authed)/components/TaskStatistics/index.tsx
import { getDashboardStats } from "@/app/actions/dashboard";
import { isErr } from "@/lib/result";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function TaskStatistics() {
  const result = await getDashboardStats();

  if (isErr(result)) {
    return (
      <p className="text-destructive">
        統計の取得に失敗しました: {result.error.message}
      </p>
    );
  }

  const { totalCount, statusCounts, completedCount, completionRate } = result.value;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 総タスク数 */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>タスク総数</CardDescription>
          <CardTitle className="text-3xl">{totalCount}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">全タスク</p>
        </CardContent>
      </Card>

      {/* 完了率 */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>完了率</CardDescription>
          <CardTitle className="text-3xl">{completionRate}%</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {completedCount} / {totalCount} 件完了
          </p>
        </CardContent>
      </Card>

      {/* 未着手 */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>未着手</CardDescription>
          <CardTitle className="text-3xl">{statusCounts.todo ?? 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">todo</p>
        </CardContent>
      </Card>

      {/* 進行中 */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>進行中</CardDescription>
          <CardTitle className="text-3xl">
            {statusCounts.in_progress ?? 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">in progress</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 13-2. ダッシュボードページを完成させる

```tsx
// app/(authed)/page.tsx
import { Suspense } from "react";
import { TaskStatistics } from "./components/TaskStatistics";

// 統計カードのスケルトン（データ取得中に表示）
function StatisticsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: スケルトンは順序が固定
          key={i}
          className="h-28 rounded-xl border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground mt-1">
          タスクの状況をひと目で確認できます
        </p>
      </div>

      {/* Suspense でデータ取得中はスケルトンを表示 */}
      <Suspense fallback={<StatisticsSkeleton />}>
        <TaskStatistics />
      </Suspense>
    </div>
  );
}
```

---

## 13-3. サイドバーとヘッダーを整える

認証済みエリアに必要なレイアウトコンポーネントを作ります。

### AppSidebar

```bash
mkdir -p "app/(authed)/components/AppSidebar"
touch "app/(authed)/components/AppSidebar/index.tsx"
```

```tsx
// app/(authed)/components/AppSidebar/index.tsx
import Link from "next/link";
import { LayoutDashboard, CheckSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LogoutButton } from "./LogoutButton";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/tasks", label: "タスク", icon: CheckSquare },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ログアウトボタン（クライアントコンポーネント）*/}
      <LogoutButton />
    </Sidebar>
  );
}
```

```tsx
// app/(authed)/components/AppSidebar/LogoutButton.tsx
'use client';

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <div className="p-4">
      <Button
        variant="ghost"
        className="w-full justify-start gap-2"
        onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } })}
      >
        <LogOut className="h-4 w-4" />
        ログアウト
      </Button>
    </div>
  );
}
```

### AppHeader

```bash
mkdir -p "app/(authed)/components/AppHeader"
touch "app/(authed)/components/AppHeader/index.tsx"
```

```tsx
// app/(authed)/components/AppHeader/index.tsx
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-14 items-center border-b px-4">
      <SidebarTrigger />
      <span className="ml-4 font-semibold text-sm">Dashboard Playground</span>
    </header>
  );
}
```

### PageContainer

```bash
mkdir -p "app/(authed)/components/PageContainer"
touch "app/(authed)/components/PageContainer/index.tsx"
```

```tsx
// app/(authed)/components/PageContainer/index.tsx
export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-auto p-6">
      {children}
    </main>
  );
}
```

---

## 13-4. shadcn の Sidebar をインストールする

```bash
pnpm dlx shadcn@latest add sidebar
```

> NOTE
> Sidebar コンポーネントは shadcn の中でも複雑なコンポーネントです。
> `components/ui/sidebar.tsx` が生成されるので、詳細はそのファイルを参照してください。

---

## 13-5. 動作確認

```bash
pnpm dev
```

以下を確認します：

1. `http://localhost:3000` にアクセスしてダッシュボードが表示されることを確認
2. タスクの統計カードが表示されることを確認
3. タスクを追加・削除するとダッシュボードの数字も変わることを確認
4. サイドバーの「タスク」リンクから `/tasks` に移動できることを確認
5. ログアウトボタンで `/login` に戻ることを確認

> TRY
> - `pnpm db:seed` でシードデータを投入してから統計を確認しましょう
> - タスクを追加・完了・削除して、完了率が変化することを確認しましょう
> - スマートフォンのサイズにブラウザを縮小して、レイアウトが崩れないか確認しましょう

---

## 13-6. 本番ビルドと起動

```bash
# 本番用ビルド
pnpm build
```

ビルド結果の確認：

```
Route (app)                          Size     First Load JS
┌ ○ /login                          xxxx kB  xxx kB
├ ƒ /                               xxxx kB  xxx kB
├ ƒ /tasks                          xxxx kB  xxx kB
├ ƒ /tasks/[id]/edit                xxxx kB  xxx kB
└ ƒ /tasks/create                   xxxx kB  xxx kB
```

```bash
# 本番サーバーの起動
pnpm start
```

`http://localhost:3000` で本番モードのサーバーが起動します。

---

## 13-7. 完成形の全体チェックリスト

すべての機能が正しく動くか最終確認します：

```
認証
  [ ] Google ログインができる
  [ ] ログアウトができる
  [ ] 未ログイン状態で /tasks にアクセスすると /login にリダイレクトされる

タスク CRUD
  [ ] タスクを作成できる
  [ ] タスク一覧が表示される
  [ ] タスクを編集できる
  [ ] タスクを削除できる（ダイアログが表示される）

フィルタリング
  [ ] 名前で検索できる
  [ ] ステータスで絞り込みできる
  [ ] 優先度で絞り込みできる
  [ ] URL にフィルタ条件が反映される
  [ ] ページをリロードしてもフィルタが保持される

ダッシュボード
  [ ] タスク総数が表示される
  [ ] 完了率が表示される
  [ ] ステータス別の件数が表示される
  [ ] タスクを変更するとダッシュボードの数字も即更新される

テスト
  [ ] pnpm test ですべてのテストが通る
  [ ] pnpm lint でエラーが出ない

本番ビルド
  [ ] pnpm build が成功する
  [ ] pnpm start でサーバーが起動する
```

---

## 13-8. お疲れさまでした

この研修を通じて、以下をゼロから実装しました：

| 機能                     | 使った技術                              |
| ------------------------ | --------------------------------------- |
| ルーティングとレイアウト | Next.js App Router・ルートグループ      |
| UI コンポーネント        | Tailwind CSS v4・shadcn/ui              |
| データベース             | Drizzle ORM・SQLite                     |
| エラー処理               | Result<T> 型・AppError                 |
| バリデーション           | Zod・drizzle-zod                        |
| フォーム送信             | Server Actions・useActionState          |
| クライアントフォーム     | react-hook-form・zodResolver            |
| 認証                     | Better Auth・Google OAuth               |
| キャッシュ制御           | Cache Components・cacheTag・updateTag   |
| URL 状態管理             | nuqs                                    |
| クライアント状態管理     | Zustand                                 |
| テスト                   | Vitest・:memory: SQLite・vi.mock       |
| コード品質               | Biome・Lefthook                         |
| 高速化                   | React Compiler・Turbopack               |

### 次のステップ（自主学習）

このリポジトリを完成させたあと、さらに挑戦してみましょう：

- **Turso + Vercel へのデプロイ**：SQLite ファイルを [Turso](https://turso.tech)（分散 SQLite サービス）に移行して、Vercel にデプロイする
- **優先度別統計の追加**：ダッシュボードに優先度別の統計カードを追加する
- **タスクのソート**：一覧のソート順（作成日・更新日・優先度）を切り替えられるようにする
- **E2E テスト**：Playwright で画面の自動テストを追加する
- **ページネーション**：タスクが増えたときのページング機能を追加する

---

→ [研修の最初に戻る](./README.md)
