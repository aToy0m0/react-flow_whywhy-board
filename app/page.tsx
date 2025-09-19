import Link from "next/link";

const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? 'default';
const DEFAULT_BOARD_ID = 'MVP';

type QuickLink =
  | {
      kind: 'board';
      title: string;
      description: string;
      boardId: string;
      boardTenantId?: string;
      accent: string;
    }
  | {
      kind: 'static';
      title: string;
      description: string;
      href: '/login' | '/docs';
      accent: string;
    };

const quickLinks: ReadonlyArray<QuickLink> = [
  {
    kind: 'board',
    title: "ボード一覧",
    description: "最新の WhyWhy ボードにアクセスして分析を始めましょう。",
    boardId: DEFAULT_BOARD_ID,
    accent: "from-sky-500/20 to-sky-500/10",
  },
  {
    kind: 'static',
    title: "サインイン",
    description: "認証情報を保存して API アクセスをスムーズに。",
    href: '/login',
    accent: "from-emerald-500/20 to-emerald-500/10",
  },
  {
    kind: 'static',
    title: "ドキュメント",
    description: "Docker セットアップや API 仕様を確認できます。",
    href: '/docs',
    accent: "from-purple-500/20 to-purple-500/10",
  },
];

const guidance = [
  "問題ノードからスタートし、ハンドルドラッグで次の「なぜ」を追加",
  "原因ノードを採用すると対策ノードが追加可能に",
  "サイドバーからサーバ保存・PNG 出力が利用可能",
  "複数行テキストの高さは自動で保存・復元されます",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-20 lg:pb-24 lg:pt-28">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500/20 via-sky-400/5 to-transparent p-10 shadow-2xl">
          <div className="relative z-10 space-y-6">
            <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.4em] text-slate-200">
              WhyWhy Board
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              チームで使える「なぜなぜ分析」ボード
            </h1>
            <p className="max-w-2xl text-lg text-slate-200">
              WhyWhy Board は、問題の根本原因を追求するためのコラボレーションツールです。編集内容はデータベースに保存され、PNG や TOML へのエクスポートにも対応しています。
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={`/${DEFAULT_TENANT_ID}/board/${DEFAULT_BOARD_ID}`}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                ボードを開く
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
              >
                認証する
              </Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-32 bottom-0 aspect-[4/3] w-96 rotate-12 rounded-full bg-white/5 blur-3xl" />
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {quickLinks.map((link) => {
            const href =
              link.kind === 'board'
                ? `/${link.boardTenantId ?? DEFAULT_TENANT_ID}/board/${link.boardId}`
                : link.href;
            return (
            <Link
              key={link.title}
              href={href}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${link.accent} p-6 shadow-lg transition hover:border-white/30 hover:shadow-2xl`}
            >
              <div className="relative z-10 space-y-3">
                <h2 className="text-xl font-semibold text-white">{link.title}</h2>
                <p className="text-sm text-slate-200">{link.description}</p>
                <span className="inline-flex items-center text-sm font-semibold text-sky-200">
                  詳細を見る <span className="ml-1">→</span>
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            </Link>
            );
          })}
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <h2 className="text-2xl font-semibold text-white">使いこなすためのポイント</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {guidance.map((tip) => (
              <div key={tip} className="rounded-2xl bg-black/30 p-5 text-sm text-slate-200">
                {tip}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">サーバ保存</span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-100">PNG 出力</span>
            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-100">TOML インポート</span>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-100">高さの自動復元</span>
          </div>
        </section>
      </div>
    </main>
  );
}
