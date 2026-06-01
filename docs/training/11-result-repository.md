# 第 11 章：Result 型 / Repository 層

## この章の目標

> **CHECK**
> - [ ] `Result<T, E>` 型の仕組みと `ok` / `err` / `isOk` / `isErr` を説明できる
> - [ ] `AppError` の 4 種類を説明できる
> - [ ] `taskRepository` が DB アクセスのみを担い、必ず `Result<T>` を返すことを読み取れる
> - [ ] `:memory:` SQLite を使った Repository テストの仕組みを説明できる

---

> [!IMPORTANT]
> **【より深く・読み解く章】`lib/` のコードはリポジトリに**同梱済み**です。この章はゼロから実装するのではなく、第 05〜09 章で使ってきた `taskRepository` の**実装を読み解く**章です。
>
> ```bash
> git show answer/main:lib/result.ts
> git show answer/main:lib/errors.ts
> git show answer/main:lib/db/repositories/task-repository.ts
> ```

---

## 11-1. なぜ `throw` を使わないのか

例外は「型に現れない」「catch し忘れる」「テストしづらい」という問題があります。このプロジェクトでは**エラーを戻り値（`Result`）として返す**方針です。

```typescript
// ❌ 例外（型に現れない・catch 必須）
async function getTask(id: number): Promise<Task> {
  if (!task) throw new Error("not found");
  return task;
}

// ✅ Result（戻り値の型でエラーが分かる・分岐を強制できる）
async function getTask(id: number): Promise<Result<Task>> {
  if (!task) return err(apiError("Task not found", 404));
  return ok(task);
}
```

---

## 11-2. `Result<T, E>` 型（`lib/result.ts`）

```typescript
// lib/result.ts（同梱済み）
import type { AppError } from "@/lib/errors";

export type Ok<T> = { ok: true; value: T };
export type Err<E = AppError> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E = AppError>(error: E): Err<E> => ({ ok: false, error });

// 型ガード：ブロック内で value / error が型安全に使える
export const isOk = <T, E = AppError>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E = AppError>(r: Result<T, E>): r is Err<E> => !r.ok;

export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (r.ok) return r.value;
  throw r.error; // テストなどで成功を前提に取り出すとき
};
```

```typescript
// 使い方
const result = await taskRepository.getById(1);
if (isErr(result)) return result; // エラーをそのまま上流へ伝播
console.log(result.value.name);    // ここでは Task 型に絞り込まれる
```

---

## 11-3. `AppError` の 4 種類（`lib/errors.ts`）

```typescript
// lib/errors.ts（同梱済み・抜粋）
export type AppError =
  | { type: "API_ERROR"; message: string; httpStatus?: number | string }
  | { type: "DATABASE_ERROR"; message: string; cause?: unknown }
  | { type: "UNKNOWN_ERROR"; message: string; cause?: unknown }
  | {
      type: "VALIDATION_ERROR";
      message: string;
      fields?: string[];
      issues?: Array<{ path: (string | number)[]; message: string }>;
    };

export const apiError = (message: string, httpStatus?: number | string): AppError => ({ type: "API_ERROR", message, httpStatus });
export const databaseError = (message: string, cause?: unknown): AppError => ({ type: "DATABASE_ERROR", message, cause });
// validationError / unknownError も同様
// zodErrorToAppError(zodError) で Zod エラーを VALIDATION_ERROR に変換する
```

| 種別               | 使う場面                       |
| ------------------ | ------------------------------ |
| `API_ERROR`        | ビジネス上の失敗（404 など）   |
| `DATABASE_ERROR`   | DB 操作の失敗                  |
| `UNKNOWN_ERROR`    | 予期しない例外                 |
| `VALIDATION_ERROR` | 入力バリデーション失敗         |

---

## 11-4. Repository 層とは

```
Server Action → Service → Repository → DB
                              ↑ ここ：DB クエリのみ。ビジネスロジックは書かない。必ず Result を返す
```

分ける理由：テストしやすい・責務が明確・差し替えやすい。

---

## 11-5. `taskRepository` を読む

`taskRepository` は**オブジェクトリテラル**で、各メソッドが `try/catch` で DB 操作を包み、成功は `ok(...)`・失敗は `err(databaseError(...))` を返します。

