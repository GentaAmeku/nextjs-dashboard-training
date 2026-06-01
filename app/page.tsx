// クローン直後の仮トップページ（第 01 章で pnpm dev の表示確認に使う）。
// 第 03 章で `/` はルートグループ (authed)/page.tsx が担当するようになるため、
// その章でこのファイルは削除します。
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Next.js Dashboard Training</h1>
        <p className="mt-2 text-muted-foreground">
          研修リポジトリのセットアップが完了しました。第 03
          章から画面を作っていきます。
        </p>
      </div>
    </main>
  );
}
