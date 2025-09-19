type TenantManagePageProps = {
  params: { tenantId: string };
};

export default function TenantManagePage({ params }: TenantManagePageProps) {
  const { tenantId } = params;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold">{tenantId} テナントの管理</h1>
        <p className="mt-4 text-slate-300">
          テナント固有の設定やメンバー管理をここに実装してください。必要な機能のモックやフォームを追加していきましょう。
        </p>
      </div>
    </main>
  );
}
