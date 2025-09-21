import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

type Props = {
  params: { tenantId: string; userId: string };
};

export default async function TenantUserDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { tenantId, userId } = params;
  const { user } = session;

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isTenantMember = user.tenantId === tenantId;
  if (!isSuperAdmin && !isTenantMember) {
    redirect("/");
  }

  const member = await prisma.user.findUnique({
    where: { id: userId, tenantId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!member) {
    redirect(`/tenants/${tenantId}/users`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 space-y-6">
        <header className="space-y-1">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">User Detail</p>
          <h1 className="text-3xl font-semibold text-white">{member.email}</h1>
          <p className="text-slate-300">ロール: {member.role}</p>
        </header>

        <section className="rounded-3xl bg-white/5 p-6 shadow-xl backdrop-blur space-y-3 text-sm text-slate-200">
          <p>ID: {member.id}</p>
          <p>作成日時: {member.createdAt.toLocaleString()}</p>
          <p>更新日時: {member.updatedAt.toLocaleString()}</p>
          <p>この画面では将来的に権限変更やパスワードリセット、監査ログ閲覧を実装します。</p>
        </section>

        <Link
          href={`/tenants/${tenantId}/users`}
          className="inline-flex w-fit rounded-lg border border-white/30 px-4 py-2 text-sm text-white transition hover:border-white/50"
        >
          ユーザー一覧に戻る
        </Link>
      </div>
    </main>
  );
}
