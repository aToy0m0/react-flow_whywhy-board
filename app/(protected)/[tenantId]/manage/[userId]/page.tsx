type TenantUserManagePageProps = {
  params: { tenantId: string; userId: string };
};

export default function TenantUserManagePage({ params }: TenantUserManagePageProps) {
  const { tenantId, userId } = params;

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold">ユーザー詳細</h1>
        <dl className="mt-6 space-y-2 text-muted">
          <div>
            <dt className="text-sm uppercase tracking-widest text-subtle">テナント</dt>
            <dd className="text-lg text-headline">{tenantId}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-widest text-subtle">ユーザーID</dt>
            <dd className="text-lg text-headline">{userId}</dd>
          </div>
        </dl>
        <p className="mt-6 text-subtle">
          この画面にユーザーごとの権限設定や履歴を表示する機能を追加してください。
        </p>
      </div>
    </main>
  );
}
