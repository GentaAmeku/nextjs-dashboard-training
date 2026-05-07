# 第 07 章：Server Actions + フォーム

## この章の目標

> **CHECK**
> - [ ] Server Action とは何か説明できる
> - [ ] `'use server'` を付けた関数を正しく定義できる
> - [ ] `useActionState` でフォームと Server Action を接続できる
> - [ ] `react-hook-form` + `useActionState` の二段構えバリデーションを実装できる
> - [ ] `/tasks/create` でフォームを送信すると SQLite に行が増える

---

## 7-1. Server Actions とは

**Server Actions** は、フォームの送信や操作（クリックなど）をトリガーに**サーバーで実行される関数**です。

```
[ブラウザ] フォームを送信
     ↓ HTTP リクエスト（自動）
[サーバー] Server Action が実行される
     ↓ DB を操作・バリデーション
[ブラウザ] 結果を受け取って画面を更新
```

### 従来の API Route との違い

| 比較             | API Route (`/api/...`)              | Server Action                      |
| ---------------- | ----------------------------------- | ---------------------------------- |
| 定義の場所       | `app/api/*/route.ts`                | `actions/tasks.ts` など            |
| 呼び出し方       | `fetch('/api/tasks', { method: 'POST' })` | 関数を直接呼ぶ                 |
| フォームとの相性 | 手動で接続                          | `<form action={action}>` で直結    |
| 型安全性         | 手動で型定義                        | TypeScript で自然に型が付く        |

---

## 7-2. Server Action の書き方

### 基本パターン

```typescript
// app/(authed)/tasks/actions/tasks.ts
'use server'; // ← このファイルのすべての関数がサーバーで動く

export async function createTask(formData: FormData) {
  const name = formData.get('name') as string;
  // ...
}
```

### `useActionState` 対応パターン（このプロジェクトで使う方式）

```typescript
'use server';

// useActionState と組み合わせる場合の型
// (_prevState: 前回の状態, formData: フォームデータ) => 次の状態
export async function createTask(
  _prevState: Result<Task> | null,
  formData: FormData,
): Promise<Result<Task>> {
  // ...
}
```

---

## 7-3. このプロジェクトの Server Actions を実装する

```bash
mkdir -p "app/(authed)/tasks/actions"
touch "app/(authed)/tasks/actions/tasks.ts"
```

```typescript
// app/(authed)/tasks/actions/tasks.ts
'use server';

import { redirect } from "next/navigation";
import { isErr } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Task } from "@/lib/db/schema";
import { taskService } from "@/lib/db/services/task-service";
import { createTaskSchema } from "@/lib/db/schema";
import { zodErrorToAppError } from "@/lib/errors";

// ── タスク作成 ────────────────────────────────────────────────────

export async function createTask(
  _prevState: Result<Task> | null,
  formData: FormData,
): Promise<Result<Task>> {
  // FormData を Object に変換して Zod でバリデーション
  const rawData = Object.fromEntries(formData.entries());
  const parseResult = createTaskSchema.safeParse(rawData);

  if (!parseResult.success) {
    // バリデーション失敗：エラーを返す（例外は投げない）
    return { ok: false, error: zodErrorToAppError(parseResult.error) };
  }

  // Service を呼び出してタスクを作成
  const result = await taskService.createTask(parseResult.data);

  if (isErr(result)) {
    // DB エラーなどをそのまま返す
    return result;
  }

  // 成功したら一覧ページにリダイレクト
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

  if (isErr(result)) {
    return result;
  }

  redirect("/tasks");
}

// ── タスク削除 ────────────────────────────────────────────────────

export async function deleteTask(id: number): Promise<Result<void>> {
  const result = await taskService.deleteTask(id);
  if (isErr(result)) {
    return result;
  }
  redirect("/tasks");
}
```

---

## 7-4. `useActionState` の仕組み

`useActionState` は React 19 の新しい Hook で、Server Action の状態（前回の戻り値）を管理します。

