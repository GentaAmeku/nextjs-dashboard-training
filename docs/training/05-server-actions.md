# 第 05 章：Server Actions + フォーム

## この章の目標

> **CHECK**
> - [ ] Server Action とは何か説明できる
> - [ ] `taskService` が何を受け取り何を返すか（`Result<Task>`）を説明できる
> - [ ] `useActionState` でフォームと Server Action を接続できる
> - [ ] 作成（`/tasks/create`）と編集（`/tasks/[id]/edit`）のフォームを実装できる
> - [ ] フォーム送信で SQLite に行が増える / 更新される

---

> [!TIP]
> **フォームのマークアップ（`TaskForm` と各 Field・`useTaskForm`・`getFieldError`）は完成系からコピーして OK です。**
> この章の主目的は **Server Action の定義**と **`useActionState` での接続**の理解です。
>
> ```bash
> git show answer/main:app/\(authed\)/tasks/components/TaskForm/index.tsx
> git show answer/main:app/\(authed\)/tasks/components/TaskForm/hooks/useTaskForm.ts
> git show answer/main:app/\(authed\)/tasks/components/TaskForm/utils/getFieldError.ts
> ```

---

## 5-1. Server Actions とは

**Server Action** は、フォーム送信などをトリガーに**サーバーで実行される関数**です。

```
[ブラウザ] フォーム送信
   ↓ HTTP（自動）
[サーバー] Server Action 実行（バリデーション・DB 操作）
   ↓
[ブラウザ] 結果を受け取り画面を更新 / リダイレクト
```

| 比較             | API Route                                  | Server Action                   |
| ---------------- | ------------------------------------------ | ------------------------------- |
| 定義             | `app/api/*/route.ts`                       | `actions/*.ts`                  |
| 呼び出し         | `fetch('/api/...', { method: 'POST' })`    | 関数を直接渡す                  |
| フォーム連携     | 手動                                       | `<form action={action}>` で直結 |

---

## 5-2. インターフェース先行：`taskService` は何を返すか

Server Action は `taskService`（Service 層）を呼びます。**中身（バリデーション・Repository・DB）は第 11〜12 章で読み解きます**。この章では「何を受け取り・何を返すか」だけ押さえれば十分です。

```typescript
// すべて例外を投げず Result<T> を返す（lib/db/services/task-service.ts）
taskService.createTask(data: NewTask):       Promise<Result<Task>>
taskService.updateTask(id: number, data):    Promise<Result<Task>>
taskService.deleteTask(id: number):          Promise<Result<void>>
taskService.getTask(id: number):             Promise<Result<Task>>
taskService.getTasksByQuery(query):          Promise<Result<Task[]>>
```

> NOTE
> `Result<T>` は「成功（`{ ok: true, value }`）」か「失敗（`{ ok: false, error }`）」のどちらか。
> 失敗かどうかは `isErr(result)` で判定します（詳しくは第 11 章）。

---

## 5-3. Server Actions を定義する

```bash
mkdir -p "app/(authed)/tasks/actions"
touch "app/(authed)/tasks/actions/tasks.ts"
```

```typescript
// app/(authed)/tasks/actions/tasks.ts
"use server";

import { redirect } from "next/navigation";
import { createTaskSchema } from "@/lib/db/schema";
import type { Task } from "@/lib/db/schema";
import { taskService } from "@/lib/db/services/task-service";
import { validationError, zodErrorToAppError } from "@/lib/errors";
import { err, isErr, type Result } from "@/lib/result";

// 作成：useActionState 用に (prevState, formData) を受ける
export const createTask = async (
  _prevState: Result<Task> | null,
  formData: FormData,
): Promise<Result<Task>> => {
  const data = {
    name: formData.get("name") as string,
    description: formData.get("description") as string | null,
    status: formData.get("status") as string,
    priority: formData.get("priority") as string,
  };

  // 入力をバリデーション（Zod）。失敗なら例外でなくエラーを「返す」
  const parseResult = createTaskSchema.safeParse(data);
  if (!parseResult.success) {
    return err(zodErrorToAppError(parseResult.error));
  }

  const result = await taskService.createTask(parseResult.data);
  if (isErr(result)) return result; // DB エラーなどをそのまま返す

  redirect("/tasks");
};

// 更新：hidden の id を受け取る
export const updateTask = async (
  _prevState: Result<Task> | null,
  formData: FormData,
): Promise<Result<Task>> => {
  const id = Number.parseInt(formData.get("id") as string, 10);
  if (Number.isNaN(id)) return err(validationError("Invalid task ID", ["id"]));

  const data = {
    name: formData.get("name") as string,
    description: formData.get("description") as string | null,
    status: formData.get("status") as string,
    priority: formData.get("priority") as string,
  };

  const parseResult = createTaskSchema.safeParse(data);
  if (!parseResult.success) {
    return err(zodErrorToAppError(parseResult.error));
  }

  const result = await taskService.updateTask(id, parseResult.data);
  if (isErr(result)) return result;

  redirect("/tasks");
};

// 削除：id を直接受ける（クライアントから呼ぶ。リダイレクトはしない）
export const deleteTask = async (id: number) => {
  const result = await taskService.deleteTask(id);
  if (isErr(result)) return result;
};
```

> NOTE
> 取得系（`getTasks` / `getTaskById`）とキャッシュ無効化（`updateTag`）は**第 07 章**で同じファイルに追記します。今は作成・更新・削除に集中します。

---

## 5-4. `useActionState` と `TaskForm`

`useActionState`（React 19）は Server Action の状態（前回の戻り値）と実行中フラグを管理します。

