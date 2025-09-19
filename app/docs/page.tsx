const docEntries = [
  {
    title: "Docker セットアップ",
    description: "ローカルでコンテナを起動する手順と Prisma マイグレーションの実行方法。",
    path: "README_DOCKER.md",
  },
  {
    title: "データベース仕様",
    description: "テナント/ボード/ノードのスキーマ設計と API の保存要件。",
    path: "docs/SPEC-DB.md",
  },
  {
    title: "Docker 設計",
    description: "コンテナ構成やネットワーク設計の背景資料。",
    path: "docs/SPEC-docker.md",
  },
];

const repoBase = process.env.NEXT_PUBLIC_REPO_URL;

function resolveHref(path: string) {
  if (!repoBase) return '#';
  const normalized = repoBase.endsWith('/') ? repoBase.slice(0, -1) : repoBase;
  return `${normalized}/${path}`;
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-6 pb-16 pt-20">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Documentation</p>
          <h1 className="mt-3 text-4xl font-bold text-white">WhyWhy Board ドキュメント</h1>
          <p className="mt-4 text-slate-300">
            このページでは、プロジェクト運用に関連する資料へのリンクと概要をまとめています。必要に応じてリポジトリ内の Markdown を参照してください。
          </p>
        </header>

        <section className="space-y-4">
          {!repoBase && (
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              NEXT_PUBLIC_REPO_URL が設定されていないため、GitHub へのリンクはダミーの <code>#</code> になります。リポジトリの URL を環境変数に設定すると、直接ドキュメントへ遷移できるようになります。
            </p>
          )}
          {docEntries.map((doc) => (
            <article
              key={doc.path}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur transition hover:border-white/30"
            >
              <h2 className="text-xl font-semibold text-white">{doc.title}</h2>
              <p className="mt-2 text-sm text-slate-200">{doc.description}</p>
              <div className="mt-4 text-sm text-sky-200">
                <span className="mr-2 text-slate-300">ファイル:</span>
                <code className="rounded bg-black/40 px-2 py-1 text-slate-100">{doc.path}</code>
              </div>
              <div className="mt-4 flex gap-3 text-sm">
                <a
                  href={resolveHref(doc.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-sky-500 px-4 py-2 text-white transition hover:bg-sky-400"
                >
                  GitHub で開く
                </a>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