```typescript
// lib/db/repositories/task-repository.ts（同梱済み・抜粋）
import { and, count, desc, eq, like } from "drizzle-orm";
import { getDB } from "@/lib/db/client";
import type { NewTask } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { apiError, databaseError } from "@/lib/errors";
import { err, ok } from "@/lib/result";
import type { TaskQuery } from "@/lib/validation/task-query-validation";

export const taskRepository = {
  // 検索条件で絞り込み（name は部分一致、status / priority は一致）
  getByQuery: async (query: TaskQuery) => {
    try {
      const db = getDB();
      const conditions = [];
      if (query.name && query.name.trim() !== "")
        conditions.push(like(schema.tasks.name, `%${query.name.trim()}%`));
      if (query.status) conditions.push(eq(schema.tasks.status, query.status));
      if (query.priority)
        conditions.push(eq(schema.tasks.priority, query.priority));

      const tasks = await db
        .select()
        .from(schema.tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.tasks.createdAt));
      return ok(tasks);
    } catch (error) {
      return err(databaseError("Failed to fetch tasks by query", error));
    }
  },

  // 単件取得：無ければ 404（API_ERROR）
  getById: async (id: number) => {
    try {
      const db = getDB();
      const [task] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, id));
      if (!task) return err(apiError(`Task with id ${id} not found`, 404));
      return ok(task);
    } catch (error) {
      return err(databaseError("Failed to find task", error));
    }
  },

  create: async (taskData: NewTask) => {
    try {
      const db = getDB();
      const [task] = await db.insert(schema.tasks).values(taskData).returning();
      return ok(task);
    } catch (error) {
      return err(databaseError("Failed to create task", error));
    }
  },

  // delete：見つからなければ 404
  delete: async (id: number) => {
    try {
      const db = getDB();
      const deleted = await db
        .delete(schema.tasks)
        .where(eq(schema.tasks.id, id))
        .returning();
      if (deleted.length === 0)
        return err(apiError(`Task with id ${id} not found`, 404));
      return ok(undefined);
    } catch (error) {
      return err(databaseError("Failed to delete task", error));
    }
  },

  // 統計：getTotalCount / getStatusCounts / getPriorityCounts / getCompletedCount
  getCompletedCount: async () => {
    try {
      const db = getDB();
      const [result] = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.status, "completed")); // ← 値は schema の STATUS
      return ok(result?.count ?? 0);
    } catch (error) {
      return err(databaseError("Failed to fetch completed task count", error));
    }
  },

  // update / getAll / getTotalCount / getStatusCounts / getPriorityCounts も同じ
  // 「try/catch + ok/err」パターン。完成系を参照してください。
};
```

> NOTE
> メソッド名（`getById` / `getByQuery` / `create` / `update` / `delete` / 各統計）と、`status` の値（`completed` など）は第 04 章の `STATUS` に一致します。Service 層（第 12 章）はこの `taskRepository` を呼びます。

---

## 11-6. Repository テスト（`:memory:` SQLite）

テストは**インメモリ SQLite** を使い、`getDB()` を差し替えます。

```typescript
// lib/db/repositories/__tests__/task-repository.test.ts（同梱済み・要点）
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import * as clientModule from "@/lib/db/client";
import { taskRepository } from "../task-repository";

describe("taskRepository", () => {
  beforeEach(() => {
    const sqlite = new Database(":memory:"); // テストごとに新しい DB
    const testDb = drizzle(sqlite, { schema });
    sqlite.exec(`CREATE TABLE tasks (... status TEXT DEFAULT 'pending' ...)`);
    vi.spyOn(clientModule, "getDB").mockReturnValue(testDb); // getDB を差し替え
  });

  it("作成して ID で取得できる", async () => {
    const created = await taskRepository.create({
      name: "Test",
      status: "pending",   // ← schema の STATUS 値
      priority: "medium",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      const fetched = await taskRepository.getById(created.value.id);
      expect(fetched.ok).toBe(true);
    }
  });

  it("存在しない ID は 404（API_ERROR）", async () => {
    const result = await taskRepository.getById(9999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("API_ERROR");
  });
});
```

> NOTE
> なぜ `:memory:` か：テストごとにクリーンな DB で、順序非依存・高速・独立にできるからです。

---

## まとめと次のステップ

- `Result<T>` でエラーを値として返し、`isErr` で分岐を強制する
- `AppError` は 4 種の discriminated union
- `taskRepository` は DB アクセスのみ・必ず `Result` を返すオブジェクトリテラル
- Repository テストは `:memory:` SQLite + `vi.spyOn(getDB)` で書く

次の第 12 章では、バリデーションとビジネスロジックを担う **Service 層**を読み解きます。

→ [第 12 章：Zod + Service 層](./12-zod-service.md)
