# 第 06 章：Zod + Service 層

## この章の目標

> **CHECK**
> - [ ] Zod でフォームの入力値をバリデーションできる
> - [ ] `zodErrorToAppError()` で Zod のエラーを `AppError` に変換できる
> - [ ] Service 層が「バリデーション → Repository 呼び出し → Result 返却」の流れで動いている
> - [ ] Service のテストが `vi.mock` で Repository を差し替えて動く

---

## 6-1. Zod とは

**Zod** は TypeScript ファーストなバリデーションライブラリです。

```typescript
import { z } from "zod";

// スキーマを定義する
const createTaskSchema = z.object({
  name: z.string().min(1, "タスク名は必須です").max(100),
  description: z.string().max(500).optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

// バリデーションを実行する
const result = createTaskSchema.safeParse({
  name: "",          // ← min(1) 違反
  status: "unknown", // ← enum 違反
});

if (!result.success) {
  console.log(result.error.issues);
  // [
  //   { path: ["name"], message: "タスク名は必須です" },
  //   { path: ["status"], message: "..." }
  // ]
}
```

第 04 章で、`drizzle-zod` の `createInsertSchema()` を使って `lib/db/schema.ts` にスキーマを定義しました。そのスキーマを Service 層で使います。

---

## 6-2. Service 層の役割

**Service 層** はビジネスロジックとバリデーションを担います。

```
Server Action  →  Service  →  Repository  →  DB
                    ↑ここ
        ① バリデーション（入力値が正しいか）
        ② 存在チェック（更新前に取得して確認）
        ③ Repository を呼び出して Result を返す
```

Service 層は Repository 層を呼び出しますが、**DB のクエリは書きません**。DB のことは Repository に任せます。

---

## 6-3. バリデーションスキーマを定義する

`lib/validation/` にバリデーションスキーマを切り出します。

```bash
mkdir -p lib/validation
touch lib/validation/task-validation.ts
touch lib/validation/task-query-validation.ts
```

```typescript
// lib/validation/task-validation.ts
import { z } from "zod";
import { createTaskSchema, updateTaskSchema } from "@/lib/db/schema";

// フォームデータのバリデーション（作成用）
export function validateTaskData(data: unknown) {
  return createTaskSchema.safeParse(data);
}

// フォームデータのバリデーション（更新用）
export function validateTaskUpdate(data: unknown) {
  return updateTaskSchema.safeParse(data);
}
```

```typescript
// lib/validation/task-query-validation.ts
import { z } from "zod";
import type { Status, Priority } from "@/lib/db/schema";

// URL クエリパラメータのバリデーション
const taskQuerySchema = z.object({
  name: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export type TaskQuery = z.infer<typeof taskQuerySchema>;

export function validateTaskQuery(query: unknown) {
  return taskQuerySchema.safeParse(query);
}
```

---

## 6-4. Service 層を実装する

```bash
mkdir -p lib/db/services
touch lib/db/services/task-service.ts
```

```typescript
// lib/db/services/task-service.ts
import { zodErrorToAppError } from "@/lib/errors";
import { err, isErr } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Task } from "@/lib/db/schema";
import { taskRepository } from "@/lib/db/repositories/task-repository";
import { validateTaskData, validateTaskUpdate } from "@/lib/validation/task-validation";
import { validateTaskQuery, type TaskQuery } from "@/lib/validation/task-query-validation";

// ── 統計 ──────────────────────────────────────────────────────────

// 全タスク数を取得する（バリデーションは不要）
export async function getTotalCount(): Promise<Result<number>> {
  return taskRepository.getTotalCount();
}

// ── 一覧取得 ──────────────────────────────────────────────────────

// 検索クエリをバリデーションしてから Repository に渡す
export async function getTasksByQuery(query: unknown): Promise<Result<Task[]>> {
  // ① クエリパラメータをバリデーション
  const parseResult = validateTaskQuery(query);
  if (!parseResult.success) {
    return err(zodErrorToAppError(parseResult.error));
  }

  // ② Repository を呼び出す
  return taskRepository.getByQuery(parseResult.data);
}

// ── 単件取得 ──────────────────────────────────────────────────────

export async function getTaskById(id: number): Promise<Result<Task>> {
  return taskRepository.getById(id);
}

// ── 作成 ──────────────────────────────────────────────────────────

export async function createTask(data: unknown): Promise<Result<Task>> {
  // ① 入力値をバリデーション
  const parseResult = validateTaskData(data);
  if (!parseResult.success) {
    return err(zodErrorToAppError(parseResult.error));
  }

  // ② Repository を呼び出す
  return taskRepository.create(parseResult.data);
}

// ── 更新 ──────────────────────────────────────────────────────────

export async function updateTask(
  id: number,
  data: unknown,
): Promise<Result<Task>> {
  // ① 更新データをバリデーション
  const parseResult = validateTaskUpdate(data);
  if (!parseResult.success) {
    return err(zodErrorToAppError(parseResult.error));
  }

  // ② 更新前に対象タスクが存在するか確認
  const existingResult = await taskRepository.getById(id);
  if (isErr(existingResult)) {
    return existingResult; // 404 をそのまま上流へ伝播
  }

  // ③ 更新を実行
  return taskRepository.update(id, parseResult.data);
}

// ── 削除 ──────────────────────────────────────────────────────────

export async function deleteTask(id: number): Promise<Result<void>> {
  // 削除前に存在確認（存在しないものを削除しようとした場合にエラーを返す）
  const existingResult = await taskRepository.getById(id);
  if (isErr(existingResult)) {
    return existingResult;
  }

  return taskRepository.deleteById(id);
}

export const taskService = {
  getTotalCount,
  getTasksByQuery,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
```

