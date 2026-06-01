# 第 04 章：Drizzle + SQLite

## この章の目標

> **CHECK**
> - [ ] `lib/db/schema.ts` の `tasks` テーブル定義（カラム・enum・型）を説明できる
> - [ ] `status` / `priority` の取りうる値と型（`TaskStatus` / `TaskPriority`）を説明できる
> - [ ] `pnpm db:push` で `local.db` が生成できる
> - [ ] Drizzle Studio でテーブルとデータを確認できる
> - [ ] `pnpm db:seed` でサンプルデータを投入できる

---

> [!IMPORTANT]
> **`lib/db/`（`client.ts` / `schema.ts` / `seed.ts`）と `drizzle.config.ts` はリポジトリに同梱済みです。**
> この章の目的は **スキーマを読んで理解し、`pnpm db:push` で DB を作る**ことです。手を動かすのは DB 操作コマンドが中心です。
>
> ```bash
> git show answer/main:lib/db/schema.ts   # スキーマ定義（この章の主役）
> git show answer/main:lib/db/client.ts   # Drizzle クライアント
> ```

---

## 4-1. Drizzle ORM とは

**Drizzle ORM** は TypeScript ファーストな ORM です。「TypeScript のコード」と「DB 操作」を橋渡しします。

```typescript
// SQL を直接書く代わりに…
"SELECT * FROM tasks WHERE status = 'pending'"

// Drizzle なら TypeScript で型安全に書ける
db.select().from(tasks).where(eq(tasks.status, "pending"))
```

### なぜ SQLite か

| 比較         | SQLite                     | PostgreSQL / MySQL     |
| ------------ | -------------------------- | ---------------------- |
| 実行場所     | ファイル 1 つ（`local.db`） | 別プロセスで起動が必要 |
| セットアップ | ゼロ（インストール不要）   | 起動・接続設定が必要   |

学習用途では SQLite が最も手軽です。

---

## 4-2. データベースクライアント（`lib/db/client.ts`）

DB クライアントは**同梱済み**です。HMR で接続が重複しないよう `globalThis` にシングルトンを保持し、初期化失敗を `Result` で扱います。`getDB()` は `lib/db`（`index.ts` で再エクスポート）から import します。

```typescript
// lib/db/client.ts（抜粋・同梱済み）
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

// 開発中の HMR でも接続を使い回すためのシングルトン
const globalForDb = globalThis as unknown as { db?: DB };

export const getDB = (): DB => {
  // 初期化は Result で行い、WAL などの pragma を設定する（完成形を参照）
  // ...
  return globalForDb.db as DB;
};
```

> NOTE
> 完全な実装（`Result` による初期化・`pragma` 設定）は `git show answer/main:lib/db/client.ts` を参照してください。
> 認証ライブラリ（第 06 章）は `getDB()` を `@/lib/db` から import します。

---

## 4-3. スキーマを読む（`lib/db/schema.ts`）

**スキーマ**は「テーブルの設計図」です。この章の主役なので、しっかり読みましょう。

```typescript
// lib/db/schema.ts（tasks 部分・同梱済み）
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/* ------- 定数（status / priority の値とラベル）------- */

export const STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/* ------- tasks テーブル ------- */

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: [STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.CANCELLED],
  })
    .notNull()
    .default(STATUS.PENDING),
  priority: text("priority", {
    enum: [PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH],
  })
    .notNull()
    .default(PRIORITY.MEDIUM),
  // 日時は Unix エポック秒（integer）で保存する
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

/* ------- バリデーションスキーマ（drizzle-zod）------- */

export const insertTaskSchema = createInsertSchema(tasks, {
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum([STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.CANCELLED]),
  priority: z.enum([PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH]),
});

export const selectTaskSchema = createSelectSchema(tasks);

// 作成用：自動生成カラムを除外
export const createTaskSchema = insertTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 更新用：すべて任意
export const updateTaskSchema = insertTaskSchema
  .partial()
  .omit({ id: true, createdAt: true, updatedAt: true });

/* ------- 型 ------- */

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskStatus = (typeof STATUS)[keyof typeof STATUS];
export type TaskPriority = (typeof PRIORITY)[keyof typeof PRIORITY];
```

