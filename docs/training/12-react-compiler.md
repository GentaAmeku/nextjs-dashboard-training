# 第 12 章：React Compiler + Turbopack（読み物）

## この章の目標

> **CHECK**
> - [ ] React Compiler が何をしているか説明できる
> - [ ] なぜ `useMemo` / `useCallback` を手書きしないかを説明できる
> - [ ] このプロジェクトでの有効化設定を確認できる
> - [ ] `pnpm build` が成功する

---

## 12-1. React Compiler とは

従来の React では、コンポーネントの**再レンダリングを最適化**するために開発者が手動でメモ化を行っていました。

```tsx
// 従来の手動メモ化
import { useMemo, useCallback, memo } from "react";

// 計算結果をメモ化（依存が変わらなければ再計算しない）
const sortedTasks = useMemo(
  () => tasks.sort((a, b) => a.name.localeCompare(b.name)),
  [tasks],
);

// 関数をメモ化（依存が変わらなければ同じ参照を返す）
const handleDelete = useCallback(
  (id: number) => deleteTask(id),
  [deleteTask],
);

// コンポーネントをメモ化（props が変わらなければ再レンダリングしない）
const TaskItem = memo(({ task }: { task: Task }) => {
  return <li>{task.name}</li>;
});
```

### 問題点

- **書き忘れ・間違いが多い**：deps 配列の指定ミスで無限ループや古いキャッシュが残る
- **コードが煩雑になる**：最適化のためのコードで本来のロジックが見えにくくなる
- **保守が難しい**：後から deps を追加し忘れることがある

---

## 12-2. React Compiler が解決すること

**React Compiler** は、JavaScript/TypeScript コードを静的解析して、**メモ化が有効な箇所を自動で検出・挿入**するコンパイラです。

```tsx
// React Compiler 使用後（シンプルに書ける）
// ← useMemo / useCallback / memo を書かなくていい

function TaskList({ tasks }: { tasks: Task[] }) {
  // React Compiler が「tasks が変わったときだけソートする」と判断して自動メモ化
  const sortedTasks = tasks.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ul>
      {sortedTasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  );
}

// React Compiler が自動でコンポーネントをメモ化
function TaskItem({ task }: { task: Task }) {
  return <li>{task.name}</li>;
}
```

---

## 12-3. このプロジェクトでの設定

```bash
cat next.config.ts
```

```typescript
// next.config.ts
const nextConfig = {
  reactCompiler: true,   // React Compiler を有効化
  cacheComponents: true, // "use cache" ディレクティブを有効化
};
```

```json
// package.json（devDependencies）
"babel-plugin-react-compiler": "1.0.0"
```

> NOTE
> React Compiler は Next.js 16 では `next.config.ts` に `reactCompiler: true` を書くだけで有効になります。
> `babel-plugin-react-compiler` は Next.js が内部で使うため、開発者が直接設定する必要はありません。

---

## 12-4. React Compiler の限界

React Compiler は万能ではありません。以下のコードパターンはコンパイラが最適化できない場合があります：

- **副作用を持つコード**：DOM を直接変更するなど
- **React のルール違反**：条件の中で Hook を使うなど
- **型安全でないコード**：`any` を多用するなど

React の公式ルール（Rules of React）に従って書いていれば、ほとんどのケースでコンパイラが正しく動作します。

---

## 12-5. Turbopack（再確認）

第 01 章でも触れましたが、Turbopack の現状をまとめます。

```bash
# dev サーバー起動時に Turbopack が使われているか確認
pnpm dev
# → ターミナルに "Turbopack" という表示が出ることを確認
```

```bash
# .next/turbopack/ ディレクトリが生成されているか確認
ls .next/ | grep turbopack
```

| 機能                 | 状態（2026 年時点）             |
| -------------------- | ------------------------------- |
| `pnpm dev`（開発）   | Turbopack がデフォルトで有効    |
| `pnpm build`（本番） | webpack が使われる              |
| HMR（Hot Reload）    | Turbopack で高速化              |
| TypeScript 対応      | 完全対応                        |

> NOTE
> `pnpm build` は現時点では通常の webpack でビルドされます。
> Turbopack でのプロダクションビルドは将来対応予定です。

---

## 12-6. `pnpm build` を実行する

本番ビルドが成功するか確認しましょう。

```bash
pnpm build
```

正常終了すると、以下のような出力が表示されます：

```
▲ Next.js 16.x.x

   Creating an optimized production build ...
 ✓ Compiled successfully

Route (app)                              Size     First Load JS
┌ ○ /                                   ...
├ ○ /login                              ...
└ ƒ /tasks                              ...

○ (Static)  prerendered as static content
ƒ (Dynamic) server-rendered on demand
```

> NOTE
> `ƒ (Dynamic)` と表示されるルートは、リクエストのたびに Server Component が実行されます。
> `/tasks` が動的になるのは `headers()` や `cookies()` を使う `(authed)/layout.tsx` の `AuthGate` があるためです。

ビルドが成功したら、本番サーバーを起動できます：

```bash
pnpm start
# → http://localhost:3000 で本番モードのサーバーが起動
```

---

## 12-7. まとめ：このプロジェクトで使っている最適化

| 最適化              | 何をしているか                                    |
| ------------------- | ------------------------------------------------- |
| React Compiler      | `useMemo` / `useCallback` を自動で挿入            |
| Turbopack           | dev サーバーの起動と HMR を高速化                 |
| Cache Components    | `"use cache"` でサーバー関数の結果をキャッシュ    |
| RSC（Server Components） | ブラウザに送る JS を最小限にする             |
| Streaming（Suspense）| 非同期データ取得中も画面が表示される             |

---

## まとめと次のステップ

この章では以下を学びました：

- React Compiler は `useMemo` / `useCallback` / `memo` を自動で挿入するコンパイラ
- `reactCompiler: true` を設定するだけで有効になる
- Turbopack は dev サーバーでデフォルト有効、本番 build は webpack
- `pnpm build` で本番ビルドが成功することを確認

最後の第 13 章では **ダッシュボードの統計表示を完成させ、`pnpm start` で本番モードが起動する状態** にします。

→ [第 13 章：仕上げ：Dashboard 統計 + デプロイ準備](./13-finishing.md)
