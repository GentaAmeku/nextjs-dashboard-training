# 第 10 章：nuqs + Zustand

## この章の目標

> **CHECK**
> - [ ] nuqs を使ってフィルタ条件が URL のクエリパラメータに乗る
> - [ ] ページをリロードしてもフィルタが保持される
> - [ ] Server と Client で同じパーサー定義を共有している
> - [ ] Zustand で削除ダイアログの open/close 状態を管理できる

---

## 10-1. URL 状態管理とは

「検索条件やフィルタを URL のクエリパラメータに入れる」という設計のことです。

```
http://localhost:3000/tasks?name=会議&status=in_progress&priority=high
                            ^^^^^^^^ ^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^
                            検索ワード  ステータス絞り込み  優先度絞り込み
```

**なぜ URL に状態を入れるのか：**

- ブラウザの「戻る」ボタンで前のフィルタ状態に戻れる
- URL を共有すれば、同じフィルタが適用された状態を共有できる
- ページをリロードしても状態が保持される

---

## 10-2. nuqs とは

[nuqs](https://nuqs.47ng.com) は Next.js の URL クエリパラメータを簡単に管理できるライブラリです。

```bash
pnpm add nuqs
```

nuqs の特長：
- **型安全**：クエリパラメータを TypeScript の型で管理できる
- **Server Component 対応**：サーバー側でも同じパーサー定義を使える
- **`useState` のような使い心地**：`[value, setValue]` で直感的に扱える

---

## 10-3. `NuqsAdapter` のセットアップ

ルートレイアウトに `NuqsAdapter` を追加します。

```tsx
// app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* nuqs のアダプタでアプリ全体を包む */}
        <NuqsAdapter shallow={false}>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

> NOTE
> `shallow={false}` は URL の変更時に Next.js のルーター経由で遷移する設定です。
> これにより、URL が変わったときに Server Component が再実行されてデータが再取得されます。

---

## 10-4. クエリパラメータの型定義（Server / Client 共通）

Server と Client の両方で同じパーサー定義を共有します。

```bash
mkdir -p "app/(authed)/tasks/lib/nuqs"
touch "app/(authed)/tasks/lib/nuqs/searchParams.ts"
```

```typescript
// app/(authed)/tasks/lib/nuqs/searchParams.ts
import { createSearchParamsCache, parseAsString, parseAsStringLiteral } from "nuqs/server";

// ステータスとして有効な値の配列
const statusValues = ["todo", "in_progress", "done"] as const;
const priorityValues = ["low", "medium", "high"] as const;

// クエリパラメータのパーサー定義
// Server Component と Client Component の両方でこれを使う
export const searchParamsParsers = {
  name: parseAsString.withDefault(""),
  status: parseAsStringLiteral(statusValues).withDefault("" as const),
  priority: parseAsStringLiteral(priorityValues).withDefault("" as const),
};

// Server Component で searchParams を型安全に使うためのキャッシュ
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
```

> NOTE
> `searchParamsParsers` を1か所で定義することで：
> - Server 側と Client 側でパーサーが一致することが保証される
> - `"todo" | "in_progress" | "done"` という型が自動で付く

---

## 10-5. Server Component でクエリパラメータを使う

```tsx
// app/(authed)/tasks/components/TaskList/container.tsx
import { searchParamsCache } from "../../lib/nuqs/searchParams";
import { getTasks } from "../../actions/tasks";
import { isErr } from "@/lib/result";
import { TaskListPresentation } from "./presentation";

type Props = {
  // page.tsx から searchParams を受け取る
  searchParams: Record<string, string | string[] | undefined>;
};

export async function TaskListContainer({ searchParams }: Props) {
  // searchParamsCache で型安全にパース
  const { name, status, priority } = searchParamsCache.parse(searchParams);

  // パースした値でデータを取得
  const result = await getTasks({
    name: name || undefined,
    status: (status as string) || undefined,
    priority: (priority as string) || undefined,
  });

  if (isErr(result)) {
    return <p className="text-destructive">エラー: {result.error.message}</p>;
  }

  return <TaskListPresentation tasks={result.value} />;
}
```

---

## 10-6. Client Component でフィルタ UI を作る

```tsx
// app/(authed)/tasks/components/TaskFilters/index.tsx
'use client';

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { searchParamsParsers } from "../../lib/nuqs/searchParams";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TaskFilters() {
  const [isPending, startTransition] = useTransition();

  // searchParamsParsers を使って URL と状態を同期する
  const [{ name, status, priority }, setSearchParams] = useQueryStates(
    searchParamsParsers,
    {
      // 変更をトランジション内で行う（UI がブロックされない）
      startTransition,
      shallow: false,  // URL 変更 → Server Component が再実行される
    },
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* 名前検索 */}
      <Input
        placeholder="タスク名で検索..."
        value={name}
        onChange={(e) =>
          setSearchParams({ name: e.target.value || null })
        }
        className="sm:max-w-xs"
      />

      {/* ステータスフィルタ */}
      <select
        value={status}
        onChange={(e) =>
          setSearchParams({ status: (e.target.value as typeof status) || null })
        }
        className="border border-input rounded-md px-3 py-2 text-sm"
      >
        <option value="">すべてのステータス</option>
        <option value="todo">未着手</option>
        <option value="in_progress">進行中</option>
        <option value="done">完了</option>
      </select>

      {/* 優先度フィルタ */}
      <select
        value={priority}
        onChange={(e) =>
          setSearchParams({ priority: (e.target.value as typeof priority) || null })
        }
        className="border border-input rounded-md px-3 py-2 text-sm"
      >
        <option value="">すべての優先度</option>
        <option value="low">低</option>
        <option value="medium">中</option>
        <option value="high">高</option>
      </select>

      {/* フィルタをリセット */}
      {(name || status || priority) && (
        <Button
          variant="ghost"
          onClick={() =>
            setSearchParams({ name: null, status: null, priority: null })
          }
          disabled={isPending}
        >
          リセット
        </Button>
      )}
    </div>
  );
}
```

---

## 10-7. `page.tsx` でフィルタとリストを組み合わせる

```tsx
// app/(authed)/tasks/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskFilters } from "./components/TaskFilters";
import { TaskListContainer } from "./components/TaskList/container";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">タスク一覧</h1>
        <Button asChild>
          <Link href="/tasks/create">タスクを作成</Link>
        </Button>
      </div>

      {/* クライアントコンポーネント（URL と状態を同期） */}
      <TaskFilters />

      {/* サーバーコンポーネント（URL パラメータでデータ取得） */}
      <Suspense fallback={<p className="text-muted-foreground">読み込み中...</p>}>
        <TaskListContainer searchParams={params} />
      </Suspense>
    </div>
  );
}
```

---

## 10-8. Zustand とは

[Zustand](https://zustand.docs.pmnd.rs) は軽量なクライアント状態管理ライブラリです。

このプロジェクトでは**削除ダイアログの開閉状態**だけを Zustand で管理しています。

**なぜ Zustand を使うのか：**

- 削除ダイアログは「どのタスクを削除するか」という情報をグローバルに持ちたい
- `TaskList` の各行から「削除ボタン」をクリック → `DeleteTaskDialog` が開く
- この 2 つのコンポーネントは親子でないため、`props` での受け渡しが難しい

---

## 10-9. Zustand ストアを作る

```bash
mkdir -p "app/(authed)/tasks/stores"
touch "app/(authed)/tasks/stores/delete-task-dialog-store.ts"
```

```typescript
// app/(authed)/tasks/stores/delete-task-dialog-store.ts
'use client';

