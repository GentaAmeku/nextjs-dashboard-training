# 第 09 章：Cache Components

## この章の目標

> **CHECK**
> - [ ] `"use cache"` の仕組みを説明できる
> - [ ] `cacheTag` と `updateTag` の使い方を説明できる
> - [ ] `CACHE_TAGS` 定数を定義できる
> - [ ] タスク作成・更新・削除後に一覧ページが自動で更新される
> - [ ] `auth.api.getSession()` をキャッシュしてはいけない理由を説明できる

---

## 9-1. Next.js のキャッシュの仕組み

Next.js は高速化のためにレスポンスをキャッシュします。しかしキャッシュのせいで「データを更新したのに画面に反映されない」という問題が起きることがあります。

このプロジェクトでは **Cache Components**（`"use cache"` ディレクティブ）を使って、**キャッシュの対象と更新のタイミングを明示的に制御**します。

```
┌─────────────────────────────────────┐
│          "use cache" 関数           │
│                                     │
│  最初の呼び出し: DB からデータ取得  │
│  次回以降: キャッシュから返す       │
│                                     │
│  updateTag("tasks") を呼ぶと:       │
│  そのタグのキャッシュが無効化される │
│  → 次回は DB から再取得             │
└─────────────────────────────────────┘
```

---

## 9-2. `"use cache"` ディレクティブ

`"use cache"` はファイル先頭か関数の先頭に書くディレクティブです。

```typescript
// ファイル全体をキャッシュ対象にする
'use cache';

export async function getTasks() {
  // この関数は最初の呼び出し結果をキャッシュする
  return db.select().from(tasks);
}
```

```typescript
// 特定の関数だけキャッシュする
export async function getTasks() {
  'use cache'; // 関数の先頭に書く
  cacheTag(CACHE_TAGS.TASKS);
  return db.select().from(tasks);
}
```

> NOTE
> `"use cache"` は Next.js 16 の実験的機能です（`next.config.ts` の `cacheComponents: true` で有効化）。
> React の `"use client"` / `"use server"` と同じ「ディレクティブ」の仕組みです。

---

## 9-3. `cacheTag` と `updateTag`

| 関数              | 役割                                           |
| ----------------- | ---------------------------------------------- |
| `cacheTag(tag)`   | キャッシュに名前（タグ）をつける               |
| `updateTag(tag)`  | そのタグのキャッシュを無効化する               |

```typescript
// 読み取り：キャッシュにタグをつける
export async function getTasks() {
  'use cache';
  cacheTag(CACHE_TAGS.TASKS);  // "tasks" タグをつける
  return taskRepository.getAll();
}

// 書き込み：キャッシュを無効化する
export async function createTask(...) {
  'use server';
  // ... DB に保存 ...
  updateTag(CACHE_TAGS.TASKS);     // "tasks" タグのキャッシュを無効化
  updateTag(CACHE_TAGS.DASHBOARD); // "dashboard" タグのキャッシュも無効化
  redirect("/tasks");
}
```

---

## 9-4. キャッシュタグ定数を定義する

```bash
mkdir -p lib/cache
touch lib/cache/tags.ts
```

```typescript
// lib/cache/tags.ts
// キャッシュタグを一元管理する定数
export const CACHE_TAGS = {
  TASKS: "tasks",
  DASHBOARD: "dashboard",
} as const;
```

> NOTE
> タグ文字列をハードコードすると typo のリスクがあります。
> 定数として一か所で管理することで、補完が効き typo も防げます。

---

## 9-5. Server Actions にキャッシュ更新を追加する

第 07 章で作った `tasks.ts` を更新して、キャッシュの無効化を追加します。

```typescript
// app/(authed)/tasks/actions/tasks.ts
'use server';

import { cacheTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { isErr } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Task } from "@/lib/db/schema";
import { taskService } from "@/lib/db/services/task-service";
import { createTaskSchema } from "@/lib/db/schema";
import { zodErrorToAppError } from "@/lib/errors";
import { CACHE_TAGS } from "@/lib/cache/tags";

// ── タスク取得（キャッシュあり）──────────────────────────────────

export async function getTasks(query?: {
  name?: string;
  status?: string;
  priority?: string;
}): Promise<Result<Task[]>> {
  'use cache';               // この関数の結果をキャッシュする
  cacheTag(CACHE_TAGS.TASKS); // "tasks" タグをつける

  return taskService.getTasksByQuery(query ?? {});
}

export async function getTaskById(id: number): Promise<Result<Task>> {
  'use cache';
  cacheTag(CACHE_TAGS.TASKS);

  return taskService.getTaskById(id);
}

// ── キャッシュ無効化ヘルパー ──────────────────────────────────────

// タスク変更後に呼ぶ：タスク一覧とダッシュボードのキャッシュを無効化
function updateTasksCache() {
  updateTag(CACHE_TAGS.TASKS);
  updateTag(CACHE_TAGS.DASHBOARD);
}

// ── タスク作成 ────────────────────────────────────────────────────

export async function createTask(
  _prevState: Result<Task> | null,
  formData: FormData,
): Promise<Result<Task>> {
  const rawData = Object.fromEntries(formData.entries());
  const parseResult = createTaskSchema.safeParse(rawData);

  if (!parseResult.success) {
    return { ok: false, error: zodErrorToAppError(parseResult.error) };
  }

  const result = await taskService.createTask(parseResult.data);
  if (isErr(result)) return result;

  // キャッシュを無効化してから一覧へ戻る
  updateTasksCache();
  redirect("/tasks");
}

// ── タスク更新 ────────────────────────────────────────────────────

export async function updateTask(
  _prevState: Result<Task> | null,
  formData: FormData,
): Promise<Result<Task>> {
  const id = Number(formData.get("id"));
  const rawData = Object.fromEntries(formData.entries());

  const result = await taskService.updateTask(id, rawData);
  if (isErr(result)) return result;

  updateTasksCache();
  redirect("/tasks");
}

// ── タスク削除 ────────────────────────────────────────────────────

export async function deleteTask(id: number): Promise<Result<void>> {
  const result = await taskService.deleteTask(id);
  if (isErr(result)) return result;

  updateTasksCache();
  redirect("/tasks");
}
```