> NOTE
> ポイント:
> - `status` の値は **`pending` / `in_progress` / `completed` / `cancelled`** の 4 つ。型は `TaskStatus`。
> - `priority` の値は **`low` / `medium` / `high`**。型は `TaskPriority`。
> - 表示ラベルは `STATUS_LABELS` / `PRIORITY_LABELS`（英語）にまとめ、画面ではこれを参照する。
> - `createInsertSchema()` でテーブル定義から Zod スキーマを生成し、DB 定義とバリデーションを **一か所に集約**している。
>
> 認証用の 4 テーブル（`user` / `session` / `account` / `verification`）は**第 06 章**で同じ `schema.ts` に追加します。

---

## 4-4. シードデータ（`lib/db/seed.ts`）

サンプルデータも**同梱済み**です。`status` / `priority` には上記の定数を使います。

```typescript
// lib/db/seed.ts（抜粋・同梱済み）
import { STATUS, PRIORITY, tasks } from "./schema";
// ...
db.insert(tasks).values([
  { name: "TASK-10001", status: STATUS.IN_PROGRESS, priority: PRIORITY.HIGH, /* ... */ },
  { name: "TASK-10002", status: STATUS.COMPLETED,   priority: PRIORITY.MEDIUM, /* ... */ },
  { name: "TASK-10003", status: STATUS.PENDING,     priority: PRIORITY.LOW, /* ... */ },
  { name: "TASK-10004", status: STATUS.CANCELLED,   priority: PRIORITY.MEDIUM, /* ... */ },
  // ...
]);
```

---

## 4-5. ハンズオン：DB を動かす

### Step 1：スキーマを DB に反映する

```bash
pnpm db:push
```

```
[✓] Changes applied:
  - Created table `tasks`
```

`local.db` が生成されます。

### Step 2：Drizzle Studio で確認する

```bash
pnpm db:studio
```

`https://local.drizzle.studio` が開きます。`tasks` テーブルのカラム（`status` / `priority` の enum など）を確認しましょう。確認後は `Ctrl + C` で停止します。

### Step 3：シードデータを投入する

```bash
pnpm db:seed
```

再度 `pnpm db:studio` で、`pending` / `in_progress` / `completed` / `cancelled` のタスクが入っていることを確認します。

> TRY
> - `pnpm db:seed` をもう一度実行すると「すでにデータがあります」とスキップされること（冪等性）を確認しましょう。

<details>
<summary>HINT：`pnpm db:push` でエラーが出る場合</summary>

- `drizzle.config.ts` の `schema: "./lib/db/schema.ts"` のパスが正しいか確認
- `better-sqlite3` がインストールされているか確認（`pnpm install`）

</details>

---

## 4-6. DB のリセット方法

```bash
rm -f local.db local.db-shm local.db-wal
pnpm db:push
pnpm db:seed
```

---

## 4-7. `pnpm db:push` vs `pnpm db:migrate`

| コマンド            | 用途         | 特徴                                       |
| ------------------- | ------------ | ------------------------------------------ |
| `pnpm db:push`      | 開発環境     | マイグレーションファイルを生成せず即反映   |
| `pnpm db:generate`  | 本番準備     | `drizzle/` にマイグレーション SQL を出力   |
| `pnpm db:migrate`   | 本番環境     | 生成したマイグレーションを順番に実行       |

**開発中は `pnpm db:push` だけで OK** です。

---

## まとめと次のステップ

この章では以下を確認しました：

- Drizzle で TypeScript からテーブルを定義する
- `tasks` の `status`（`pending` / `in_progress` / `completed` / `cancelled`）・`priority`（`low` / `medium` / `high`）と型 `TaskStatus` / `TaskPriority`
- `createInsertSchema()` で DB 定義から Zod スキーマを生成し一元管理
- `pnpm db:push` / `db:studio` / `db:seed` の使い方

次の第 05 章では **Server Actions** でタスク作成フォームを実装します。

→ [第 05 章：Server Actions + フォーム](./05-server-actions.md)