```tsx
const [state, formAction, pending] = useActionState(action, null);
//     ↑ Result<Task>|null   ↑ <form action={...}> に渡す   ↑ 送信中
```

完成系の `TaskForm` は、shadcn の `Form` と Field コンポーネント（`NameField` など）で構成され、`action` を props で受け取ります（作成・編集で使い回す）。

```tsx
// app/(authed)/tasks/components/TaskForm/index.tsx（完成系・コピー可）
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { Task } from "@/lib/db/schema";
import { isErr, type Result } from "@/lib/result";
import { DescriptionField } from "./components/DescriptionField";
import { NameField } from "./components/NameField";
import { PriorityField } from "./components/PriorityField";
import { StatusField } from "./components/StatusField";
import { useTaskForm } from "./hooks/useTaskForm";

interface TaskFormProps {
  task?: Task; // 編集時に既存タスクを渡す
  action: (
    prevState: Result<Task> | null,
    formData: FormData,
  ) => Promise<Result<Task>>;
}

export function TaskForm({ task, action }: TaskFormProps) {
  const [state, formAction, pending] = useActionState<
    Result<Task> | null,
    FormData
  >(action, null);
  const form = useTaskForm({ task });

  return (
    <Form {...form}>
      <form action={formAction} className="space-y-6">
        {task && <input type="hidden" name="id" value={task.id} />}
        <NameField state={state} />
        <DescriptionField state={state} />
        <StatusField state={state} />
        <PriorityField state={state} />
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/tasks">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
        {state && isErr(state) && state.error.type !== "VALIDATION_ERROR" && (
          <p className="text-destructive text-sm mt-2">{state.error.message}</p>
        )}
      </form>
    </Form>
  );
}
```

> NOTE
> 各 Field は `getFieldError(state, "name")` で **サーバー側のバリデーションエラー**を、`react-hook-form`（`useTaskForm`）で**クライアント側のバリデーション**を表示する二段構えです。Field の中身は完成系をコピーしてください。

---

## 5-5. 作成ページ（`/tasks/create`）

```tsx
// app/(authed)/tasks/create/page.tsx
import { createTask } from "@/app/(authed)/tasks/actions/tasks";
import { TaskForm } from "@/app/(authed)/tasks/components/TaskForm";

export default function CreateTaskPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Create Task</h2>
        <p className="text-muted-foreground">
          Add a new task by providing necessary info.
        </p>
      </div>
      {/* createTask アクションを渡す */}
      <TaskForm action={createTask} />
    </div>
  );
}
```

---

## 5-6. 編集ページ（`/tasks/[id]/edit`）と動的ルート

編集ページは**動的セグメント `[id]`** を使います。`params` は Next.js 16 では `Promise` なので `await` します。

```tsx
// app/(authed)/tasks/[id]/edit/page.tsx
import { Suspense } from "react";
import { EditTaskContent } from "./components/EditTaskContent";
import { EditTaskFormSkeleton } from "./components/EditTaskFormSkeleton";

interface EditTaskPageProps {
  params: Promise<{ id: string }>; // ← Next.js 16 は Promise
}

export default function EditTaskPage({ params }: EditTaskPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Edit Task</h2>
        <p className="text-muted-foreground">Update task information.</p>
      </div>
      {/* データ取得中はスケルトンを表示 */}
      <Suspense fallback={<EditTaskFormSkeleton />}>
        <EditTaskContent params={params} />
      </Suspense>
    </div>
  );
}
```

`EditTaskContent` は `await params` で `id` を取り出し、対象タスクを取得して `TaskForm`（`updateTask` アクション）を描画します。

```tsx
// app/(authed)/tasks/[id]/edit/components/EditTaskContent.tsx（コピー可）
import { notFound } from "next/navigation";
import { updateTask } from "@/app/(authed)/tasks/actions/tasks";
import { TaskForm } from "@/app/(authed)/tasks/components/TaskForm";
import { taskService } from "@/lib/db/services/task-service";
import { isErr } from "@/lib/result";

export async function EditTaskContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await taskService.getTask(Number(id));
  if (isErr(result)) notFound();
  return <TaskForm task={result.value} action={updateTask} />;
}
```

> NOTE
> `EditTaskFormSkeleton`（読み込み中の見た目）は完成系からコピーしてください。
> 第 07 章で `taskService.getTask` 直呼びを、キャッシュ付きの `getTaskById` アクションに置き換えます。

---

## 5-7. 動作確認

```bash
pnpm dev
```

1. `/tasks/create` でフォームを送信 → `/tasks` にリダイレクトされる
2. `pnpm db:studio` で SQLite に行が増えていることを確認
3. `/tasks/123/edit`（存在する ID）でフォームに既存値が入り、更新できることを確認

> TRY
> - 名前を空にして送信 → クライアント側バリデーションエラーが出ることを確認
> - DevTools の Network でフォーム送信リクエストを観察

<details>
<summary>HINT：shadcn の Form 関連が見つからない</summary>

```bash
pnpm dlx shadcn@latest add form input textarea select
```

</details>

---

## まとめと次のステップ

- Server Action は `"use server"` でサーバー実行され、例外でなく `Result<T>` を返す
- `useActionState` でフォームと Server Action の状態を接続する
- `TaskForm` は `action` を props で受け、作成・編集で使い回す
- 動的ルート `[id]` と `await params` で編集ページを作る

次の第 06 章では **Better Auth** でログイン・ログアウトと認証ガードを実装します。

→ [第 06 章：Better Auth + Google OAuth](./06-better-auth.md)

---

## 完成イメージ

![タスク作成フォーム](../assets/05-create.png)
![タスク編集フォーム](../assets/05-edit.png)
