# 第 11 章：Vitest でテストを書く

## この章の目標

> **CHECK**
> - [ ] Repository テスト（`:memory:` SQLite + `spyOn`）が通る
> - [ ] Service テスト（`vi.mock` で repo を差し替え）が通る
> - [ ] Zod スキーマの単体テストが通る
> - [ ] `pnpm test` ですべてのテストが緑になる

---

## 11-1. このプロジェクトのテスト戦略

テストは 3 層に分かれています。

```
layer 3: E2E テスト（このプロジェクトでは省略）
     ↑ ブラウザを動かして画面全体を確認
layer 2: Integration テスト（Repository テスト）
     ↑ 実際の DB（:memory: SQLite）を使って動作確認
layer 1: Unit テスト（Service テスト・バリデーションテスト）
     ↑ 依存をモックして関数単体を確認
```

**なぜ DB を使う Repository テストと、モックを使う Service テストに分けるのか？**

- Repository は「SQL が正しいか・DB 操作が正しいか」を確認する → 実際の DB が必要
- Service は「バリデーションロジック・エラー処理が正しいか」を確認する → DB は不要（モックで十分）

この分離により、それぞれを**独立して素早く**テストできます。

---

## 11-2. Vitest のセットアップ

```bash
pnpm add -D vitest @vitest/ui
```

`vitest.config.mts` を作成します：

```typescript
// vitest.config.mts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,       // describe / it / expect などをグローバルで使える
    environment: "node", // jsdom ではなく Node.js 環境で実行
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."), // tsconfig の paths と合わせる
    },
  },
});
```

`package.json` にスクリプトを追加：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

> NOTE
> `environment: "node"` を指定しているのは、DB アクセス（`better-sqlite3`）が Node.js 専用の Native Module だからです。
> `jsdom` 環境では動きません。

---

## 11-3. テストファイルの構成

```
lib/
├── db/
│   ├── repositories/
│   │   ├── task-repository.ts
│   │   └── __tests__/
│   │       └── task-repository.test.ts  ← Repository テスト
│   └── services/
│       ├── task-service.ts
│       └── __tests__/
│           └── task-service.test.ts     ← Service テスト
└── validation/
    ├── task-validation.ts
    └── __tests__/
        ├── task-validation.test.ts      ← バリデーションテスト
        └── task-query-validation.test.ts
```

---

## 11-4. バリデーションのテストを書く

バリデーションスキーマの単体テストです。依存が少ないので最もシンプルです。

```bash
mkdir -p lib/validation/__tests__
touch lib/validation/__tests__/task-validation.test.ts
```

```typescript
// lib/validation/__tests__/task-validation.test.ts
import { describe, expect, it } from "vitest";
import { validateTaskData, validateTaskUpdate } from "../task-validation";

describe("validateTaskData（タスク作成バリデーション）", () => {
  it("正しいデータはバリデーションを通過する", () => {
    const result = validateTaskData({
      name: "テストタスク",
      status: "todo",
      priority: "medium",
    });
    expect(result.success).toBe(true);
  });

  it("name が空の場合は失敗する", () => {
    const result = validateTaskData({
      name: "",
      status: "todo",
      priority: "medium",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("name");
    }
  });

  it("name が 100 文字を超える場合は失敗する", () => {
    const result = validateTaskData({
      name: "a".repeat(101),
      status: "todo",
      priority: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("status が無効な値の場合は失敗する", () => {
    const result = validateTaskData({
      name: "テスト",
      status: "invalid_status", // ← enum 違反
      priority: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("description なしでも通過する", () => {
    const result = validateTaskData({
      name: "テスト",
      status: "todo",
      priority: "medium",
      // description は省略可
    });
    expect(result.success).toBe(true);
  });
});

describe("validateTaskUpdate（タスク更新バリデーション）", () => {
  it("すべてのフィールドが任意（空でも通過）", () => {
    const result = validateTaskUpdate({});
    expect(result.success).toBe(true);
  });

  it("一部のフィールドだけ更新できる", () => {
    const result = validateTaskUpdate({ status: "done" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("done");
    }
  });
});
```

---

