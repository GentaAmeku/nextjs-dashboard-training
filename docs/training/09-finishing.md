# 第 09 章：仕上げ：Dashboard 統計 + デプロイ準備

## この章の目標

> **CHECK**
> - [ ] ダッシュボードにタスク統計（総数・ステータス別・優先度別・完了率）を表示できる
> - [ ] タスクを作成・更新・削除すると統計も更新される（キャッシュ無効化）
> - [ ] 各統計カードが `Suspense` で個別にストリーミングされる仕組みを説明できる
> - [ ] `pnpm build` が成功する
> - [ ] `pnpm start` で本番サーバーが起動し画面が表示できる

---

> 共通シェル（サイドバー・ヘッダー）は第 03 章で、認証（`AuthGate`・ユーザー情報・ログアウト）は第 06 章で、キャッシュ（`"use cache"` / `updateTag`）は第 07 章で完成済みです。
> この章では残りの **ダッシュボード統計** を実装し、**本番ビルド** まで仕上げます。

---

## 9-1. 統計用の Server Actions（`app/actions/dashboard.ts`）

ダッシュボードに表示する数値を取得する Server Actions を用意します。第 07 章で学んだ `"use cache"` と `cacheTag(CACHE_TAGS.DASHBOARD)` を付け、タスク変更時（第 07 章の `updateTasksCache()`）にまとめて無効化されるようにします。

```typescript
// app/actions/dashboard.ts
"use server";

import { cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { taskService } from "@/lib/db/services/task-service";
import type { Result } from "@/lib/result";

export const getTotalTaskCount = async (): Promise<Result<number>> => {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  return taskService.getTotalCount();
};

export const getStatusCounts = async (): Promise<
  Result<Record<string, number>>
> => {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  return taskService.getStatusCounts();
};

export const getPriorityCounts = async (): Promise<
  Result<Record<string, number>>
> => {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  return taskService.getPriorityCounts();
};

export const getCompletedTaskCount = async (): Promise<Result<number>> => {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  return taskService.getCompletedCount();
};
```

> NOTE
> 統計を**4 つに分けて**取得しているのは、次の `TaskStatistics` で**カードごとに `Suspense`** を張り、遅いカードが他のカードの表示をブロックしないようにするためです。

---

## 9-2. 統計コンポーネントを作る

ダッシュボードの統計は、`TaskStatistics`（4 枚のカードを並べる器）＋各カード（`TotalTaskCount` / `StatusCounts` / `PriorityCounts` / `CompletionRate`）で構成します。各カードは **async な Server Component** で、対応する Server Action を呼びます。

> [!TIP]
> **カードのマークアップは完成系からコピーして OK です。** ここで理解したいのは「カードごとに `Suspense` を張って個別にストリーミングする」構成です。
>
> ```bash
> git show answer/main:app/\(authed\)/components/TaskStatistics/index.tsx
> git show answer/main:app/\(authed\)/components/TaskStatistics/TotalTaskCount.tsx
> git show answer/main:app/\(authed\)/components/TaskStatistics/StatusCounts.tsx
> git show answer/main:app/\(authed\)/components/TaskStatistics/PriorityCounts.tsx
> git show answer/main:app/\(authed\)/components/TaskStatistics/CompletionRate.tsx
> ```

### 器：`TaskStatistics`

```tsx
// app/(authed)/components/TaskStatistics/index.tsx
import { Suspense } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import CompletionRate from "./CompletionRate";
import PriorityCounts from "./PriorityCounts";
import StatusCounts from "./StatusCounts";
import TotalTaskCount from "./TotalTaskCount";

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-32 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-16" />
      </CardContent>
    </Card>
  );
}

export default function TaskStatistics() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* カードごとに Suspense → 取得が速いカードから順に表示される */}
      <Suspense fallback={<CardSkeleton />}>
        <TotalTaskCount />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <StatusCounts />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <PriorityCounts />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <CompletionRate />
      </Suspense>
    </div>
  );
}
```

### カードの例：`TotalTaskCount`

