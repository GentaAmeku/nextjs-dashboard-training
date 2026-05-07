このプロジェクトの開発用 SQLite データベースをセットアップします。

引数: $ARGUMENTS
- 引数が `reset` の場合は既存のデータベースファイルを削除してからセットアップを行います。

## 実行手順

### ステップ 1: リセット（`reset` 指定時のみ）

`$ARGUMENTS` が `reset` の場合、以下を実行してください。

```bash
rm -f local.db local.db-shm local.db-wal
```

削除後、その旨を報告してください。

### ステップ 2: スキーマの反映

```bash
pnpm db:push
```

エラーが発生した場合は以下を確認し、原因を報告してください。
- `lib/db/schema.ts` の構文エラー
- `drizzle.config.ts` の設定ミス
- `local.db` がロックされていないか（開発サーバーが起動中でないか）

### ステップ 3: シードデータの投入

```bash
pnpm db:seed
```

出力に以下のいずれかが含まれることを確認し、結果を報告してください。
- `Successfully added seed data` → 正常に投入された
- `already has data` → 既にデータがあるためスキップ

エラーが発生した場合は以下を確認してください。
- `scripts/seed.ts` の構文エラー
- `local.db` がロックされていないか（開発サーバーが起動中でないか）

### ステップ 4: 結果の確認

```bash
sqlite3 local.db ".tables"
```

以下の 5 テーブルが存在することを確認し、一覧を報告してください。
- `account`, `session`, `tasks`, `user`, `verification`

テーブルが不足している場合は `pnpm db:push` の再実行を提案してください。

## 完了報告

全ステップが成功したら、テーブル一覧と投入されたデータの状態を簡潔にまとめてください。
その後、`pnpm dev` で開発サーバーを起動できることをユーザーに案内してください。
