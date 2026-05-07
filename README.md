# 📚 Next.js Dashboard Training

新人フロントエンドエンジニア向けの **Next.js ハンズオン研修教材** です。

タスク CRUD と Google OAuth 認証を備えたダッシュボード Web アプリケーションを、ゼロから自分の手で再実装することを通じて、**Next.js 16 + React 19 の主要機能**（App Router・Server Components・Server Actions・Cache Components など）を学びます。

---

## 🎯 研修のゴール

このリポジトリを Fork して、章ごとの手順書に従って実装を進めると、最終的に以下が動くアプリケーションが完成します。

- 🔐 Google アカウントによる認証（未ログイン時はログイン画面へリダイレクト）
- 📈 タスク統計情報の表示（総数、ステータス別、優先度別、完了率）
- ✏️ タスクの作成・編集・削除
- 🔍 タスクの検索とフィルタリング（URL に状態を持つ）

---

## 🛠️ 技術スタック

### フロントエンド

- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui**

### 認証

- **Better Auth** — Google OAuth 認証・セッション管理

### バックエンド・データベース

- **Drizzle ORM** + **SQLite (better-sqlite3)**
- **Zod** — バリデーション

### 状態管理・フォーム

- **Zustand** — クライアント状態管理
- **React Hook Form** — フォーム管理
- **nuqs** — URL 状態管理（クエリパラメータ）

### 開発ツール

- **Biome** — リンター・フォーマッター
- **Vitest** — テストランナー
- **Lefthook** — Git フック管理

---

## 🚀 はじめかた

### 1️⃣ Fork する

GitHub の右上の **Fork** ボタンから、このリポジトリを自分のアカウントに Fork してください。

その後、ローカルにクローンします。

```bash
git clone git@github.com:<your-account>/nextjs-dashboard-training.git
cd nextjs-dashboard-training
```

### 2️⃣ 作業ブランチを切る

```bash
git switch -c training/<your-name>
```

### 3️⃣ 環境構築（Claude Code を使う場合）

Claude Code をこのリポジトリで起動し、以下のコマンドを実行してください。

```
/setup
```

これだけで以下がすべて完了します：

- 依存関係のインストール（`pnpm install`）
- `biome.json` / `.lefthook.yml` の確認・生成
- `.env.local` の作成案内
- データベースのセットアップ（`pnpm db:push` + `pnpm db:seed`）
- Lint・Lefthook フックの動作確認

### 3️⃣' 環境構築（手動の場合）

```bash
# 依存関係をインストール
pnpm install

# 環境変数ファイルを作成（中身は手動で設定する必要あり）
cp .env.example .env.local

# データベースをセットアップ
pnpm db:push && pnpm db:seed
```

`.env.local` に以下を設定する必要があります（詳細は `.env.example` を参照）：

| 変数名 | 設定方法 |
|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` で生成 |
| `GOOGLE_CLIENT_ID` | Google Cloud Console で発行 |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console で発行 |

### 4️⃣ 研修ドキュメントを開く

```
docs/training/README.md
```

全 14 章の手順書があります。最初は `00-orientation.md` から順に進めてください。

---

## 📦 提供されているもの

研修開始時点で、以下は **完成形が提供されています**（フロントエンドエンジニア向け研修のため、バックエンドの実装に時間を使わず、UI 実装に集中するための配慮です）。

```
lib/
├── auth.ts                # Better Auth サーバー設定
├── auth-client.ts         # Better Auth クライアント設定
├── cache/tags.ts          # キャッシュタグ定数
├── db/
│   ├── client.ts          # Drizzle クライアント
│   ├── schema.ts          # テーブル定義
│   ├── seed.ts            # シードデータ
│   ├── repositories/      # Repository 層（タスク CRUD）
│   └── services/          # Service 層（バリデーション）
├── errors.ts              # AppError 型
├── result.ts              # Result<T, E> 型
├── utils.ts               # cn() などのユーティリティ
└── validation/            # Zod バリデーションスキーマ

proxy.ts                   # 認証ガード（Edge Runtime）
scripts/seed.ts            # シードスクリプト
drizzle.config.ts          # Drizzle Kit の設定
```

研修生は基本的に **`app/` 配下のフロントエンドを実装する** ことになります。

---

## 📝 利用可能なスクリプト

```bash
pnpm dev          # 開発サーバー起動（http://localhost:3000）
pnpm build        # 本番用ビルド
pnpm start        # 本番サーバー起動
pnpm lint         # Biome チェック
pnpm format       # Biome 自動修正
pnpm test         # Vitest テスト実行
pnpm db:push      # スキーマを DB に反映（開発用）
pnpm db:seed      # シードデータを投入
pnpm db:studio    # Drizzle Studio 起動（DB の GUI）
```

---

## 🆘 困ったときは

- 各章末の `> CHECK` リストで進捗を確認
- 各章の `<details>` ブロック（HINT）を開く
- それでも詰まったら、講師または研修担当者に質問
- 完成形コードを参考にしたい場合は、元リポジトリ ([dashboard-playground-nextjs](https://github.com/GentaAmeku/dashboard-playground-nextjs)) を参照

---

## 📜 ライセンス

研修教材として自由に使ってください。