---

## 9-6. ダッシュボードの統計もキャッシュ管理する

ダッシュボード用の Server Actions も同様に定義します。

```bash
touch "app/actions/dashboard.ts"
```

```typescript
// app/actions/dashboard.ts
'use server';

import { cacheTag } from "next/cache";
import { isErr } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Status } from "@/lib/db/schema";
import { taskRepository } from "@/lib/db/repositories/task-repository";
import { CACHE_TAGS } from "@/lib/cache/tags";

// 統計データの型
export type DashboardStats = {
  totalCount: number;
  statusCounts: Record<Status, number>;
  completedCount: number;
  completionRate: number;
};

export async function getDashboardStats(): Promise<Result<DashboardStats>> {
  'use cache';
  cacheTag(CACHE_TAGS.DASHBOARD); // "dashboard" タグをつける

  const totalResult = await taskRepository.getTotalCount();
  const statusResult = await taskRepository.getStatusCounts();
  const completedResult = await taskRepository.getCompletedCount();

  if (isErr(totalResult)) return totalResult;
  if (isErr(statusResult)) return statusResult;
  if (isErr(completedResult)) return completedResult;

  const total = totalResult.value;
  const completionRate = total > 0
    ? Math.round((completedResult.value / total) * 100)
    : 0;

  return {
    ok: true,
    value: {
      totalCount: total,
      statusCounts: statusResult.value,
      completedCount: completedResult.value,
      completionRate,
    },
  };
}
```

---

## 9-7. タスク一覧ページでキャッシュを使う

```tsx
// app/(authed)/tasks/page.tsx を更新
import { getTasks } from "./actions/tasks";
import { isErr } from "@/lib/result";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// コンテナ：データ取得を担う（Suspense の中に入れる）
async function TaskListContainer({
  searchParams,
}: {
  searchParams: { name?: string; status?: string; priority?: string };
}) {
  const result = await getTasks(searchParams);

  if (isErr(result)) {
    return <p className="text-destructive">エラー: {result.error.message}</p>;
  }

  const tasks = result.value;

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div>
            <p className="font-medium">{task.name}</p>
            <p className="text-sm text-muted-foreground">
              {task.status} · {task.priority}
            </p>
          </div>
          <Link
            href={`/tasks/${task.id}/edit`}
            className="text-sm text-primary hover:underline"
          >
            編集
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; status?: string; priority?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">タスク一覧</h1>
        <Button asChild>
          <Link href="/tasks/create">タスクを作成</Link>
        </Button>
      </div>

      {/* Suspense でローディング中の表示を制御 */}
      <Suspense fallback={<p className="text-muted-foreground">読み込み中...</p>}>
        <TaskListContainer searchParams={params} />
      </Suspense>
    </div>
  );
}
```

---

## 9-8. 動作確認

```bash
pnpm dev
```

1. `/tasks` を開く
2. `/tasks/create` でタスクを作成する
3. `/tasks` に戻る → **新しいタスクが即座に表示されることを確認**

> NOTE
> キャッシュが更新されていない場合は、`updateTag` の呼び出しが Server Action 内にあるか確認してください。
> `updateTag` は必ず `'use server'` のコンテキスト内で呼ぶ必要があります。

---

## 9-9. なぜ `getSession` をキャッシュしてはいけないのか

`"use cache"` でセッション取得をキャッシュすると**セッション漏洩のリスク**があります。

```typescript
// ❌ 絶対にやってはいけない
export async function getSession() {
  'use cache';
  return auth.api.getSession({ headers: await headers() });
  // → ユーザー A のリクエストのセッションが
  //   ユーザー B のリクエストで返ってくる可能性がある！
}

// ✅ 正しい実装（AuthGate での実装）
async function AuthGate({ children }) {
  // キャッシュしない（毎回 DB に問い合わせる）
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  // ...
}
```

リクエストスコープの値（ヘッダー・Cookie）はキャッシュに含めてはいけません。

---

## まとめと次のステップ

この章では以下を学びました：

- `"use cache"` でサーバー関数の結果をキャッシュする
- `cacheTag(tag)` でキャッシュに名前をつける
- `updateTag(tag)` でタスク変更後にキャッシュを無効化する
- `CACHE_TAGS` 定数で一元管理してタイポを防ぐ
- `auth.api.getSession()` はリクエストスコープの値を含むためキャッシュ禁止

次の第 10 章では **nuqs** で URL にフィルタ状態を保持し、**Zustand** で削除ダイアログのクライアント状態を管理します。

→ [第 10 章：nuqs + Zustand](./10-nuqs-zustand.md)
