import AppNav from '@/components/AppNav';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docEntries = [
  {
    title: 'Docker セットアップ',
    description: 'ローカルでコンテナを起動する手順と Prisma マイグレーションの実行方法。',
    path: 'README_DOCKER.md',
  },
  {
    title: 'データベース仕様',
    description: 'テナント/ボード/ノードのスキーマ設計と API の保存要件。',
    path: 'docs/SPEC-DB.md',
  },
  {
    title: 'Docker 設計',
    description: 'コンテナ構成やネットワーク設計の背景資料。',
    path: 'docs/SPEC-docker.md',
  },
];

const repoBase = process.env.NEXT_PUBLIC_REPO_URL;

function resolveHref(path: string) {
  if (!repoBase) return '#';
  const normalized = repoBase.endsWith('/') ? repoBase.slice(0, -1) : repoBase;
  return `${normalized}/${path}`;
}

function DocsContent() {
  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-4xl px-6 pb-16 pt-24">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-paragraph">Documentation</p>
          <h1 className="mt-3 text-4xl font-bold text-headline">WhyWhy Board ドキュメント</h1>
          <p className="mt-4 text-paragraph">
            このページでは、プロジェクト運用に関連する資料へのリンクと概要をまとめています。必要に応じてリポジトリ内の Markdown を参照してください。
          </p>
        </header>

        <section className="space-y-4">
          {!repoBase && (
            <p className="rounded-2xl border border-[rgba(238,187,195,0.4)] bg-[rgba(238,187,195,0.12)] p-4 text-sm text-headline">
              NEXT_PUBLIC_REPO_URL が設定されていないため、GitHub へのリンクはダミーの <code>#</code> になります。リポジトリの URL を環境変数に設定すると、直接ドキュメントへ遷移できるようになります。
            </p>
          )}
          {docEntries.map((doc) => (
            <article
              key={doc.path}
              className="rounded-2xl border border-[rgba(18,22,41,0.35)] bg-[rgba(255,255,255,0.06)] p-6 shadow-lg backdrop-blur transition hover:border-highlight"
            >
              <h2 className="text-xl font-semibold text-headline">{doc.title}</h2>
              <p className="mt-2 text-sm text-paragraph">{doc.description}</p>
              <div className="mt-4 text-sm text-highlight">
                <span className="mr-2 text-paragraph">ファイル:</span>
                <code className="rounded bg-[rgba(18,22,41,0.65)] px-2 py-1 text-headline">{doc.path}</code>
              </div>
              <div className="mt-4 flex gap-3 text-sm">
                <a
                  href={resolveHref(doc.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-button px-4 py-2 text-button-text transition hover:bg-[var(--color-button-hover)]"
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

export default async function DocsPage() {
  const session = await getServerSession(authOptions);
  const navSession = session
    ? {
        email: session.user?.email ?? '',
        role: session.user?.role ?? '',
        tenantId: session.user?.tenantId ?? null,
      }
    : null;

  return (
    <>
      <AppNav session={navSession} />
      <div className="pt-16">
        <DocsContent />
      </div>
    </>
  );
}
