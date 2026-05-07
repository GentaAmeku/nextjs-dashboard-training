# 第 05 章：Result 型 / Repository 層

## この章の目標

> **CHECK**
> - [ ] `Result<T, E>` 型の仕組みを説明できる
> - [ ] `ok()` / `err()` / `isOk()` / `isErr()` を使いこなせる
> - [ ] `AppError` の 4 種類を説明できる
> - [ ] `taskRepository` を実装し、すべての関数が例外を投げずに `Result<T>` を返せる
> - [ ] `:memory:` SQLite を使った Repository テストが通る

---

## 5-1. なぜ `throw` を使わないのか

従来の JavaScript / TypeScript では、エラーが起きたとき `throw` で例外を投げます。

```typescript
// 従来のスタイル
async function getTask(id: number): Promise<Task> {
  const task = await db.select()...;
  if (!task) {
    throw new Error("タスクが見つかりません"); // 例外を投げる
  }
  return task;
}

// 呼び出し側
try {
  const task = await getTask(123);
} catch (error) {
  // ここで必ず catch しないといけない
  // catch し忘れるとアプリがクラッシュする
}
```

この方式の問題点：

- **エラーが型に現れない**：関数のシグネチャを見ても「どんなエラーが起きうるか」がわからない
- **catch し忘れが起きる**：TypeScript はエラー補足を強制しない
- **テストが難しい**：例外をテストするのは手間がかかる

---

## 5-2. `Result<T, E>` 型とは

**Result 型** は、「成功した値」または「エラー」のどちらかを返す型です。関数の戻り値としてエラーを表現します。

```typescript
// lib/result.ts（完成形のコードを確認する）
export type Ok<T> = {
  ok: true;
  value: T;          // 成功時の値
};

export type Err<E = AppError> = {
  ok: false;
  error: E;          // エラー情報
};

export type Result<T, E = AppError> = Ok<T> | Err<E>;
```

**使い方のイメージ：**

```typescript
// Result 型を返す関数
async function getTask(id: number): Promise<Result<Task>> {
  const task = await db.select()...;

  if (!task) {
    return err(apiError("タスクが見つかりません", 404)); // エラーを値として返す
  }

  return ok(task); // 成功値を返す
}

// 呼び出し側（try-catch 不要、型で強制される）
const result = await getTask(123);

if (isErr(result)) {
  // result.error を使ってエラー処理
  console.error(result.error.message);
  return result; // エラーをそのまま上流に伝播
}

// ここでは result.value が使える（Task 型）
console.log(result.value.name);
```

---

## 5-3. ヘルパー関数を理解する

`lib/result.ts` には 4 つのヘルパー関数があります：

```typescript
// 成功値を包む
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

// エラーを包む
export const err = <E = AppError>(error: E): Err<E> => ({ ok: false, error });

// 成功かどうかを判定（型ガード）
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

// エラーかどうかを判定（型ガード）
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;
```

> NOTE
> `isOk` と `isErr` は **型ガード** です。
> `if (isOk(result))` のブロック内では `result.value` が使えるようになり、
> `if (isErr(result))` のブロック内では `result.error` が使えるようになります。
> TypeScript の型推論が自動的に絞り込んでくれます。

---

## 5-4. `AppError` の 4 種類

`lib/errors.ts` に、エラーの種類を定義した **discriminated union** があります。

```typescript
// lib/errors.ts の AppError 型
export type AppError =
  | { type: "API_ERROR"; message: string; httpStatus?: number | string }
  | { type: "DATABASE_ERROR"; message: string; cause?: unknown }
  | { type: "UNKNOWN_ERROR"; message: string; cause?: unknown }
  | { type: "VALIDATION_ERROR"; message: string; fields?: string[]; issues?: ... }
```

| エラー種別       | 使う場面                              |
| ---------------- | ------------------------------------- |
| `API_ERROR`      | ビジネスロジック上の失敗（404 など）  |
| `DATABASE_ERROR` | DB 操作の失敗                         |
| `UNKNOWN_ERROR`  | 予期しない例外                        |
| `VALIDATION_ERROR` | 入力バリデーション失敗              |

