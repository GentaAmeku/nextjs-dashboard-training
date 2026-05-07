このプロジェクトの開発環境をセットアップします。以下の手順を順に実行し、各ステップの結果を簡潔に報告してください。

---

## 1. Node.js の確認

`node -v` を実行し、バージョンを確認してください。

- 推奨バージョンは **Node.js 24.11.1** です。
- メジャーバージョンが異なる場合はその旨をユーザーに伝えてください。ただしセットアップは続行してください。

---

## 2. pnpm の確認

`pnpm -v` を実行してください。

- コマンドが存在する場合はバージョンを報告してください。
- 見つからない場合は以下のいずれかを案内し、ユーザーに選択を求めてセットアップを一時停止してください。

```bash
# 推奨: Corepack を使う方法
corepack enable && corepack prepare pnpm@latest --activate

# または npm でグローバルインストール
npm install -g pnpm
```

---

## 3. 依存関係のインストール

```bash
pnpm install
```

完了したらパッケージ数を報告してください。

> NOTE: `package.json` の `prepare` スクリプト（`lefthook install`）が自動実行されるため、
> Lefthook の Git フックはこの時点でインストールされます。

---

## 4. biome.json の確認・生成

`biome.json` が存在するか確認してください。

```bash
test -f biome.json && echo "exists" || echo "not found"
```

**存在する場合：** そのまま次へ進んでください。

**存在しない場合：** 以下の内容で `biome.json` を作成してください。

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.13/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": ["**", "!node_modules", "!.next", "!dist", "!build"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noUnknownAtRules": "off"
      }
    },
    "domains": {
      "next": "recommended",
      "react": "recommended"
    }
  },
  "css": {
    "parser": {
      "tailwindDirectives": true
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

作成後、その旨を報告してください。

---

## 5. .lefthook.yml の確認・生成

`.lefthook.yml` が存在するか確認してください。

```bash
test -f .lefthook.yml && echo "exists" || echo "not found"
```

**存在する場合：** そのまま次へ進んでください。

**存在しない場合：** 以下の内容で `.lefthook.yml` を作成し、フックを再インストールしてください。

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: pnpm lint
      stage_fixed: true
    format:
      run: pnpm format
      stage_fixed: true
```

```bash
pnpm lefthook install
```

作成・インストール後、その旨を報告してください。

---

## 6. 環境変数ファイルの確認

`.env.local` が存在するか確認してください。

```bash
test -f .env.local && echo "exists" || echo "not found"
```

**存在する場合：** そのまま次へ進んでください。

**存在しない場合：** 以下を案内してください。

```bash
cp .env.example .env.local
```

コピー後、以下の 3 つの値を `.env.local` に設定する必要があることを伝えてください。

| 変数名 | 設定方法 |
|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` で生成した値を貼り付ける |
| `GOOGLE_CLIENT_ID` | Google Cloud Console で発行した OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console で発行した OAuth クライアントシークレット |

設定ができたら続行するよう案内してください（Claude Code を使っている場合はユーザーが設定後に「続けて」と伝えてもらう）。

---

## 7. データベースのセットアップ

### 7-1. スキーマの反映

```bash
pnpm db:push
```

エラーが発生した場合は以下を確認し、原因を報告してください。

- `lib/db/schema.ts` の構文エラー
- `drizzle.config.ts` の設定ミス
- `local.db` がロックされていないか（開発サーバーが起動中でないか）

### 7-2. シードデータの投入

```bash
pnpm db:seed
```

出力に以下のいずれかが含まれることを確認し、結果を報告してください。

- シード完了のメッセージ → 正常に投入された
- 「スキップします」のメッセージ → 既にデータがあるためスキップ

### 7-3. テーブルの確認

```bash
sqlite3 local.db ".tables"
```

以下の 5 テーブルが存在することを確認し、一覧を報告してください。

- `account`, `session`, `tasks`, `user`, `verification`

テーブルが不足している場合は `pnpm db:push` の再実行を提案してください。

---

## 8. Biome の動作確認

```bash
pnpm lint
```

- エラーがなければ「✅ lint クリーン」と報告してください。
- エラーがある場合は内容を報告し、`pnpm format` で自動修正できる旨を伝えてください。

---

## 9. 完了報告

全ステップが完了したら、以下の情報を簡潔にまとめて報告してください。

- Node.js バージョン
- biome.json・.lefthook.yml の状態（既存 or 新規生成）
- DB テーブル一覧
- lint の結果

その後、次のステップをユーザーに案内してください。

```
セットアップ完了！次のコマンドで開発を始められます:

  pnpm dev   →  http://localhost:3000

困ったときのコマンド:
  /db-setup reset   —  DB を初期化してシードを再投入
  pnpm lint         —  コードをチェック
  pnpm format       —  コードを自動修正
  pnpm test         —  テストを実行
```
