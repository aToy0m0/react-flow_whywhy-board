import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { user } = session;
  const tenantId = user?.tenantId;
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [tenant, boards] = tenantId
    ? await Promise.all([
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true }
        }),
        prisma.board.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: {
            id: true,
            boardKey: true,
            name: true,
            updatedAt: true,
          },
        })
      ])
    : [null, []];

  const users = tenantId
    ? await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          // メンバー権限の場合は自分のみ表示
          ...(user.role === "MEMBER" ? { id: user.id } : {})
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-subtle">WhyWhy Board</p>
          <h1 className="text-3xl font-semibold text-headline">ダッシュボード</h1>
          <p className="text-muted">
            {tenantId
              ? `${tenant?.name || tenantId} テナントの状況を確認できます。`
              : "テナントがまだ割り当てられていません。セットアップを完了してください。"}
          </p>
          <div className="flex flex-wrap gap-3">
            {tenantId && (
              <Link
                href={`/tenants/${tenantId}/boards`}
                className="rounded-lg bg-highlight px-4 py-2 text-sm font-semibold text-background transition hover:bg-highlight-hover"
              >
                ボードを開く
              </Link>
            )}
            {isSuperAdmin && (
              <Link
                href="/manage"
                className="rounded-lg border border-soft px-4 py-2 text-sm font-medium text-paragraph transition hover:border-accent"
              >
                テナント管理
              </Link>
            )}
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-headline">最近のボード</h2>
              {tenantId && (
                <Link
                  href={`/tenants/${tenantId}/boards`}
                  className="text-sm text-accent-solid hover:text-accent-solid-hover"
                >
                  すべて見る
                </Link>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {!tenantId && <p className="text-sm text-muted">テナントが未設定です。</p>}
              {tenantId && boards.length === 0 && (
                <p className="text-sm text-muted">ボードがまだありません。新規作成してください。</p>
              )}
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/tenants/${tenantId}/boards/${board.boardKey}`}
                  className="block rounded-xl border border-soft bg-surface-card-muted px-4 py-3 transition hover:border-accent"
                >
                  <p className="text-sm font-semibold text-headline">{board.name}</p>
                  <p className="text-xs text-muted">最終更新: {board.updatedAt.toLocaleString()}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-headline">
                {user?.role === "MEMBER" ? "自分の情報" : "ユーザー招待状況"}
              </h2>
              {tenantId && (
                <Link
                  href={`/tenants/${tenantId}/users`}
                  className="text-sm text-accent-solid hover:text-accent-solid-hover"
                >
                  {user?.role === "MEMBER" ? "詳細表示" : "管理ページへ"}
                </Link>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {!tenantId && <p className="text-sm text-muted">テナントが未設定です。</p>}
              {tenantId && users.length === 0 && (
                <p className="text-sm text-muted">
                  {user?.role === "MEMBER"
                    ? "ユーザー情報を取得できませんでした。"
                    : "ユーザーがまだ登録されていません。招待を送りましょう。"
                  }
                </p>
              )}
              {users.map((member) => (
                <Link
                  key={member.id}
                  href={`/tenants/${tenantId}/users/${member.id}`}
                  className="block rounded-xl border border-soft bg-surface-card-muted px-4 py-3 transition hover:border-accent"
                >
                  <p className="text-sm font-semibold text-headline">{member.email}</p>
                  <p className="text-xs text-muted">ロール: {member.role}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
