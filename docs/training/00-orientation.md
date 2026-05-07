# 第 00 章：はじめに / 完成形ツアー

## この章の目標

> **CHECK**
> - [ ] 完成版のアプリを `pnpm dev` で起動できる
> - [ ] ログイン・タスク一覧・作成・編集・削除の流れを体験できる
> - [ ] URL の変化とデータの対応がイメージできる
> - [ ] プロジェクトのディレクトリ構成をざっくり把握できる

---

## 0-1. この研修について

この研修では **dashboard-playground-nextjs** を自分の手でゼロから再実装します。

完成形のコードは `main` ブランチにすべて入っています。まずは完成版を動かして「何を作るのか」を体感してから、各章で順番に実装していきましょう。

> NOTE
> 完成形コードを最初に見ることは、学習においてとても有効です。
> ゴールのイメージがあると、途中で迷ったときに「自分が今どこにいるか」を把握しやすくなります。

---

## 0-2. 完成版を動かす

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の設定（第 08 章で詳しく説明します。今は仮の値でも OK）
cp .env.example .env.local

# 3. データベースのセットアップ
pnpm db:push && pnpm db:seed

# 4. 開発サーバーの起動
pnpm dev
```

ブラウザで `http://localhost:3000` を開きます。

> NOTE
> `.env.local` に Google OAuth の設定を入れていないと、ログインボタンを押してもエラーになります。
> 今は「ログインページが表示されること」だけ確認できれば十分です。
> 第 08 章で Google Cloud Console の設定を一緒に行います。

---

## 0-3. 画面の流れを確認する

Google ログインできる環境があれば、以下の流れを体験してみましょう。

```
① http://localhost:3000 にアクセス
     ↓（未ログインのためリダイレクト）
② /login ページ
     ↓（Google でサインイン）
③ / （ダッシュボード）
     ↓（サイドバーの "Tasks" をクリック）
④ /tasks （タスク一覧）
     ↓（右上の "タスクを作成" ボタン）
⑤ /tasks/create （タスク作成フォーム）
     ↓（フォームを入力して送信）
⑥ /tasks （一覧に戻る、新しいタスクが表示されている）
```

> TRY
> - 検索ボックスにキーワードを入力してみましょう。URL の `?name=xxx` が変化します
> - ステータスや優先度でフィルタリングしてみましょう
> - タスクの編集画面（鉛筆アイコン）と削除（ゴミ箱アイコン）を試してみましょう

---

## 0-4. プロジェクト構造のツアー

```bash
# ファイル一覧を確認する
ls -la
```

重要なディレクトリとファイルを確認しましょう。

```
dashboard-playground-nextjs/
├── app/                        ← Next.js App Router のルート定義
│   ├── (authed)/               ← ログイン必須のページ群（ルートグループ）
│   │   ├── layout.tsx          ← 認証チェック + サイドバー / ヘッダー
│   │   ├── page.tsx            ← ダッシュボードページ
│   │   ├── components/         ← このエリア専用のコンポーネント
│   │   └── tasks/              ← タスク関連のすべて（ページ・アクション・コンポーネント）
│   ├── actions/                ← ダッシュボード用 Server Actions
│   ├── api/auth/               ← Better Auth のハンドラ
│   ├── login/                  ← ログインページ
│   ├── globals.css             ← グローバルスタイル（Tailwind v4）
│   └── layout.tsx              ← ルートレイアウト（html / body のみ）
│
├── components/
│   └── ui/                     ← shadcn/ui コンポーネント（自動生成）
│
├── lib/                        ← ビジネスロジックと共有ユーティリティ
│   ├── auth.ts                 ← Better Auth サーバー設定
│   ├── auth-client.ts          ← Better Auth クライアント設定
│   ├── cache/tags.ts           ← キャッシュタグ定数
│   ├── db/                     ← データベース関連（schema / client / repo / service）
│   ├── errors.ts               ← AppError 型の定義
│   ├── result.ts               ← Result<T, E> 型の定義
│   ├── utils.ts                ← cn() などのユーティリティ
│   └── validation/             ← Zod バリデーションスキーマ
│
├── proxy.ts                    ← 認証ガード（Edge Runtime）
├── drizzle.config.ts           ← Drizzle Kit の設定
├── next.config.ts              ← Next.js の設定
├── biome.json                  ← Biome（lint / format）の設定
├── .lefthook.yml               ← Git フック（pre-commit）
├── vitest.config.mts           ← テストの設定
└── .env.example                ← 環境変数のテンプレート
```

> NOTE
> `(authed)` のカッコは Next.js の「ルートグループ」という仕組みです。
> URL には影響せず、ディレクトリをグループ化するだけの機能です。
> 第 03 章で詳しく説明します。

---

## 0-5. 技術スタックの確認

```bash
# package.json を眺めて、何が使われているか確認しましょう
cat package.json
```

このアプリで使われている主要な技術を把握しておきましょう。

| カテゴリ           | ライブラリ                                    |
| ------------------ | --------------------------------------------- |
| フレームワーク     | Next.js 16, React 19                          |
| 言語               | TypeScript                                    |
| スタイル           | Tailwind CSS v4, shadcn/ui                    |
| データベース       | SQLite (better-sqlite3), Drizzle ORM          |
| バリデーション     | Zod                                           |
| 認証               | Better Auth + Google OAuth                    |
| フォーム           | React Hook Form                               |
| URL 状態管理       | nuqs                                          |
| クライアント状態   | Zustand                                       |
| テスト             | Vitest                                        |
| lint / format      | Biome                                         |
| Git フック         | Lefthook                                      |
| バンドラ（dev）    | Turbopack（Next.js 16 デフォルト）            |

---

## 0-6. 利用可能なコマンドを確認する

```bash
# pnpm で実行できるスクリプト一覧
cat package.json | grep -A 20 '"scripts"'
```

研修中によく使うコマンドをまとめます。

```bash
pnpm dev          # 開発サーバー起動（http://localhost:3000）
pnpm build        # 本番用ビルド
pnpm start        # 本番サーバー起動（build 後に使う）
pnpm test         # Vitest 単体テスト実行
pnpm lint         # Biome でコードチェック
pnpm format       # Biome で自動修正
pnpm db:push      # スキーマを DB に反映（開発用）
pnpm db:seed      # シードデータを投入
pnpm db:studio    # Drizzle Studio を起動（DB の GUI）
```

---

## 0-7. 研修の進め方

この研修では**ゼロから実装**しますが、`main` ブランチには完成形のコードが入っています。

詰まったときはいつでも参照できます。ただし、すぐに答えを見ると学習効果が落ちるので、**まず 30 分は自力で考えることを推奨します**。

```bash
# 特定ファイルの完成形を表示する
git show main:app/(authed)/tasks/actions/tasks.ts

# main ブランチとの差分を見る
git diff main -- lib/result.ts
```

---

## まとめと次のステップ

この章では完成版を実際に動かし、プロジェクト全体の構造と技術スタックを把握しました。

次の第 01 章では、**なぜ `pnpm dev` でブラウザにアプリが表示されるのか**を基礎から理解します。Turbopack・RSC・`proxy.ts` の仕組みを掘り下げ、開発の土台となる知識を固めます。

→ [第 01 章：プロジェクト基盤の仕組み](./01-foundation.md)