```tsx
'use client';

import { useActionState } from "react";
import { createTask } from "../actions/tasks";

export function CreateTaskForm() {
  // [現在の状態, Server Action を呼ぶ関数, 実行中かどうか] を返す
  const [state, action, isPending] = useActionState(createTask, null);
  //              ↑ これを <form action={...}> や <button formAction={...}> に渡す

  return (
    <form action={action}>
      <input name="name" />
      {/* state に ValidationError が入っていればエラーを表示 */}
      {!state?.ok && state?.error.type === "VALIDATION_ERROR" && (
        <p className="text-red-500">{state.error.message}</p>
      )}
      <button type="submit" disabled={isPending}>
        {isPending ? "送信中..." : "作成"}
      </button>
    </form>
  );
}
```

---

## 7-5. `react-hook-form` との二段構え

このプロジェクトでは**クライアント側バリデーション**と**サーバー側バリデーション**の二段構えを採用しています。

```
[ユーザーが入力]
     ↓
[react-hook-form でクライアントバリデーション]  ← 即座にフィードバック
     ↓（クライアントでエラーがなければ送信）
[Server Action でサーバーバリデーション]         ← サーバーサイドで再確認
     ↓
[Zod エラーを state に返して画面に表示]
```

なぜ二段構えにするかというと：

- **クライアント側**：送信前に即座にエラーを表示できる（UX が良い）
- **サーバー側**：クライアントのバリデーションをスキップした場合（直接 HTTP 送信など）にも対応

### `getFieldError` ユーティリティ

Server から返ってきた Zod エラーを特定フィールドのエラーとして取り出すヘルパーを作ります：

```typescript
// app/(authed)/tasks/components/TaskForm/utils/getFieldError.ts
import type { Result } from "@/lib/result";
import type { Task } from "@/lib/db/schema";

// state の ValidationError から特定フィールドのエラーメッセージを取り出す
export function getFieldError(
  state: Result<Task> | null,
  fieldName: string,
): string | undefined {
  if (!state || state.ok) return undefined;

  const { error } = state;
  if (error.type !== "VALIDATION_ERROR") return undefined;

  // issues の中から fieldName に一致するものを探す
  const issue = error.issues?.find(
    (i) => i.path.join(".") === fieldName,
  );
  return issue?.message;
}
```

---

## 7-6. ハンズオン：タスク作成フォームを作る

フォームコンポーネントを作成します。

```bash
mkdir -p "app/(authed)/tasks/components/TaskForm/utils"
mkdir -p "app/(authed)/tasks/components/TaskForm/hooks"
mkdir -p "app/(authed)/tasks/create"
```

### Step 1：フォームの型と `useTaskForm` を作る

```typescript
// app/(authed)/tasks/components/TaskForm/hooks/useTaskForm.ts
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createTaskSchema } from "@/lib/db/schema";

type TaskFormValues = z.infer<typeof createTaskSchema>;

// react-hook-form と Zod を組み合わせたフォーム Hook
export function useTaskForm(defaultValues?: Partial<TaskFormValues>) {
  return useForm<TaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "todo",
      priority: "medium",
      ...defaultValues,
    },
  });
}
```

### Step 2：フォームコンポーネントを作る