import { create } from "zustand";

type DeleteTaskDialogState = {
  isOpen: boolean;
  taskId: number | null;
  taskName: string;
  open: (taskId: number, taskName: string) => void;
  close: () => void;
};

// Zustand ストアを作成する
export const useDeleteTaskDialogStore = create<DeleteTaskDialogState>((set) => ({
  isOpen: false,
  taskId: null,
  taskName: "",

  // ダイアログを開く（削除するタスクの情報を設定する）
  open: (taskId, taskName) =>
    set({ isOpen: true, taskId, taskName }),

  // ダイアログを閉じる
  close: () =>
    set({ isOpen: false, taskId: null, taskName: "" }),
}));
```

---

## 10-10. 削除ダイアログコンポーネントを作る

```bash
mkdir -p "app/(authed)/tasks/components/DeleteTaskDialog"
touch "app/(authed)/tasks/components/DeleteTaskDialog/index.tsx"
```

```tsx
// app/(authed)/tasks/components/DeleteTaskDialog/index.tsx
'use client';

import { useTransition } from "react";
import { useDeleteTaskDialogStore } from "../../stores/delete-task-dialog-store";
import { deleteTask } from "../../actions/tasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteTaskDialog() {
  const [isPending, startTransition] = useTransition();

  // Zustand から状態とアクションを取得
  const { isOpen, taskId, taskName, close } = useDeleteTaskDialogStore();

  const handleDelete = () => {
    if (!taskId) return;
    startTransition(async () => {
      await deleteTask(taskId);
      close();
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>タスクを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{taskName}」を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close} disabled={isPending}>
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "削除中..." : "削除する"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## 10-11. タスク一覧に削除ボタンを追加する

```tsx
// app/(authed)/tasks/components/TaskList/presentation.tsx
'use client';

import Link from "next/link";
import { useDeleteTaskDialogStore } from "../../stores/delete-task-dialog-store";
import type { Task } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

type Props = {
  tasks: Task[];
};

export function TaskListPresentation({ tasks }: Props) {
  // Zustand からダイアログを開くアクションを取得
  const openDeleteDialog = useDeleteTaskDialogStore((state) => state.open);

  if (tasks.length === 0) {
    return <p className="text-muted-foreground">タスクがありません</p>;
  }

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
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/tasks/${task.id}/edit`}>編集</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => openDeleteDialog(task.id, task.name)}
            >
              削除
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