---

## 6-5. Service のテストを書く

Service のテストでは **Repository 全体を `vi.mock` で差し替えます**。これにより、Repository や DB を気にせず Service のロジックだけをテストできます。

```bash
mkdir -p lib/db/services/__tests__
touch lib/db/services/__tests__/task-service.test.ts
```

```typescript
// lib/db/services/__tests__/task-service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok, err } from "@/lib/result";
import { apiError } from "@/lib/errors";

// Repository をモック（テスト用の偽物）に差し替える
vi.mock("@/lib/db/repositories/task-repository");

// モック後に import する（順序が重要）
const { taskRepository } = await import("@/lib/db/repositories/task-repository");
const { taskService } = await import("@/lib/db/services/task-service");

// サンプルタスクデータ
const mockTask = {
  id: 1,
  name: "テストタスク",
  description: null,
  status: "todo" as const,
  priority: "medium" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTask", () => {
  it("正しいデータでタスクを作成できる", async () => {
    // Repository の create が成功する場合を設定
    vi.mocked(taskRepository.create).mockResolvedValue(ok(mockTask));

    const result = await taskService.createTask({
      name: "テストタスク",
      status: "todo",
      priority: "medium",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("テストタスク");
    }
    expect(taskRepository.create).toHaveBeenCalledOnce();
  });

  it("name が空の場合はバリデーションエラーになる", async () => {
    const result = await taskService.createTask({
      name: "",         // ← min(1) 違反
      status: "todo",
      priority: "medium",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
    }
    // バリデーション失敗なので Repository.create は呼ばれない
    expect(taskRepository.create).not.toHaveBeenCalled();
  });
});

describe("updateTask", () => {
  it("存在するタスクを更新できる", async () => {
    // まず getById が成功するよう設定
    vi.mocked(taskRepository.getById).mockResolvedValue(ok(mockTask));
    // 次に update が成功するよう設定
    vi.mocked(taskRepository.update).mockResolvedValue(
      ok({ ...mockTask, name: "更新後", status: "done" as const }),
    );

    const result = await taskService.updateTask(1, {
      name: "更新後",
      status: "done",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("更新後");
    }
  });

  it("存在しないタスクを更新しようとすると 404 エラーになる", async () => {
    // getById が 404 を返すよう設定
    vi.mocked(taskRepository.getById).mockResolvedValue(
      err(apiError("タスクが見つかりません", 404)),
    );

    const result = await taskService.updateTask(9999, { name: "更新後" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("API_ERROR");
    }
    // 404 なので update は呼ばれない
    expect(taskRepository.update).not.toHaveBeenCalled();
  });
});
```

```bash
pnpm test
```

すべてのテストが通ることを確認します。

> NOTE
> Repository テスト（第 05 章）と Service テストの違い：
> - Repository テスト：`:memory:` SQLite を使う（実際の DB 操作が正しいか確認）
> - Service テスト：`vi.mock` で Repository を差し替える（ビジネスロジックだけを確認）
>
> この分離により、それぞれを**独立して**テストできます。

---

## 6-6. エラーの流れを追う

Service → Repository を通じてエラーがどう流れるかを確認しましょう。

```
ユーザー入力「name: ""」
     ↓
taskService.createTask({ name: "" })
     ↓ validateTaskData でバリデーション失敗
     ↓ zodErrorToAppError でエラー変換
return err({ type: "VALIDATION_ERROR", message: "タスク名は必須です", ... })
     ↓
Server Action が受け取る（次の章で実装）
     ↓
フォームにエラーを表示
```

```
ユーザーが存在しない ID を指定して更新しようとした場合
     ↓
taskService.updateTask(9999, { name: "更新後" })
     ↓ taskRepository.getById(9999) → err({ type: "API_ERROR", httpStatus: 404 })
     ↓ isErr で検出してそのまま return
return err({ type: "API_ERROR", httpStatus: 404 })
     ↓
Server Action が受け取る → 404 ページを表示するなど
```

---

## まとめと次のステップ

この章では以下を学びました：

- Zod でフォーム入力値を型安全にバリデーションする
- `zodErrorToAppError()` で Zod エラーを統一的な `AppError` に変換
- Service 層は「バリデーション → 存在チェック → Repository 呼び出し」の流れで動く
- Service テストは `vi.mock` で Repository を差し替えてロジックだけをテストする

次の第 07 章では、フォームの送信を処理する **Server Actions** と `useActionState` を使ったフォーム実装を行います。

→ [第 07 章：Server Actions + フォーム](./07-server-actions.md)
