import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

type Props = {
  params: { tenantId: string };
};

export default async function TenantUserInvitePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { tenantId } = params;
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const isTenantMember = session.user.tenantId === tenantId;
  if (!isSuperAdmin && !isTenantMember) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 space-y-6">
        <h1 className="text-3xl font-semibold">ユーザー招待（準備中）</h1>
        <p className="text-slate-300">
          招待メール送信・ロール割り当て機能をここに実装します。暫定的には SuperAdmin が直接ユーザーを作成してください。
        </p>
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
