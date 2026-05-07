# 新人フロントエンドエンジニア向け ハンズオン研修

このドキュメント群は、**dashboard-playground-nextjs** を題材に Next.js アプリケーションをゼロから作り上げる研修用の手順書です。

---

## 研修の目標

このリポジトリを自分の手で**再実装できる**ようになること。最終的には以下がすべて動く状態を目指します。

- Google アカウントでログイン / ログアウト
- タスクの作成・一覧・編集・削除
- 検索とフィルタリング（URL に状態を持つ）
- ダッシュボードにタスク統計を表示
- `pnpm build && pnpm start` で本番起動

---

## 対象読者

- Next.js の経験が約半年ある方（App Router の基本は知っているが、Server Actions・Cache Components・RSC の動きが曖昧な方）
- TypeScript・React が読み書きできる方

---

## 章構成・所要時間

| #    | 章タイトル                         | 到達点                                                          | 時間    |
| ---- | ---------------------------------- | --------------------------------------------------------------- | ------- |
| [00](./00-orientation.md) | はじめに / 完成形ツアー   | 完成版を動かし、画面・URL・データの対応をイメージできる         | 30 分   |
| [01](./01-foundation.md)  | プロジェクト基盤の仕組み  | 空ディレクトリから `pnpm dev` で空ページ描画。RSC・Biome・Lefthook を口頭で説明可 | 90 分   |
| [02](./02-tailwind-shadcn.md) | Tailwind v4 + shadcn/ui | `globals.css` の `@theme` を理解し、shadcn コンポーネントを表示 | 60 分   |
| [03](./03-routing.md)     | App Router・layout・ルート | `/login`・`/`・`/tasks` の遷移と共通レイアウトが見える          | 60 分   |
| [04](./04-drizzle-sqlite.md) | Drizzle + SQLite        | `tasks` テーブルを定義し Drizzle Studio で確認できる            | 60 分   |
| [05](./05-result-repository.md) | Result 型 / Repository 層 | 例外を投げない `taskRepository` を実装しテストが通る            | 90 分   |
| [06](./06-zod-service.md) | Zod + Service 層          | parse → repo → Result の流れを実装しテストが通る               | 60 分   |
| [07](./07-server-actions.md) | Server Actions + フォーム | `/tasks/create` で送信すると SQLite に行が増える                | 120 分  |
| [08](./08-better-auth.md) | Better Auth + Google OAuth | Google ログイン→ログアウトと二段認証ガードが機能する            | 120 分  |
| [09](./09-cache-components.md) | Cache Components       | タスク作成後に一覧・統計が即更新される                          | 75 分   |
| [10](./10-nuqs-zustand.md) | nuqs + Zustand           | フィルタが URL に反映、削除ダイアログが Zustand で開閉する       | 75 分   |
| [11](./11-vitest-biome.md) | Vitest でテストを書く     | 全テストが緑になる（Biome・Lefthook は第 01 章でセットアップ済み） | 60 分   |
| [12](./12-react-compiler.md) | React Compiler + Turbopack | `useMemo` を書かない設計の理由を説明できる（読み物中心）        | 30 分   |
| [13](./13-finishing.md)   | 仕上げ：Dashboard + デプロイ準備 | ダッシュボード統計が表示され `pnpm start` で本番起動できる | 60 分   |

**合計 約 16〜20 時間（研修 2〜3 日想定）**

---

## 章間の依存関係

章は以下の順序で進めてください。矢印は「先に完了させる必要がある章」を示します。

```
00 ─┐
    ├─> 01 ─> 02 ─> 03 ─┐
    │                   ├─> 07（Server Actions）
    └──> 04 ─> 05 ─> 06 ┘          │
                                    ├─> 09（Cache）
                        08（Auth）──┤
                                    └─> 10（URL / クライアント状態）
                                               │
                                               ├─> 11（テスト）
                                               ├─> 12（Compiler 読み物）
                                               └─> 13（仕上げ）
```

| 依存の種類          | 具体例                                      |
| ------------------- | ------------------------------------------- |
| **必須直列**        | 04 → 05 → 06 → 07（DB → Repo → Service → Action） |
| **入替可**          | 02 と 03 は独立、03 と 04 はどちらが先でも可  |
| **後回しで OK**     | 08（Auth）は 07 の後で問題なし              |

---

## 進め方（受講者向け）

### 1. 作業ブランチを切る

```bash
git switch -c training/<自分の名前>
# 例: git switch -c training/yamada
```

### 2. 章の手順に従って実装する

各章の末尾に `> CHECK` という確認リストがあります。すべてにチェックが入ったら次の章へ進みます。

### 3. 詰まったら

各章の `<details>` ブロックが HINT です。**まず 30 分は自力で考えてください。** それでも解決しない場合は HINT を開き、さらに詰まったら `main` ブランチの完成形コードを参照します。

```bash
# 特定ファイルの答えを表示する
git show main:app/(authed)/tasks/actions/tasks.ts
```

### 4. 章ごとにコミットする

```bash
git add -p   # 変更を確認しながらステージング
git commit -m "ch01: Next.js + Biome のセットアップ"
```

最終的に PR を出して講師のレビューを受けます。

---

## 注意事項

- **`.env.local` は絶対にコミットしない**（`.gitignore` 済みですが念のため）
- **`local.db` もコミットしない**（`.gitignore` 済み）
- 第 08 章で Google OAuth を設定するため、事前に Google アカウントが必要です
- 不明点は Slack の研修チャンネルへ

---

## このリポジトリと手順書の関係

`main` ブランチには完成形のコードが入っています。手順書は「**完成形を自分の手で再現する手引き**」です。

| main ブランチ          | docs/training/（この手順書）      |
| ---------------------- | --------------------------------- |
| 完成形コード           | 作り方のガイド                    |
| いつでも参照可         | 30 分悩んでから開くことを推奨     |

---

## 参考リンク

- [このリポジトリの README](../../README.md)
- [CLAUDE.md（設計思想・コーディング規約）](../../CLAUDE.md)
- [Next.js 公式ドキュメント](https://nextjs.org/docs)
- [Better Auth 公式ドキュメント](https://www.better-auth.com/docs)
- [Drizzle ORM 公式ドキュメント](https://orm.drizzle.team/docs)
