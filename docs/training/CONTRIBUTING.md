# 研修教材 作成ガイドライン

ハンズオン章を**追加・改訂**するときに従う執筆規約です。
章ごとに書き方がバラバラだと「読む版と書く版が食い違う」「同じ部品を何度も作り直す」といった混乱（過去の状態）が再発します。本ガイドラインは、それを防ぐための合意事項です。

> このドキュメントは受講者向けではなく **教材メンテナ向け** です。

---

## 0. 前提：2つのリポジトリの役割

| リポジトリ | 役割 |
|---|---|
| 研修リポジトリ（このリポジトリ） | 受講者がクローンして実装する**作業リポジトリ**。`lib/`・shadcn 部品・共通シェルの**出発版**が同梱済み |
| 回答リポジトリ（`dashboard-playground-nextjs`） | **完成系コード**。`answer` リモートとして登録し `git show answer/main:<path>` で参照する |

受講者は **fresh scaffold（`create-next-app`）しない**。クローン型で統一する。

---

## 1. デザインはコピー、ロジックは自作

- **デザイン（JSX マークアップ・Tailwind・shadcn 部品）** は完成系（`answer`）から**コピー**して進める。手書きの簡易版を書かせない。
- **ロジック・Next.js の仕組み**（ルーティング、Server Actions、RSC、キャッシュ、認証フロー、Result の流れなど）は受講者が**自分で組む／理解する**。これが各章の主目的。
- コードブロックは「完成系からの抜粋」を原則とし、**完成系と命名・import・props を一致**させる（PARITY）。

> ❌ 完成系には `TaskList/container.tsx`＋`presentational.tsx` があるのに、章では生 `<li>` の簡易リストを書かせる
> ✅ 完成系の構造をそのまま使い、データ取得（Server Component）の仕組みに集中させる

---

## 2. 共通シェルは「段階的に育てる」

`AppSidebar` / `AppHeader` / `PageContainer` など複数章にまたがる共通部品は、**同一ファイルを章ごとに追記して育てる**。捨てコードを書かせない。

| ファイル | 出発版（seed 同梱） | 後続章で追記 |
|---|---|---|
| `app/layout.tsx` | fonts + html/body + globals | ch8: `NuqsAdapter` ／ ch10: `ThemeProvider`・`suppressHydrationWarning` |
| `app/(authed)/layout.tsx` | `SidebarProvider` + シェル合成（Gate無し） | ch6: `AuthGate`（`Suspense`+`getSession`+`redirect`） |
| `app/(authed)/components/AppSidebar` | ナビリンクのみ | ch6: ユーザー情報 + `signOut`（`SidebarFooter`） |
| `app/(authed)/components/AppHeader` | `SidebarTrigger` のみ | ch10: `ToggleThemeButton` を配線 |

- 同じファイルを**別設計で作り直さない**。前章の続きに**差分追記**する。
- 「ある章で書いたものを別の章で捨てる」構成は禁止。

---

## 3. 置き場所は colocation で統一

- 共通コンポーネントは **`app/(authed)/components/`** に置く（完成系と一致）。
- アプリ全体のプロバイダ（例: `ThemeProvider`）のみ top-level `components/` に置く。
- ページ専用コンポーネントはそのルートの隣（例: `app/(authed)/tasks/components/`）。
- top-level `components/` に画面部品を散らさない。

---

## 4. 1ファイル1正典（Single Source of Truth）

- 「完成版を先に丸ごと読ませてから、別の簡易版を書かせる」という二重化を作らない。
- ある章で提示するファイルは、**その時点で受講者が実際に持つ状態**と一致させる。
- 完成形の全体像を見せたいときは「これは ch◯ 完了時点の最終形」と**明記**し、当該章で作るのは差分であることを示す。

---

## 5. 章の動線は「layout / コンテナ → page / 機能」

実開発の流れに合わせ、**先に器（layout・コンテナ）を組み、次に中身（page・機能）を作る**。

---

## 6. `lib/` はインターフェース先行

- Server Action などから `lib/`（Service / Repository）を呼ぶ章では、**まず「何を受け取り何を返すか（型・`Result<T>`）」だけを短く説明**してから使う。
- 内部実装（Repository / Service の中身、Result/AppError の定義）は**深掘り章**（Result/Repository、Zod/Service 章）で読み解く。
- 深掘り章は「読み解く」スタンス。すでに同梱・使用済みのコードを**実装し直させない**（`touch lib/...` でゼロから書かせない）。

---

## 7. URL 状態は nuqs に一本化

- URL クエリ状態は **nuqs**（`createSearchParamsCache` / `useQueryStates`）を唯一の入口として教える。
- 生の `searchParams` を手動で destructuring・パースする教材は書かない（nuqs と重複するため）。
- 動的セグメント `[id]` / `params` は searchParams とは別物。**それを実際に使う章**（編集ページ）で導入する。

---

## 8. 概念は「初出＝実使用」の章で、実コードとして導入

- 宙に浮いたサンプルスニペット（本文のコードと接続しない例示）を置かない。
- 各概念は、それが**実際に使われる章**で、動く実コードの一部として説明する。

---

## 9. 章テンプレート

```md
# 第 NN 章：タイトル

## この章の目標
> CHECK（到達点と一致するチェック項目）

## NN-1. 概念（必要十分に）

## NN-2. レイアウト / コンテナを組む   ← 動線：器が先

## NN-3. ページ / 機能を作る            ← 中身は後

## 動作確認（pnpm dev で確認する手順）
> TRY / HINT（<details>）

## まとめと次のステップ
```

- 完成系を参照させる箇所は `git show answer/main:<path>` を併記。
- デザインをコピーしてよい箇所は `[!TIP]` で明示する。