それぞれ対応するヘルパー関数があります：

```typescript
// 404 などのビジネスエラー
return err(apiError("タスクが見つかりません", 404));

// DB 操作のエラー
return err(databaseError("DB の取得に失敗", error));

// Zod のバリデーションエラーを AppError に変換
const parsed = schema.safeParse(data);
if (!parsed.success) {
  return err(zodErrorToAppError(parsed.error));
}
```

---

## 5-5. ハンズオン：`lib/result.ts` と `lib/errors.ts` を実装する

```bash
touch lib/result.ts lib/errors.ts
```

**`lib/result.ts`：**

```typescript
import type { AppError } from "@/lib/errors";

/* ------------------------------ Types ------------------------------ */

export type Ok<T> = {
  ok: true;
  value: T;
};

export type Err<E = AppError> = {
  ok: false;
  error: E;
};

export type Result<T, E = AppError> = Ok<T> | Err<E>;

/* ------------------------------ Helpers ------------------------------ */

export const ok = <T>(value: T): Ok<T> => ({
  ok: true,
  value,
});

export const err = <E = AppError>(error: E): Err<E> => ({
  ok: false,
  error,
});

export const isOk = <T, E = AppError>(result: Result<T, E>): result is Ok<T> =>
  result.ok;

export const isErr = <T, E = AppError>(result: Result<T, E>): result is Err<E> =>
  !result.ok;

// 成功値を取り出す（失敗時は例外を投げる：テスト用途）
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};

// Result かどうかを判定（型ガード）
export const isResult = <T>(value: unknown): value is Result<T> =>
  value !== null &&
  typeof value === "object" &&
  "ok" in value &&
  "error" in value;
```

**`lib/errors.ts`：**

```typescript
import type { z } from "zod";

/* ------------------------------ Types ------------------------------ */

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

/* ------------------------------ Helpers ------------------------------ */

export const apiError = (message: string, httpStatus?: number | string): AppError => ({
  type: "API_ERROR",
  message,
  httpStatus,
});

export const databaseError = (message: string, cause?: unknown): AppError => ({
  type: "DATABASE_ERROR",
  message,
  cause,
});

export const unknownError = (message: string, cause?: unknown): AppError => ({
  type: "UNKNOWN_ERROR",
  message,
  cause,
});

export const validationError = (message: string, fields?: string[]): AppError => ({
  type: "VALIDATION_ERROR",
  message,
  fields,
});

// Zod のエラーを AppError に変換する
export const zodErrorToAppError = (zodError: z.ZodError): AppError => {
  const fields = zodError.issues.map((issue) => issue.path.join("."));
  const message = zodError.issues.map((issue) => issue.message).join(", ");
  const issues = zodError.issues.map((issue) => ({
    path: issue.path.filter(
      (p): p is string | number =>
        typeof p === "string" || typeof p === "number",
    ),
    message: issue.message,
  }));

  return {
    type: "VALIDATION_ERROR",
    message,
    fields,
    issues,
  };
};
```

---

## 5-6. Repository 層とは

**Repository 層** は「DB へのアクセスだけを担うレイヤー」です。

```
Server Action → Service → Repository → DB
                              ↑ここ
                  DB クエリだけを書く
                  ビジネスロジックは書かない
                  必ず Result<T> を返す
```

なぜ分けるのか：

- **テストしやすい**：Repository 単体で「DB 操作が正しいか」を検証できる
- **責務が明確**：「DB から取ってくる」という仕事だけに集中する
- **交換しやすい**：将来 SQLite → PostgreSQL に替えるとき、Repository だけ書き換えれば OK

---

## 5-7. ハンズオン：`taskRepository` を実装する

```bash
mkdir -p lib/db/repositories
touch lib/db/repositories/task-repository.ts
```

