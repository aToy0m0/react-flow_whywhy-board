type TenantUserManagePageProps = {
  params: { tenantId: string; userId: string };
};

export default function TenantUserManagePage({ params }: TenantUserManagePageProps) {
  const { tenantId, userId } = params;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold">ユーザー詳細</h1>
        <dl className="mt-6 space-y-2 text-slate-300">
          <div>
            <dt className="text-sm uppercase tracking-widest text-slate-500">テナント</dt>
            <dd className="text-lg text-white">{tenantId}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-widest text-slate-500">ユーザーID</dt>
            <dd className="text-lg text-white">{userId}</dd>
          </div>
        </dl>
        <p className="mt-6 text-slate-400">
          この画面にユーザーごとの権限設定や履歴を表示する機能を追加してください。
        </p>
      </div>
    </main>
  );
}
