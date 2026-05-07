# CLAUDE.md

新人フロントエンドエンジニア向けの **Next.js 研修教材** リポジトリ。タスク CRUD と Google OAuth 認証を備えたダッシュボード Web アプリケーションを、研修生がゼロから実装することを想定している。

`lib/` 配下のバックエンド・DB・認証設定は提供済み。研修生は主に `app/` 配下のフロントエンドを実装していく。

---

## コマンド

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # プロダクションビルド
pnpm lint         # Biome チェック（エラーあると exit 1）
pnpm format       # Biome 自動修正（lint + format + import 整列）
pnpm test         # Vitest 単体テスト
pnpm db:push      # スキーマを DB に反映（開発用・マイグレーションファイル不要）
pnpm db:generate  # マイグレーションファイル生成
pnpm db:migrate   # マイグレーション実行
pnpm db:seed      # シードデータ投入
pnpm db:studio    # Drizzle Studio 起動
```

Claude Code 用カスタムコマンド：

- `/setup` — 開発環境のセットアップ（依存関係・Biome・Lefthook・DB・Lint まで一括）
- `/db-setup` — データベースのセットアップ（`db:push` + `db:seed`）
- `/db-setup reset` — DB を初期化して再セットアップ

---

## 設計思想

### 関数型プログラミング

- クラスを使わない。ロジックは**関数**またはオブジェクトリテラル（メソッドの集合）で表現する
- 状態変異を避け、変換のパイプラインとして処理を組み立てる
- エラーは例外でなく **`Result<T, E>`** 型で返す（後述）

### コロケーション（ディレクトリ構成）

コンポーネントはそれを使うルートの隣に置く。共有されない限り `app/(authed)/` の外に出さない。

```
app/(authed)/tasks/
├── page.tsx
├── components/       ← tasks ページ専用コンポーネント
├── actions/tasks.ts  ← tasks の Server Actions
├── constants/
├── lib/nuqs/
└── stores/
```

### レイヤードアーキテクチャ（バックエンド）

```
Server Action  →  Service  →  Repository  →  DB（Drizzle + SQLite）
```

| レイヤー | 場所 | 責務 |
|---|---|---|
| Repository | `lib/db/repositories/` | DB アクセスのみ。副作用を閉じ込める |
| Service | `lib/db/services/` | バリデーション + ビジネスロジック |
| Server Action | `app/(authed)/*/actions/` | キャッシュ制御・リダイレクト・フォーム処理 |

**各レイヤーは必ず `Result<T>` を返す。例外を外に投げない。**

---

## Result 型

`lib/result.ts` の `Result<T, E>` を使う。`lib/errors.ts` の `AppError` がデフォルト型。

```ts
// ✅ 正しい
return ok(task);
return err(databaseError("Failed to fetch", error));

// ❌ やらない
throw new Error("Failed to fetch");
```

処理の分岐には `isOk` / `isErr` を使う。

```ts
const result = await taskRepository.getById(id);
if (isErr(result)) return result;  // エラーをそのまま上に伝播
doSomething(result.value);
```

---

## エラー型

`lib/errors.ts` に定義された `AppError` discriminated union を使う。

- `databaseError` — DB 操作の失敗
- `apiError` — ビジネスロジック上の失敗（404 など）
- `validationError` — 入力バリデーション失敗
- `unknownError` — 予期しない例外

Zod エラーは `zodErrorToAppError(parseResult.error)` で `AppError` に変換する。

---

## 認証

二重のガード構造になっている。

1. **`proxy.ts`**（edge runtime）— Cookie の有無のみ確認。`better-auth/cookies` の `getSessionCookie` を使う。`better-sqlite3` は edge で動かないため DB アクセス不可。
2. **`app/(authed)/layout.tsx` の `AuthGate`**（Node.js RSC）— `auth.api.getSession()` で DB のセッションを検証。Cookie が残っていても DB セッションが失効していればリダイレクト。

認証ライブラリ: **Better Auth v1.6**。設定は `lib/auth.ts`（サーバー）と `lib/auth-client.ts`（クライアント）。

---

## キャッシュ

`next/cache` の `cacheTag` / `updateTag` を使う。タグ定数は `lib/cache/tags.ts` に集約している。

```ts
// 読み取り時
"use cache";
cacheTag(CACHE_TAGS.TASKS);

// 更新時（Server Action 内）
updateTag(CACHE_TAGS.TASKS);
updateTag(CACHE_TAGS.DASHBOARD);
```

**`auth.api.getSession({ headers: await headers() })` を `unstable_cache` で包まない**。リクエストスコープの値がキャッシュに混入してセッション漏洩が起きる。

---

## フォーム

Server Actions を `useActionState` で呼ぶパターンを採用。prev state は `Result<T> | null`。

---

## DB スキーマ管理

- 開発: `pnpm db:push`（スキーマを直接反映、マイグレーションファイル不生成）
- 本番相当: `pnpm db:generate` → `pnpm db:migrate`

スキーマは `lib/db/schema.ts` に一元管理（tasks テーブル + Better Auth の 4 テーブル）。

---

## テーマ

`next-themes` を使ってライト / ダーク / カスタムテーマの切り替えを実装している。

### 仕組み

```
THEMES 定数（themes.ts）
    ↓ id の一覧を ThemeProvider に渡す
ThemeProvider（layout.tsx）
    ↓ attribute="class" で <html class="dark"> を付与
CSS 変数（globals.css の :root / .dark / .ocean ...）
    ↓ クラスに対応した変数セットが有効になる
Tailwind ユーティリティ（bg-background など）
    ↓ CSS 変数を参照
画面の色が切り替わる
```

### ファイル構成

| ファイル | 役割 |
|---|---|
| `lib/constants/themes.ts` | テーマ定義（`THEMES` / `THEME_IDS`）の単一管理場所 |
| `components/ThemeProvider.tsx` | next-themes のラッパー（`"use client"` を閉じ込める） |
| `components/AppHeader/components/ToggleThemeButton/` | ドロップダウンで切り替えるボタン |
| `app/globals.css` | `:root`（ライト）/ `.dark` / カスタムテーマの CSS 変数 |

### 新しいテーマを追加する手順

**変更箇所は 2 ファイルだけ。**

```ts
// 1. lib/constants/themes.ts に追加
import { Waves } from "lucide-react";

export const THEMES: ThemeDef[] = [
  { id: "light", label: "ライト", Icon: Sun },
  { id: "dark",  label: "ダーク", Icon: Moon },
  { id: "ocean", label: "オーシャン", Icon: Waves }, // ← 追加
];
```

```css
/* 2. app/globals.css の「追加カラーテーマ」コメントの下に追加 */
/* クラス名は themes.ts の id と一致させること */
.ocean {
  --background: oklch(0.96 0.025 220);
  --foreground: oklch(0.15 0.03 220);
  --primary: oklch(0.45 0.18 220);
  --primary-foreground: oklch(0.98 0.005 220);
  /* 変えたい変数だけ上書き。未定義の変数は :root の値にフォールバック */
}
```

`ThemeProvider`・`ToggleThemeButton`・Tailwind クラスは変更不要。`THEMES` を読んで自動で反映される。

### 注意点

- `<html suppressHydrationWarning>` が必要 — next-themes は初回描画時に localStorage の値で `<html>` の class を書き換えるため、サーバー HTML との差異が出て React の hydration 警告が発生する。このフラグで警告だけを抑制する（バグではない）。
- `enableSystem={false}` — OS のダークモード設定への自動追従を無効にしている。明示的に選択する仕様にするため。
- `disableTransitionOnChange` — テーマ切替の瞬間だけ CSS transition を無効にしてチカチカを防ぐ。

## コードスタイル

- Biome でフォーマット・lint を統一（インデント 2 スペース、import 自動整列）
- `import type` を型 import に使う（Biome の `useImportType` ルール）
- CSS フレームワークは Tailwind CSS v4。クラス結合には `cn()` を使う（`lib/utils.ts`）
- **コメントは積極的に書く**。本プロジェクトは研修・学習目的のため、コードが「何をしているか・どう動くか」を日本語で説明するコメントを歓迎する。処理の流れ、引数・戻り値の意味、設計上の意図をわかりやすく記載すること

---

## 研修ドキュメント

`docs/training/` 配下に全 14 章の手順書がある。読者は `docs/training/README.md` から始める。
