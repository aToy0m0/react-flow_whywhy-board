import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type Props = {
  params: { tenantId: string };
};

export default async function TenantUsersPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { tenantId } = params;
  const { user } = session;

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isTenantMember = user.tenantId === tenantId;
  if (!isSuperAdmin && !isTenantMember) {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: { not: "SUPER_ADMIN" } // SUPER_ADMINを除外
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-subtle">Users</p>
            <h1 className="text-3xl font-semibold text-headline">{tenantId} のユーザー</h1>
          </div>
          <Link
            href={`/tenants/${tenantId}/users/new`}
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90"
          >
            新規ユーザー作成
          </Link>
        </header>

        {users.length === 0 ? (
          <p className="rounded-3xl bg-surface-card p-6 text-sm text-muted">
            ユーザーが登録されていません。新規ユーザーを作成してください。
          </p>
        ) : (
          <div className="space-y-3">
            {users.map((member) => (
              <Link
                key={member.id}
                href={`/tenants/${tenantId}/users/${member.id}`}
                className="flex items-center justify-between rounded-3xl border border-soft bg-surface-card px-6 py-4 transition hover:border-accent"
              >
                <div>
                  <p className="text-sm font-semibold text-headline">{member.email}</p>
                  <p className="text-xs text-muted">ロール: {member.role}</p>
                </div>
                <span className="text-xs text-subtle">作成日: {member.createdAt.toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