```tsx
// app/(authed)/tasks/components/TaskForm/index.tsx
'use client';

import { useActionState } from "react";
import type { Result } from "@/lib/result";
import type { Task } from "@/lib/db/schema";
import { useTaskForm } from "./hooks/useTaskForm";
import { getFieldError } from "./utils/getFieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  // 作成 or 更新の Server Action を受け取る
  action: (
    _prevState: Result<Task> | null,
    formData: FormData,
  ) => Promise<Result<Task>>;
  // 編集時は既存タスクを渡す
  task?: Task;
};

export function TaskForm({ action, task }: Props) {
  // Server Action の状態を管理
  const [state, formAction, isPending] = useActionState(action, null);

  // react-hook-form（クライアントバリデーション用）
  const { register, formState: { errors } } = useTaskForm({
    name: task?.name,
    description: task?.description ?? "",
    status: task?.status,
    priority: task?.priority,
  });

  return (
    <form action={formAction} className="space-y-4">
      {/* 編集時はタスク ID を hidden で送る */}
      {task && <input type="hidden" name="id" value={task.id} />}

      {/* タスク名 */}
      <div className="space-y-1">
        <Label htmlFor="name">タスク名 *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="タスク名を入力"
        />
        {/* クライアントエラー（react-hook-form）を優先表示 */}
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
        {/* サーバーエラーはクライアントエラーがない場合に表示 */}
        {!errors.name && getFieldError(state, "name") && (
          <p className="text-sm text-destructive">
            {getFieldError(state, "name")}
          </p>
        )}
      </div>

      {/* 説明 */}
      <div className="space-y-1">
        <Label htmlFor="description">説明</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="タスクの説明を入力（任意）"
          rows={3}
        />
      </div>

      {/* ステータス */}
      <div className="space-y-1">
        <Label htmlFor="status">ステータス</Label>
        <select
          id="status"
          {...register("status")}
          className="w-full border border-input rounded-md px-3 py-2 text-sm"
        >
          <option value="todo">未着手</option>
          <option value="in_progress">進行中</option>
          <option value="done">完了</option>
        </select>
      </div>

      {/* 優先度 */}
      <div className="space-y-1">
        <Label htmlFor="priority">優先度</Label>
        <select
          id="priority"
          {...register("priority")}
          className="w-full border border-input rounded-md px-3 py-2 text-sm"
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
      </div>

      {/* サーバーエラー（バリデーション以外） */}
      {state && !state.ok && state.error.type !== "VALIDATION_ERROR" && (
        <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
          {state.error.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "送信中..." : task ? "更新する" : "作成する"}
      </Button>
    </form>
  );
}
```

### Step 3：タスク作成ページを作る

```tsx
// app/(authed)/tasks/create/page.tsx
import { createTask } from "../actions/tasks";
import { TaskForm } from "../components/TaskForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateTaskPage() {
  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>タスクを作成</CardTitle>
        </CardHeader>
        <CardContent>
          {/* createTask アクションを渡す */}
          <TaskForm action={createTask} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 4：動作確認

```bash
pnpm dev
```

1. `http://localhost:3000/tasks/create` にアクセス
2. フォームに入力して「作成する」をクリック
3. `/tasks` にリダイレクトされることを確認
4. `pnpm db:studio` を起動して、SQLite にデータが増えていることを確認

> TRY
> - タスク名を空にして送信してみましょう。クライアントバリデーションエラーが表示されるはずです
> - ブラウザの DevTools の Network タブを開いて、フォーム送信時のリクエストを確認しましょう

<details>
<summary>HINT：リダイレクトがされない場合</summary>

- `redirect("/tasks")` が Server Action 内で呼ばれているか確認
- `'use server'` が `actions/tasks.ts` の先頭に付いているか確認
- フォームが `formAction`（`useActionState` の 2 番目の戻り値）を使っているか確認

</details>

<details>
<summary>HINT：shadcn の Input / Textarea / Label が見つからない場合</summary>

```bash
pnpm dlx shadcn@latest add input textarea label
```

</details>

---

## 7-7. タスク一覧ページを更新する

DB からデータを取得してタスク一覧を表示します。

```tsx
// app/(authed)/tasks/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { taskService } from "@/lib/db/services/task-service";
import { isErr } from "@/lib/result";

export default async function TasksPage() {
  // Server Component から直接 Service を呼べる
  const result = await taskService.getTasksByQuery({});

  if (isErr(result)) {
    return <p className="text-destructive">エラー: {result.error.message}</p>;
  }

  const tasks = result.value;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">タスク一覧</h1>
        <Button asChild>
          <Link href="/tasks/create">タスクを作成</Link>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground">タスクがありません</p>
      ) : (
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
      )}
    </div>
  );
}
```

---

## まとめと次のステップ

この章では以下を学びました：

- Server Action は `'use server'` を付けたサーバーサイドで動く関数
- `useActionState` でフォームと Server Action の状態を管理する
- `react-hook-form` でクライアントバリデーション、Server Action でサーバーバリデーションの二段構え
- `getFieldError()` で Server から返ってきた Zod エラーを特定フィールドに表示する

次の第 08 章では **Better Auth と Google OAuth** を設定し、ログイン・ログアウトと認証ガードを完成させます。

→ [第 08 章：Better Auth + Google OAuth](./08-better-auth.md)
