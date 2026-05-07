# 第 01 章：プロジェクト基盤の仕組み

## この章の目標

> **CHECK**
> - [ ] `pnpm dev` / `pnpm build` / `pnpm start` の違いを説明できる
> - [ ] Turbopack が何をしているか説明できる
> - [ ] Server Component と Client Component の違いを口頭で説明できる
> - [ ] `proxy.ts` がリクエストのどこで動くか説明できる
> - [ ] 空ディレクトリから Next.js + Biome + Lefthook をセットアップし `pnpm dev` で空ページが表示できる

---

## 1-1. `pnpm dev` / `pnpm build` / `pnpm start` の仕組み

まず「なぜ `pnpm dev` を実行するとブラウザにアプリが表示されるのか」を理解しましょう。

### 全体の流れ図

```
[あなたが書いたコード]
       ↓ pnpm dev / pnpm build
[Next.js がコードを変換・バンドル]
       ↓
[Node.js サーバーが起動]
       ↓
[ブラウザが http://localhost:3000 にアクセス]
       ↓
[サーバーが HTML + JavaScript を返す]
       ↓
[ブラウザが画面を描画]
```

### 3 つのコマンドの違い

| コマンド      | 用途         | 特徴                                                                  |
| ------------- | ------------ | --------------------------------------------------------------------- |
| `pnpm dev`    | 開発中       | ファイルを変更するとブラウザが即座に更新される（HMR）。速度優先      |
| `pnpm build`  | 本番準備     | コード全体を最適化・圧縮。`.next/` ディレクトリに成果物を出力        |
| `pnpm start`  | 本番稼働     | `pnpm build` で作った成果物をサーバーで起動。`build` の後に実行      |

### `pnpm dev` が起動するもの

```bash
pnpm dev
# → "next dev" が実行される
# → Turbopack がコードを監視・コンパイル
# → http://localhost:3000 でサーバーが起動
# → ブラウザでアクセスできる状態になる
```

**HMR（Hot Module Replacement）** とは、コードを変更したときにページ全体をリロードせず、変更した部分だけをブラウザに送り込む仕組みです。保存するとほぼ即座に画面に反映されます。

### `pnpm build` が生成するもの

```bash
pnpm build
# → .next/ ディレクトリが生成される
```

`.next/` の中身を確認してみましょう。

```bash
ls .next/
# server/     ← サーバー側のコード（Node.js で動く）
# static/     ← クライアント側の JavaScript / CSS
# BUILD_ID    ← ビルドごとに変わる ID
# *-manifest.json  ← ルート情報などのメタデータ
```

```
[ブラウザ] ──HTTP リクエスト──> [Next.js サーバー (Node.js)]
                                        ↓
                              .next/server/app/ の中のコードを実行
                                        ↓
                              HTML + RSC ペイロードを生成
                                        ↓
[ブラウザ] <──HTML + JavaScript── [Next.js サーバー]
     ↓
.next/static/ の JS でインタラクションを追加（ハイドレーション）
```

> NOTE
> `pnpm start` は `pnpm build` が終わっていないと動きません。
> 開発中は `pnpm dev` だけ使えば OK です。

---

## 1-2. Turbopack とは何か

### webpack との違い

Next.js は長らく **webpack** というバンドラ（複数のファイルをまとめるツール）を使っていました。しかし、プロジェクトが大きくなると起動が遅くなるという問題がありました。

**Turbopack** は webpack の後継として Vercel（Next.js を作っている会社）が開発した Rust 製の高速バンドラです。

| 比較項目          | webpack               | Turbopack             |
| ----------------- | --------------------- | --------------------- |
| 言語              | JavaScript            | Rust                  |
| 対象              | dev + build           | dev（本番 build も対応予定）|
| 起動速度          | 普通〜遅い            | 高速                  |
| 特徴              | エコシステムが豊富     | 段階的なコンパイル    |

このプロジェクトでは **Next.js 16 がデフォルトで Turbopack を使います**。`--turbo` フラグは不要です。

```bash
pnpm dev
# → 内部で Turbopack が起動している
# （.next/turbopack/ ディレクトリが生成されていることで確認できる）
```

> NOTE
> Turbopack の内部実装（インクリメンタルコンパイルの仕組みなど）は深追いしなくて OK です。
> 「webpack より速い Next.js 専用のバンドラ」と覚えておけば十分です。

---

## 1-3. Server Component と Client Component

Next.js App Router の最重要概念です。ここをしっかり理解しておくと、後の章がスムーズになります。

### 従来の React と何が違うのか

従来の React（Create React App など）では、すべての処理がブラウザ（クライアント）で動いていました。

```
[ブラウザ] ← サーバーから空の HTML + JavaScript を受け取る
              ↓
           JavaScript が DB にアクセスして、データを取得
              ↓
           画面を描画する
```

この方式の問題点：
- JavaScript のサイズが大きくなる（DB のドライバーなども含まれる）
- 最初の画面表示が遅い（JS のダウンロード・実行が完了するまで何も見えない）
- シークレットキーをブラウザに送るとセキュリティリスクがある

