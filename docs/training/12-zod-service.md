# 第 12 章：Zod + Service 層

## この章の目標

> **CHECK**
> - [ ] Zod の `safeParse` と `Result` への変換（`zodErrorToAppError`）を説明できる
> - [ ] `lib/validation` の各関数が `Result` を返すことを読み取れる
> - [ ] `taskService` が「バリデーション → Repository 呼び出し → Result 返却」で動くことを説明できる
> - [ ] Service テストが `vi.mock` で Repository を差し替えて動く仕組みを説明できる

---

> [!IMPORTANT]
> **【より深く・読み解く章】`lib/` は同梱済みです。** 第 05〜09 章で使ってきた `taskService` の**実装を読み解く**章です。
>
> ```bash
> git show answer/main:lib/validation/task-validation.ts
> git show answer/main:lib/validation/task-query-validation.ts
> git show answer/main:lib/db/services/task-service.ts
> ```

---

## 12-1. Zod とは

**Zod** は TypeScript ファーストなバリデーションライブラリです。第 04 章で `createInsertSchema()` から `createTaskSchema` / `updateTaskSchema` を生成しました。Service 層はそれを使います。

```typescript
const result = createTaskSchema.safeParse(data);
if (!result.success) {
  // result.error.issues に { path, message } の配列が入る
}
```

---

## 12-2. Service 層の役割

```
Server Action → Service → Repository → DB
                  ↑ ここ：① 入力をバリデーション ② 存在チェック ③ Repository を呼ぶ
                          （DB クエリは書かない）
```

---

## 12-3. バリデーション（`lib/validation/`）

バリデーション関数は**例外でなく `Result` を返す**形に揃えています。

```typescript
// lib/validation/task-validation.ts（同梱済み・抜粋）
import {
  createTaskSchema,
  updateTaskSchema,
  type NewTask,
} from "@/lib/db/schema";
import { type AppError, zodErrorToAppError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";

export const validateTaskData = (
  data: Partial<NewTask>,
): Result<NewTask, AppError> => {
  const result = createTaskSchema.safeParse(data);
  if (!result.success) return err(zodErrorToAppError(result.error));
  return ok(result.data);
};

export const validateTaskUpdate = (
  data: unknown,
): Result<Partial<NewTask>, AppError> => {
  const result = updateTaskSchema.safeParse(data);
  if (!result.success) return err(zodErrorToAppError(result.error));
  return ok(result.data);
};
```

```typescript
// lib/validation/task-query-validation.ts（同梱済み・抜粋）
import { z } from "zod";
import { PRIORITY, STATUS } from "@/lib/db/schema";

export const taskQuerySchema = z.object({
  name: z.string().trim().optional(),
  status: z
    .enum([STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.CANCELLED])
    .nullish(),
  priority: z.enum([PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH]).nullish(),
});

export type TaskQuery = z.infer<typeof taskQuerySchema>;
// validateTaskQuery(query) も Result を返す
```

> NOTE
> `status` / `priority` の値は第 04 章の `STATUS` / `PRIORITY` を流用するので、スキーマ・バリデーション・フィルタの値がすべて一致します。

---

## 12-4. `taskService` を読む

`taskService` も**オブジェクトリテラル**です。`getTasksByQuery` / `createTask` / `updateTask` は「バリデーション → Repository」の流れで、結果はすべて `Result`。

