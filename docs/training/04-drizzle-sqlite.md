# 第 04 章：Drizzle + SQLite

## この章の目標

> **CHECK**
> - [ ] `lib/db/schema.ts` に `tasks` テーブルを定義できる
> - [ ] `pnpm db:push` で `local.db` が生成できる
> - [ ] Drizzle Studio でテーブルとカラムを確認できる
> - [ ] `pnpm db:seed` でサンプルデータを投入できる

---

## 4-1. Drizzle ORM とは

**Drizzle ORM** は TypeScript ファーストな ORM（Object-Relational Mapper）です。

ORM とは「TypeScript のコード」と「データベースの操作」を橋渡しするライブラリです。

```typescript
// SQL を直接書く場合
"SELECT * FROM tasks WHERE status = 'todo'"

// Drizzle ORM を使う場合（TypeScript で書ける）
db.select().from(tasks).where(eq(tasks.status, "todo"))
```

### なぜ SQLite を使うのか

このプロジェクトでは SQLite を採用しています。

| 比較         | SQLite                    | PostgreSQL / MySQL      |
| ------------ | ------------------------- | ----------------------- |
| 実行場所     | ファイル 1 つ（`local.db`） | 別プロセスで起動が必要  |
| セットアップ | ゼロ（インストール不要）   | 起動・接続設定が必要    |
| 向いている用途 | 開発・学習・小規模        | 本番・大規模             |

学習目的のプロジェクトでは SQLite が最も手軽です。

---

## 4-2. 必要なパッケージを確認する

```bash
# インストール済みか確認
cat package.json | grep -E 'drizzle|better-sqlite|zod'
```

必要なパッケージ：

```bash
# ORM 本体と SQLite ドライバ
pnpm add drizzle-orm better-sqlite3

# Drizzle Zod 連携（スキーマから Zod バリデーターを生成）
pnpm add drizzle-zod

# 開発ツール（マイグレーション・DB GUI）
pnpm add -D drizzle-kit @types/better-sqlite3
```

---

## 4-3. `drizzle.config.ts` を確認する

```bash
cat drizzle.config.ts
```

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",          // SQLite を使う
  schema: "./lib/db/schema.ts", // スキーマの場所
  out: "./drizzle",           // マイグレーションファイルの出力先
  dbCredentials: {
    url: "./local.db",        // SQLite ファイルのパス
  },
});
```

---

## 4-4. データベースクライアントを作る

まず、Drizzle ORM と SQLite を接続する「クライアント」を作ります。

```bash
mkdir -p lib/db
```

```typescript
// lib/db/client.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// グローバル変数を使って開発中の HMR（Hot Module Replacement）でも
// 接続が重複しないようにする（シングルトンパターン）
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
};

export function getDB() {
  if (!globalForDb.db) {
    const sqlite = new Database("./local.db");
    globalForDb.db = drizzle(sqlite, { schema });
  }
  return globalForDb.db;
}
```

> NOTE
> `globalThis` に保存することで、Next.js の HMR 時に毎回新しい DB 接続が作られるのを防いでいます。
> 開発環境では `pnpm dev` を起動したまま変更を加えても、DB 接続がリセットされません。

---

## 4-5. スキーマを定義する

**スキーマ** とは「テーブルの設計図」です。どんなカラムがあるか、どんな型か、を TypeScript で記述します。

```typescript
// lib/db/schema.ts
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

// ── ステータスと優先度の定数 ──────────────────────────────────────
export const STATUS = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done",
} as const;

export const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

// 型推論（"todo" | "in_progress" | "done"）
export type Status = (typeof STATUS)[keyof typeof STATUS];
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

// 表示用ラベル
export const STATUS_LABELS: Record<Status, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

// ── tasks テーブルの定義 ──────────────────────────────────────────
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "done"] })
    .notNull()
    .default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// TypeScript の型（drizzle から自動生成）
export type Task = typeof tasks.$inferSelect;   // SELECT 結果の型
export type NewTask = typeof tasks.$inferInsert; // INSERT データの型

