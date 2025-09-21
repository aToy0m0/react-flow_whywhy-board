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

  const boards = tenantId
    ? await prisma.board.findMany({
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
    : [];

  const users = tenantId
    ? await prisma.user.findMany({
        where: { tenantId: user.tenantId },
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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">WhyWhy Board</p>
          <h1 className="text-3xl font-semibold text-white">ダッシュボード</h1>
          <p className="text-slate-300">
            {tenantId
              ? `${tenantId} テナントの状況を確認できます。`
              : "テナントがまだ割り当てられていません。セットアップを完了してください。"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              セットアップガイド
            </Link>
            {tenantId && (
              <Link
                href={`/tenants/${tenantId}/boards`}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
              >
                ボードを開く
              </Link>
            )}
            {isSuperAdmin && (
              <Link
                href="/manage"
                className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:border-white/60"
              >
                テナント管理
              </Link>
            )}
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">最近のボード</h2>
              {tenantId && (
                <Link
                  href={`/tenants/${tenantId}/boards`}
                  className="text-sm text-sky-300 hover:text-sky-200"
                >
                  すべて見る
                </Link>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {!tenantId && <p className="text-sm text-slate-300">テナントが未設定です。</p>}
              {tenantId && boards.length === 0 && (
                <p className="text-sm text-slate-300">ボードがまだありません。新規作成してください。</p>
              )}
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/tenants/${tenantId}/boards/${board.boardKey}`}
                  className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/30"
                >
                  <p className="text-sm font-semibold text-white">{board.name}</p>
                  <p className="text-xs text-slate-300">最終更新: {board.updatedAt.toLocaleString()}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">ユーザー招待状況</h2>
              {tenantId && (
                <Link
                  href={`/tenants/${tenantId}/users`}
                  className="text-sm text-sky-300 hover:text-sky-200"
                >
                  管理ページへ
                </Link>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {!tenantId && <p className="text-sm text-slate-300">テナントが未設定です。</p>}
              {tenantId && users.length === 0 && (
                <p className="text-sm text-slate-300">ユーザーがまだ登録されていません。招待を送りましょう。</p>
              )}
              {users.map((member) => (
                <div key={member.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{member.email}</p>
                  <p className="text-xs text-slate-300">ロール: {member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