`DeleteTaskDialog` を `page.tsx` に常設します：

```tsx
// app/(authed)/tasks/page.tsx に追加
import { DeleteTaskDialog } from "./components/DeleteTaskDialog";

// ... JSX の最後に追加 ...
<DeleteTaskDialog />  {/* Zustand で制御されるのでどこに置いてもOK */}
```

---

## 10-12. 動作確認

```bash
pnpm dev
```

1. `/tasks` にアクセス
2. 検索ボックスにキーワードを入力 → URL が `?name=キーワード` に変化することを確認
3. ステータスを選択 → URL に `&status=todo` などが追加されることを確認
4. ページをリロード → フィルタが保持されていることを確認
5. 削除ボタンをクリック → ダイアログが開くことを確認
6. 「削除する」をクリック → タスクが削除されてダイアログが閉じることを確認

> TRY
> - ブラウザの「戻る」ボタンを使って、前のフィルタ状態に戻れるか試しましょう
> - URL に手動でクエリパラメータを入力（例: `?status=done`）して、フィルタが適用されるか確認しましょう

---

## まとめと次のステップ

この章では以下を学びました：

- nuqs でフィルタ条件を URL クエリパラメータと同期させる
- `searchParamsParsers` を1か所で定義して Server / Client で共有する
- `shallow={false}` で URL 変更時に Server Component を再実行させる
- Zustand でコンポーネント間のクライアント状態（削除ダイアログ）を管理する

次の第 11 章では **Vitest・Biome・Lefthook** の詳細を整理し、すべてのテストを緑にします。

→ [第 11 章：Vitest / Biome / Lefthook](./11-vitest-biome.md)