// ── Zod バリデーションスキーマ（drizzle-zod で自動生成）──────────────
// createTaskSchema：タスク作成フォーム用（id・createdAt・updatedAt を除く）
export const createTaskSchema = createInsertSchema(tasks, {
  name: (schema) => schema.min(1, "タスク名は必須です").max(100),
  description: (schema) => schema.max(500).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// updateTaskSchema：タスク更新フォーム用（すべて任意）
export const updateTaskSchema = createTaskSchema.partial();

// insertTaskSchema：DB 挿入用（自動生成フィールドを除く）
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
```

> NOTE
> `drizzle-zod` の `createInsertSchema()` を使うと、テーブル定義から自動的に Zod スキーマを生成できます。
> フォームのバリデーションに使うスキーマと DB の定義が **一か所に集約**されるため、同期がズレにくくなります。

---

## 4-6. `package.json` にコマンドを追加する

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check",
    "format": "biome check --write",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

`tsx` パッケージも必要なので追加します：

```bash
pnpm add -D tsx
```

---

## 4-7. シードスクリプトを作る

シードデータとは、開発・テスト用に DB に投入するサンプルデータです。

```bash
mkdir -p scripts lib/db
```

```typescript
// lib/db/seed.ts
import { getDB } from "./client";
import { tasks, STATUS, PRIORITY } from "./schema";
import { count } from "drizzle-orm";

export async function seedDatabase() {
  const db = getDB();

  // すでにデータがあれば投入しない（冪等性を保つ）
  const [{ count: taskCount }] = await db
    .select({ count: count() })
    .from(tasks);

  if (taskCount > 0) {
    console.log(`tasks テーブルにすでに ${taskCount} 件のデータがあります。スキップします。`);
    return;
  }

  const seedTasks = [
    {
      name: "Next.js の学習",
      description: "App Router と Server Components を理解する",
      status: STATUS.IN_PROGRESS,
      priority: PRIORITY.HIGH,
    },
    {
      name: "Drizzle ORM の導入",
      description: "SQLite と Drizzle を連携させる",
      status: STATUS.DONE,
      priority: PRIORITY.HIGH,
    },
    {
      name: "認証の実装",
      description: "Better Auth で Google OAuth を設定する",
      status: STATUS.TODO,
      priority: PRIORITY.MEDIUM,
    },
    {
      name: "UI コンポーネントの整備",
      description: "shadcn/ui でフォームとカードを作る",
      status: STATUS.TODO,
      priority: PRIORITY.LOW,
    },
    {
      name: "テストを書く",
      description: "Vitest でリポジトリとサービスのテストを追加する",
      status: STATUS.TODO,
      priority: PRIORITY.MEDIUM,
    },
  ];

  await db.insert(tasks).values(seedTasks);
  console.log(`${seedTasks.length} 件のサンプルタスクを投入しました。`);
}
```

```typescript
// scripts/seed.ts（エントリポイント）
import { seedDatabase } from "../lib/db/seed";

seedDatabase()
  .then(() => {
    console.log("シード完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("シード失敗:", error);
    process.exit(1);
  });
```

---

## 4-8. ハンズオン：DB を動かす

### Step 1：スキーマを DB に反映する

```bash
pnpm db:push
```

```
# 実行結果（例）
[✓] Changes applied:
  - Created table `tasks`
```

`local.db` ファイルが生成されます：

```bash
ls -la local.db
# -rw-r--r-- 1 user group 32768 May 07 10:00 local.db
```

### Step 2：Drizzle Studio で確認する

```bash
pnpm db:studio
```

ブラウザで `https://local.drizzle.studio` が開きます。`tasks` テーブルが存在し、正しいカラムが定義されていることを確認しましょう。

> NOTE
> Drizzle Studio はターミナルを占有します。確認後は `Ctrl + C` で停止してください。

### Step 3：シードデータを投入する

```bash
pnpm db:seed
```

```
5 件のサンプルタスクを投入しました。
シード完了
```

再度 `pnpm db:studio` で確認し、データが入っていることを確認します。

> TRY
> - `pnpm db:seed` をもう一度実行してみましょう。「スキップします」と表示されるはずです（冪等性）
> - Drizzle Studio でデータを手動で追加・削除してみましょう

<details>
<summary>HINT：`pnpm db:push` でエラーが出る場合</summary>

よくあるエラーと対処法：

1. **`Cannot find module 'drizzle-kit'`**
   ```bash
   pnpm add -D drizzle-kit
   ```

2. **`Cannot find module 'better-sqlite3'`**
   ```bash
   pnpm add better-sqlite3 @types/better-sqlite3
   ```

3. **`drizzle.config.ts` の path エラー**
   - `schema: "./lib/db/schema.ts"` のパスが正しいか確認

</details>

<details>
<summary>HINT：`pnpm db:seed` でエラーが出る場合</summary>

1. **`Cannot find module 'tsx'`**
   ```bash
   pnpm add -D tsx
   ```

2. **`local.db` が見つからない**
   - 先に `pnpm db:push` を実行してください

</details>

---

## 4-9. DB のリセット方法

開発中に「やり直し」たいときは、SQLite ファイルを削除して再作成します：

```bash
# DB ファイルを削除
rm -f local.db local.db-shm local.db-wal

# スキーマを再適用
pnpm db:push

# シードデータを再投入
pnpm db:seed
```

---

## 4-10. `pnpm db:push` vs `pnpm db:migrate` の違い

| コマンド             | 用途         | 特徴                                                  |
| -------------------- | ------------ | ----------------------------------------------------- |
| `pnpm db:push`       | 開発環境     | マイグレーションファイルを生成しない。即座に DB を更新 |
| `pnpm db:generate`   | 本番環境準備 | `drizzle/` にマイグレーション SQL を出力              |
| `pnpm db:migrate`    | 本番環境     | 生成したマイグレーションを順番に実行                  |

**開発中は `pnpm db:push` だけ使えば OK** です。スキーマを変更したら `pnpm db:push` を実行するだけで反映されます。

---

## まとめと次のステップ

この章では以下を学びました：

- Drizzle ORM は TypeScript でデータベース操作を記述できる ORM
- `lib/db/schema.ts` でテーブル構造・型・Zod スキーマを一元管理
- `pnpm db:push` でスキーマを SQLite に反映（開発用）
- Drizzle Studio で GUI からデータを確認できる
- `pnpm db:seed` でサンプルデータを投入

次の第 05 章では、エラーを例外ではなく **値として扱う** `Result<T>` 型と、DB アクセスのみを担う **Repository 層** を実装します。

→ [第 05 章：Result 型 / Repository 層](./05-result-repository.md)