```typescript
// lib/db/repositories/task-repository.ts
import { and, count, desc, eq, like } from "drizzle-orm";
import { apiError, databaseError } from "@/lib/errors";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { getDB } from "@/lib/db/client";
import {
  type NewTask,
  type Task,
  type Status,
  type Priority,
  tasks,
} from "@/lib/db/schema";

// クエリの検索条件の型
type TaskQuery = {
  name?: string;
  status?: Status;
  priority?: Priority;
};

// ── 統計取得 ──────────────────────────────────────────────────────

// タスクの総数を取得
export async function getTotalCount(): Promise<Result<number>> {
  try {
    const db = getDB();
    const [result] = await db.select({ count: count() }).from(tasks);
    return ok(result.count);
  } catch (error) {
    return err(databaseError("タスク総数の取得に失敗しました", error));
  }
}

// ステータスごとの件数を取得
export async function getStatusCounts(): Promise<
  Result<Record<Status, number>>
> {
  try {
    const db = getDB();
    const results = await db
      .select({ status: tasks.status, count: count() })
      .from(tasks)
      .groupBy(tasks.status);

    // 全ステータスを 0 で初期化してから、取得結果を上書き
    const counts: Record<Status, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
    };
    for (const row of results) {
      counts[row.status as Status] = row.count;
    }

    return ok(counts);
  } catch (error) {
    return err(databaseError("ステータス別件数の取得に失敗しました", error));
  }
}

// 完了タスク数を取得
export async function getCompletedCount(): Promise<Result<number>> {
  try {
    const db = getDB();
    const [result] = await db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.status, "done"));
    return ok(result.count);
  } catch (error) {
    return err(databaseError("完了タスク数の取得に失敗しました", error));
  }
}

// ── 一覧取得 ──────────────────────────────────────────────────────

// 全タスクを取得
export async function getAll(): Promise<Result<Task[]>> {
  try {
    const db = getDB();
    const result = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    return ok(result);
  } catch (error) {
    return err(databaseError("タスク一覧の取得に失敗しました", error));
  }
}

// 検索条件でタスクを絞り込む
export async function getByQuery(query: TaskQuery): Promise<Result<Task[]>> {
  try {
    const db = getDB();
    const conditions = [];

    if (query.name) {
      conditions.push(like(tasks.name, `%${query.name}%`));
    }
    if (query.status) {
      conditions.push(eq(tasks.status, query.status));
    }
    if (query.priority) {
      conditions.push(eq(tasks.priority, query.priority));
    }

    const result = await db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tasks.createdAt));

    return ok(result);
  } catch (error) {
    return err(databaseError("タスク検索に失敗しました", error));
  }
}

// ── 単件取得 ──────────────────────────────────────────────────────

// ID でタスクを取得（存在しない場合は 404 エラー）
export async function getById(id: number): Promise<Result<Task>> {
  try {
    const db = getDB();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));

    if (!task) {
      return err(apiError(`タスク(ID: ${id})が見つかりません`, 404));
    }

    return ok(task);
  } catch (error) {
    return err(databaseError("タスクの取得に失敗しました", error));
  }
}

// ── 作成・更新・削除 ──────────────────────────────────────────────

// タスクを作成する
export async function create(data: NewTask): Promise<Result<Task>> {
  try {
    const db = getDB();
    const [created] = await db.insert(tasks).values(data).returning();
    return ok(created);
  } catch (error) {
    return err(databaseError("タスクの作成に失敗しました", error));
  }
}

// タスクを更新する
export async function update(
  id: number,
  data: Partial<NewTask>,
): Promise<Result<Task>> {
  try {
    const db = getDB();
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return err(apiError(`タスク(ID: ${id})が見つかりません`, 404));
    }

    return ok(updated);
  } catch (error) {
    return err(databaseError("タスクの更新に失敗しました", error));
  }
}

// タスクを削除する
export async function deleteById(id: number): Promise<Result<void>> {
  try {
    const db = getDB();
    await db.delete(tasks).where(eq(tasks.id, id));
    return ok(undefined);
  } catch (error) {
    return err(databaseError("タスクの削除に失敗しました", error));
  }
}

// まとめてエクスポート
export const taskRepository = {
  getTotalCount,
  getStatusCounts,
  getCompletedCount,
  getAll,
  getByQuery,
  getById,
  create,
  update,
  deleteById,
};
```

---

## 5-8. Repository のテストを書く

`:memory:` SQLite（テスト専用のインメモリ DB）を使ってテストします。