## 11-5. Repository テストのパターン確認

第 05 章で書いた Repository テストのパターンを復習します。

```typescript
// lib/db/repositories/__tests__/task-repository.test.ts（第 05 章参照）
// 重要なポイント：

// 1. beforeEach でインメモリ DB を作成する
beforeEach(() => {
  const sqlite = new Database(":memory:");
  testDb = drizzle(sqlite, { schema });

  // SQL でテーブルを作成
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tasks (...)`);

  // getDB() が testDb を返すように差し替える
  vi.spyOn(clientModule, "getDB").mockReturnValue(testDb);
});

// 2. テストヘルパーで Result を検証する
function expectOk<T>(result) { ... }
function expectErrType(result, type) { ... }
```

**なぜ `:memory:` SQLite を使うのか？**

```
本物の local.db を使う場合:
  → テストを実行するたびにデータが残る
  → テストが順序依存になる（前のテストの残骸が影響する）
  → 複数人が同時に開発すると競合する

:memory: SQLite を使う場合:
  → テストプロセスが終わると消える
  → beforeEach で毎回クリーンな状態から始められる
  → 完全に独立したテストが書ける
```

---

## 11-6. Service テストのパターン確認

第 06 章で書いた Service テストのパターンを復習します。

```typescript
// lib/db/services/__tests__/task-service.test.ts（第 06 章参照）
// 重要なポイント：

// 1. Repository 全体をモックする
vi.mock("@/lib/db/repositories/task-repository");

// 2. モック後に import する（順序が重要）
const { taskRepository } = await import("@/lib/db/repositories/task-repository");
const { taskService } = await import("@/lib/db/services/task-service");

// 3. beforeEach でモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// 4. テストごとにモックの戻り値を設定
vi.mocked(taskRepository.create).mockResolvedValue(ok(mockTask));
```

**モックを使う理由：**

Service のテストで本物の Repository（DB）を使うと：
- テストが遅くなる（DB アクセスが発生する）
- 「Service のロジックのバグ」と「Repository の SQL バグ」が混在して原因が特定しにくい

`vi.mock` で Repository を差し替えることで、**Service のビジネスロジックだけを純粋に検証**できます。

---

## 11-7. すべてのテストを実行する

```bash
pnpm test
```

すべてのテストが `PASS` になることを確認します。

```
✓ lib/validation/__tests__/task-validation.test.ts (5)
✓ lib/validation/__tests__/task-query-validation.test.ts (3)
✓ lib/db/repositories/__tests__/task-repository.test.ts (4)
✓ lib/db/services/__tests__/task-service.test.ts (4)

Test Files  4 passed (4)
Tests       16 passed (16)
```

失敗したテストがある場合は、エラーメッセージを読んで修正しましょう。

---

## 11-8. テスト UI で確認する（オプション）

```bash
pnpm test:ui
```

ブラウザで各テストの結果をグラフィカルに確認できます。テストが多くなったときに役立ちます。

---

## 11-9. カバレッジの確認（オプション）

テストがどれくらいコードをカバーしているか確認できます：

```bash
pnpm test --coverage
```

> NOTE
> カバレッジを 100% にすることが目標ではありません。
> 重要なビジネスロジック（Service 層・Repository 層）が十分にテストされていることが大切です。

---

## まとめと次のステップ

この章では以下を学びました：

- テストは「バリデーション（Unit）」「Service（Unit + mock）」「Repository（Integration）」の 3 層に分ける
- Repository テスト：`:memory:` SQLite + `vi.spyOn(getDB)` で実際の DB 操作を確認
- Service テスト：`vi.mock` で Repository を差し替えてロジックだけを確認
- バリデーションテスト：Zod スキーマが正しく動くか確認

> NOTE
> Biome のコードチェック（`pnpm lint`・`pnpm format`）と Lefthook の pre-commit フックは
> 第 01 章でセットアップ済みです。毎コミット時に自動で動いています。

次の第 12 章では **React Compiler と Turbopack** について、なぜ `useMemo` を書かないかを読み物形式で学びます。

→ [第 12 章：React Compiler + Turbopack](./12-react-compiler.md)