### RSC（React Server Components）の登場

**RSC（React Server Components）** では、コンポーネントを「サーバーで実行するもの」と「ブラウザで実行するもの」に分けられます。

```
Server Component（デフォルト）
  ↓ サーバーで JSX を完成させる
  ↓ DB に直接アクセスできる
  ↓ 完成した HTML をブラウザに送る

Client Component（'use client' を書く）
  ↓ ブラウザで JavaScript が実行される
  ↓ useState / useEffect が使える
  ↓ ボタンのクリックなどのインタラクションを担う
```

### 概念図

```
┌─────────────────────────────────────┐
│           サーバー（Node.js）        │
│                                     │
│  Server Component  ──────┐          │
│  （DB アクセス可）        │          │
│                          ↓          │
│                     RSC ペイロード  │
└──────────────────────────│──────────┘
                           │ ネットワーク
                           ↓
┌─────────────────────────────────────┐
│           ブラウザ                   │
│                                     │
│  RSC ペイロードを受け取る            │
│         ↓                           │
│  HTML を描画する                     │
│         ↓                           │
│  Client Component の JavaScript を  │
│  実行してインタラクションを追加      │
│  （ハイドレーション）                │
└─────────────────────────────────────┘
```

### 判断の基準

| 使いたいもの                          | Component の種類      |
| ------------------------------------- | --------------------- |
| DB から直接データを取得したい          | Server Component      |
| `async / await` で API を呼びたい     | Server Component      |
| `useState` / `useEffect` を使いたい   | Client Component      |
| ボタンのクリックを処理したい           | Client Component      |
| ブラウザの API（window など）を使いたい | Client Component    |

### 境界の書き方

```tsx
// Server Component（デフォルト、何も書かなくていい）
export default async function TaskList() {
  const tasks = await db.select().from(tasksTable); // DB に直接アクセス
  return <ul>...</ul>;
}
```

```tsx
// Client Component（先頭に 'use client' を書く）
'use client';

export default function SearchInput() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

> NOTE
> Server Component から Client Component へはデータを渡せます（props として）。
> ただし、渡せるのはシリアライズ可能な値（文字列・数値・プレーンオブジェクト）のみです。
> 関数・クラスのインスタンスは渡せません。

---

## 1-4. `proxy.ts` のリクエストフロー

このプロジェクトには `proxy.ts` というファイルがあります。これは**すべてのリクエストの最前段で動く処理**です。

### Next.js の「リクエストの旅」

```
[ブラウザ]
    ↓ http://localhost:3000/tasks にアクセス
    ↓
[proxy.ts]（Edge Runtime）
    Cookie を確認
    ├─ Cookie なし → /login にリダイレクト
    └─ Cookie あり → 次へ
    ↓
[app/(authed)/layout.tsx の AuthGate]（Node.js / RSC）
    DB でセッションを確認
    ├─ セッション失効 → /login にリダイレクト
    └─ セッション有効 → ページを表示
    ↓
[app/(authed)/tasks/page.tsx]
    タスク一覧を表示
```

### なぜ二段構えなのか？

```
proxy.ts（Edge）          app/(authed)/layout.tsx（Node.js）
     │                           │
Cookie の有無だけ確認      DB のセッションを確認
     │                           │
 高速・軽量               より確実だが重い
     │                           │
不正アクセスの大部分を     Cookie が残っていても
   ここで弾ける            DB で失効していれば
                           ちゃんとリダイレクト
```

> NOTE
> **Edge Runtime** とは、Node.js の全機能は使えないが、世界中のサーバーに分散して超高速に動く実行環境です。
> `proxy.ts` は Edge で動くため、`better-sqlite3`（Native Module）が使えません。
> だから Cookie の存在確認だけを行い、DB のチェックは Node.js の `layout.tsx` に任せています。

### Next.js 16 の `proxy.ts`

以前のバージョンでは同じ役割のファイルを `middleware.ts` と呼んでいました。
Next.js 16 から `proxy.ts` という名前に変更されましたが、役割は同じです。

```typescript
// proxy.ts の中身（完成形）
// lib/auth.ts で DB を使うため、middleware.ts ではなく proxy.ts

import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const sessionCookie = getSessionCookie(req);

  if (!sessionCookie) {
    // Cookie がなければ /login にリダイレクト
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Cookie があれば通過
  return NextResponse.next();
}