各カードは Server Action を呼び、`isErr` でエラーを処理してから値を表示します（残り 3 つも同じ形）。

```tsx
// app/(authed)/components/TaskStatistics/TotalTaskCount.tsx
import { getTotalTaskCount } from "@/app/actions/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isErr } from "@/lib/result";

export default async function TotalTaskCount() {
  const result = await getTotalTaskCount();

  if (isErr(result)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>総タスク数</CardTitle>
          <CardDescription>すべてのタスクの合計</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive text-sm">
            エラー: {result.error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>総タスク数</CardTitle>
        <CardDescription>すべてのタスクの合計</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{result.value}</div>
      </CardContent>
    </Card>
  );
}
```

> `StatusCounts` / `PriorityCounts` / `CompletionRate` も同じパターンです。マークアップは完成系からコピーしてください。

---

## 9-3. ダッシュボードページに組み込む

第 03 章でプレースホルダにしておいた `app/(authed)/page.tsx` に `TaskStatistics` を差し込みます。

```tsx
// app/(authed)/page.tsx
import TaskStatistics from "./components/TaskStatistics";

export default function Home() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">タスクの統計情報を確認できます</p>
      </div>
      <TaskStatistics />
    </div>
  );
}
```

> NOTE
> `Home` 自体は `async` ではありません。データ取得は各カード（`TotalTaskCount` など）が担い、`TaskStatistics` 内の `Suspense` でストリーミングされます。

---

## 9-4. 動作確認

```bash
pnpm dev
```

1. `http://localhost:3000/` を開き、統計カードが表示されることを確認
2. `/tasks` でタスクを作成・完了・削除する
3. `/` に戻り、数字（総数・完了率など）が更新されていることを確認（第 07 章のキャッシュ無効化が効いている）

> TRY
> - `pnpm db:seed` 後に統計を確認しましょう。
> - ネットワークを遅くして（DevTools → Network → Slow）、カードが**1 枚ずつ**現れることを確認しましょう（カードごと `Suspense`）。

---

## 9-5. 本番ビルドと起動

```bash
pnpm build
```

```bash
pnpm start
# → http://localhost:3000 で本番モードのサーバーが起動
```

> NOTE
> `ƒ (Dynamic)` と表示されるルートは、リクエストのたびに Server Component が実行されます。
> `(authed)` 配下が動的になるのは、`AuthGate` が `headers()` を使うためです。

---

## 9-6. 完成形チェックリスト

```
認証
  [ ] Google ログイン / ログアウトができる
  [ ] 未ログインで /tasks にアクセスすると /login にリダイレクトされる

タスク CRUD
  [ ] 作成・一覧・編集・削除ができる（削除はダイアログ）

フィルタリング
  [ ] 名前 / ステータス / 優先度で絞り込め、URL に反映され、リロードで保持される

ダッシュボード
  [ ] 総数・ステータス別・優先度別・完了率が表示される
  [ ] タスク変更で統計が即更新される

本番ビルド
  [ ] pnpm build が成功する
  [ ] pnpm start でサーバーが起動する
```

---

## 9-7. お疲れさまでした

主要機能をひととおり実装しました。次の第 10 章では、見た目の仕上げとして**テーマ切り替え**を導入します。

| 機能                     | 使った技術                            |
| ------------------------ | ------------------------------------- |
| ルーティング・レイアウト | App Router・ルートグループ            |
| UI                       | Tailwind CSS v4・shadcn/ui            |
| データベース             | Drizzle ORM・SQLite                   |
| エラー処理               | `Result<T>` 型・AppError              |
| フォーム                 | Server Actions・useActionState・RHF   |
| 認証                     | Better Auth・Google OAuth             |
| キャッシュ               | Cache Components・cacheTag・updateTag |
| URL 状態 / クライアント状態 | nuqs・Zustand                      |

→ [第 10 章：テーマを導入してみよう](./10-theme.md)

---

## 完成イメージ

![ダッシュボード（統計カード）](../assets/09-dashboard.png)
![タスク行アクションメニュー](../assets/09-tasks-menu.png)