```bash
mkdir -p lib/db/repositories/__tests__
touch lib/db/repositories/__tests__/task-repository.test.ts
```

```typescript
// lib/db/repositories/__tests__/task-repository.test.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { tasks } from "@/lib/db/schema";
import * as clientModule from "@/lib/db/client";
import { taskRepository } from "../task-repository";

// テスト用ヘルパー：成功を期待する
function expectOk<T>(result: { ok: boolean; value?: T; error?: unknown }) {
  expect(result.ok).toBe(true);
  return result as { ok: true; value: T };
}

// テスト用ヘルパー：特定エラー型を期待する
function expectErrType(
  result: { ok: boolean; error?: unknown },
  type: string,
) {
  expect(result.ok).toBe(false);
  expect((result as { ok: false; error: { type: string } }).error.type).toBe(type);
}

describe("taskRepository", () => {
  let testDb: ReturnType<typeof drizzle>;

  beforeEach(() => {
    // テストごとに新しいインメモリ DB を作成する
    const sqlite = new Database(":memory:");
    testDb = drizzle(sqlite, { schema });

    // テーブルを作成
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // getDB() がテスト用 DB を返すように差し替える
    vi.spyOn(clientModule, "getDB").mockReturnValue(testDb);
  });

  describe("create / getById", () => {
    it("タスクを作成して ID で取得できる", async () => {
      // 作成
      const createResult = await taskRepository.create({
        name: "テストタスク",
        status: "todo",
        priority: "medium",
      });
      const created = expectOk(createResult);

      // 取得
      const getResult = await taskRepository.getById(created.value.id);
      const fetched = expectOk(getResult);

      expect(fetched.value.name).toBe("テストタスク");
    });

    it("存在しない ID で getById すると 404 エラーになる", async () => {
      const result = await taskRepository.getById(9999);
      expectErrType(result, "API_ERROR");
    });
  });

  describe("update", () => {
    it("タスクを更新できる", async () => {
      const createResult = await taskRepository.create({
        name: "更新前",
        status: "todo",
        priority: "low",
      });
      const created = expectOk(createResult);

      const updateResult = await taskRepository.update(created.value.id, {
        name: "更新後",
        status: "done",
      });
      const updated = expectOk(updateResult);

      expect(updated.value.name).toBe("更新後");
      expect(updated.value.status).toBe("done");
    });
  });

  describe("deleteById", () => {
    it("タスクを削除できる", async () => {
      const createResult = await taskRepository.create({
        name: "削除対象",
        status: "todo",
        priority: "medium",
      });
      const created = expectOk(createResult);

      const deleteResult = await taskRepository.deleteById(created.value.id);
      expectOk(deleteResult);

      // 削除後は getById で 404
      const getResult = await taskRepository.getById(created.value.id);
      expectErrType(getResult, "API_ERROR");
    });
  });
});
```

### テストを実行する

`vitest.config.mts` を確認・作成します：

```typescript
// vitest.config.mts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

```bash
pnpm test
```

すべてのテストが緑（PASS）になることを確認します。

<details>
<summary>HINT：テストが失敗する場合</summary>

1. **`Cannot find module 'better-sqlite3'`**
   ```bash
   pnpm add better-sqlite3 @types/better-sqlite3
   ```

2. **SQL エラー（テーブルが存在しない）**
   - `beforeEach` の `CREATE TABLE` 文のカラム名が `schema.ts` と一致しているか確認

3. **`vi.spyOn` が効かない**
   - `clientModule` を `import * as clientModule from "@/lib/db/client"` でインポートしているか確認

</details>

---

## まとめと次のステップ

この章では以下を学びました：

- `Result<T, E>` 型でエラーを値として表現する
- `ok()` / `err()` / `isOk()` / `isErr()` でエラー処理を型安全に行う
- `AppError` は 4 種類の discriminated union で定義されている
- Repository 層は DB アクセスのみを担い、必ず `Result<T>` を返す
- `:memory:` SQLite + `vi.spyOn(getDB)` でテストを書く

次の第 06 章では、バリデーションとビジネスロジックを担う **Service 層** を実装します。

→ [第 06 章：Zod + Service 層](./06-zod-service.md)