export const config = {
  matcher: [
    // 認証不要なパスを除外する
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

---

## 1-5. ハンズオン：環境を作る

では実際にセットアップを行いましょう。

### Step 1：Node.js と pnpm の確認

```bash
node --version    # v24.x.x 以上が必要
pnpm --version    # 9.x.x 以上が推奨
```

pnpm が入っていない場合：

```bash
npm install -g pnpm
```

### Step 2：新しいディレクトリで Next.js プロジェクトを作成

```bash
# 作業用ディレクトリを作成
mkdir my-dashboard && cd my-dashboard

# Next.js アプリを作成（以下の設定で進める）
pnpm dlx create-next-app@16 .
```

プロンプトへの回答：

```
✔ Would you like to use TypeScript? → Yes
✔ Would you like to use ESLint? → No  ← Biome を使うため
✔ Would you like to use Tailwind CSS? → Yes
✔ Would you like your code inside a `src/` directory? → No
✔ Would you like to use App Router? → Yes
✔ Would you like to use Turbopack for `next dev`? → Yes
✔ Would you like to customize the import alias? → Yes → @/*
```

### Step 3：Biome のセットアップ

ESLint の代わりに Biome を使います。Biome は lint と format を1つのツールで担います。

```bash
pnpm add -D @biomejs/biome
pnpm biome init
```

生成された `biome.json` を編集します：

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
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

`package.json` のスクリプトを更新：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check",
    "format": "biome check --write"
  }
}
```

### Step 4：Lefthook のセットアップ

Lefthook は Git フック（commit 時に自動実行する処理）を管理します。

```bash
pnpm add -D lefthook
pnpm lefthook install
```

`.lefthook.yml` を作成：

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: pnpm lint
    format:
      run: pnpm format
      stage_fixed: true
```

> NOTE
> `stage_fixed: true` は Biome の自動修正で変更されたファイルをコミットに追加してくれるオプションです。
> これにより「フォーマット修正 → git add → コミット」という手間がなくなります。

### Step 5：開発サーバーの確認

```bash
pnpm dev
```

`http://localhost:3000` にアクセスして Next.js のウェルカムページが表示されれば成功です。

### Step 6：Biome でコードをチェックする

```bash
pnpm lint
```

エラーがなければ「✅ No lint errors found」が表示されます。エラーが出た場合、多くは自動修正できます：

```bash
pnpm format
```

よくある Biome のエラーと対処：

| エラー                  | 対処法                                       |
| ----------------------- | -------------------------------------------- |
| `useImportType`         | `import type { Foo }` に変更                 |
| `noUnusedVariables`     | 未使用の変数を削除                            |
| `useConst`              | `let` を `const` に変更                      |
| `noExplicitAny`         | `any` を具体的な型に変更                      |
| Import order            | `pnpm format` で自動整列                      |

> NOTE
> `import type { Foo }` と `import { Foo }` の違い：
> `import type` は型だけの import でランタイムには何も残りません。
> Biome の `useImportType` ルールは、型のみ使っている場合に `import type` を強制します。

### Step 7：Lefthook の pre-commit フックを確認する

Git でコミットすると、自動的に `pnpm lint` と `pnpm format` が走ります。確認してみましょう。

```bash
# まず git を初期化（create-next-app で既に済んでいれば不要）
git init && git add .

# 故意に lint エラーを混ぜてコミットを試みる
echo "const unused = 1" >> app/page.tsx

git add app/page.tsx
git commit -m "テスト"
# → pre-commit フックが走り、lint エラーで拒否される
```

フックが正常に動作したら、変更を元に戻します：

```bash
git checkout app/page.tsx
```

> NOTE
> `stage_fixed: true` の効果：Biome の自動修正（`pnpm format`）で変更されたファイルが
> 自動で `git add` されるため、「フォーマット修正 → git add → コミット」の手間が省けます。

---

## 1-6. React Compiler について（補足）

このプロジェクトでは `next.config.ts` に `reactCompiler: true` が設定されています。

**React Compiler** は、React の再レンダリングを自動的に最適化するコンパイラです。通常 `useMemo` や `useCallback` を手書きしていた部分を、コンパイラが自動で最適化してくれます。

```typescript
// next.config.ts（完成形）
const nextConfig = {
  reactCompiler: true,   // 自動メモ化を有効化
  cacheComponents: true, // "use cache" ディレクティブを有効化
};
```

> NOTE
> React Compiler の詳細は第 12 章で説明します。
> 今は「`useMemo` を書かなくても最適化してくれるコンパイラが動いている」とだけ覚えておきましょう。

---

## まとめと次のステップ

この章では以下を学びました：

- `pnpm dev`：Turbopack で高速コンパイル + HMR で開発サーバーを起動
- `pnpm build`：本番用に最適化して `.next/` を生成
- `pnpm start`：生成済みの `.next/` で本番サーバーを起動
- Server Component：サーバーで実行、DB に直接アクセス可能
- Client Component：`'use client'` を書く、`useState` などが使える
- `proxy.ts`：Edge Runtime でリクエストを最初に受け取り Cookie をチェック
- `AuthGate`（Node.js）：DB でセッションを確認する二段目のガード
- Biome：`pnpm lint` で検査、`pnpm format` で自動修正
- Lefthook：コミット時に `pnpm lint` と `pnpm format` を自動実行

次の第 02 章では **Tailwind v4 と shadcn/ui** のセットアップを行い、UI の基礎を整えます。

→ [第 02 章：Tailwind v4 + shadcn/ui](./02-tailwind-shadcn.md)
