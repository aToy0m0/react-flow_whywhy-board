import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

export default async function TenantCreatePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 space-y-6">
        <h1 className="text-3xl font-semibold">テナント登録</h1>
        <p className="text-slate-300">
          ここでは新しいテナントを作成するウィザードを提供する予定です。暫定的に、必要な情報は `/setup` と `/init` の手順で登録してください。
        </p>
        <div className="rounded-3xl bg-white/5 p-6 space-y-3">
          <p className="text-sm text-slate-200">将来的に必要になる入力項目:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            <li>テナント名・表示名</li>
            <li>オーナー（TenantAdmin）のメールアドレス</li>
            <li>課金プランやライセンス情報（必要であれば）</li>
          </ul>
          <p className="text-sm text-slate-400">※ 現状は SuperAdmin が直接 DB を操作するか `/api/init` で作成してください。</p>
        </div>
        <Link
          href="/"
          className="inline-flex w-fit rounded-lg border border-white/30 px-4 py-2 text-sm text-white transition hover:border-white/50"
        >
          ダッシュボードに戻る
        </Link>
      </div>
    </main>
  );
}