```typescript
// lib/db/services/task-service.ts（同梱済み）
import { taskRepository } from "@/lib/db/repositories/task-repository";
import type { NewTask } from "@/lib/db/schema";
import { isErr } from "@/lib/result";
import {
  type TaskQuery,
  validateTaskQuery,
} from "@/lib/validation/task-query-validation";
import {
  validateTaskData,
  validateTaskUpdate,
} from "@/lib/validation/task-validation";

export const taskService = {
  // 統計はそのまま Repository に委譲
  getTotalCount: () => taskRepository.getTotalCount(),
  getStatusCounts: () => taskRepository.getStatusCounts(),
  getPriorityCounts: () => taskRepository.getPriorityCounts(),
  getCompletedCount: () => taskRepository.getCompletedCount(),

  getAllTasks: () => taskRepository.getAll(),

  // 一覧：クエリをバリデーションしてから Repository へ
  getTasksByQuery: async (query: TaskQuery) => {
    const validationResult = validateTaskQuery(query);
    if (isErr(validationResult)) return validationResult;
    return taskRepository.getByQuery(validationResult.value);
  },

  // 単件取得（メソッド名は getTask）
  getTask: (id: number) => taskRepository.getById(id),

  createTask: async (taskData: Partial<NewTask>) => {
    const validatedResult = validateTaskData(taskData);
    if (isErr(validatedResult)) return validatedResult;
    return taskRepository.create(validatedResult.value);
  },

  updateTask: async (id: number, taskData: Partial<NewTask>) => {
    const validatedResult = validateTaskUpdate(taskData);
    if (isErr(validatedResult)) return validatedResult;

    // 更新前に存在確認（無ければ 404 を伝播）
    const existingResult = await taskRepository.getById(id);
    if (isErr(existingResult)) return existingResult;

    return taskRepository.update(id, validatedResult.value);
  },

  deleteTask: (id: number) => taskRepository.delete(id),
};
```

> NOTE
> Server Action（第 05 章）が呼んでいたのはこの `taskService` です。単件取得は **`getTask`**、削除は内部で **`taskRepository.delete`** を呼びます。

---

## 12-5. Service テスト（`vi.mock` で Repository を差し替え）

Service のテストは Repository をモックし、**ビジネスロジックだけ**を検証します。

```typescript
// lib/db/services/__tests__/task-service.test.ts（同梱済み・要点）
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiError } from "@/lib/errors";
import { err, ok } from "@/lib/result";

vi.mock("@/lib/db/repositories/task-repository");

const { taskRepository } = await import("@/lib/db/repositories/task-repository");
const { taskService } = await import("@/lib/db/services/task-service");

const mockTask = {
  id: 1,
  name: "Test",
  description: null,
  status: "pending" as const,   // ← schema の STATUS 値
  priority: "medium" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe("createTask", () => {
  it("正しいデータで作成できる", async () => {
    vi.mocked(taskRepository.create).mockResolvedValue(ok(mockTask));
    const result = await taskService.createTask({
      name: "Test",
      status: "pending",
      priority: "medium",
    });
    expect(result.ok).toBe(true);
    expect(taskRepository.create).toHaveBeenCalledOnce();
  });

  it("name が空ならバリデーションエラー（Repository は呼ばれない）", async () => {
    const result = await taskService.createTask({ name: "", priority: "medium" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("VALIDATION_ERROR");
    expect(taskRepository.create).not.toHaveBeenCalled();
  });
});

describe("updateTask", () => {
  it("存在しないタスクは 404 を伝播（update は呼ばれない）", async () => {
    vi.mocked(taskRepository.getById).mockResolvedValue(
      err(apiError("Task not found", 404)),
    );
    const result = await taskService.updateTask(9999, { name: "New" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("API_ERROR");
    expect(taskRepository.update).not.toHaveBeenCalled();
  });
});
```

> NOTE
> Repository テスト（第 11 章）は `:memory:` SQLite で実 DB 操作を、Service テストは `vi.mock` でロジックだけを検証 ── という**役割分担**です。

---

## まとめと次のステップ

- バリデーションは `safeParse` → `zodErrorToAppError` で `Result` に変換する
- `taskService` は「バリデーション → 存在チェック → Repository」で動くオブジェクトリテラル
- 単件取得は `getTask`、削除は `deleteTask` → `taskRepository.delete`
- Service テストは `vi.mock` で Repository を差し替える

次の第 13 章では、これらのテストを **Vitest** で実行し、テスト戦略を整理します。

→ [第 13 章：Vitest でテストを書く](./13-vitest-biome.md)
