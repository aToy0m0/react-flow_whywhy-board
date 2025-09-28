"use client";

import { useMemo, useState, useTransition } from "react";

type TenantAdmin = {
  id: string;
  email: string;
  createdAt: string;
};

type Tenant = {
  id: string;
  slug: string;
  name: string;
  admins: TenantAdmin[];
};

export type TenantAdminDTO = TenantAdmin;
export type TenantDTO = Tenant;

type Props = {
  initialTenants: TenantDTO[];
};

export default function ManageTenantsClient({ initialTenants }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [creating, startCreateTransition] = useTransition();
  const [form, setForm] = useState({ slug: "", name: "" });

  const tenantCount = tenants.length;
  const totalAdminCount = useMemo(() => tenants.reduce((sum, t) => sum + t.admins.length, 0), [tenants]);

  const handleCreateTenant = () => {
    if (creating) return;
    const slug = form.slug.trim().toLowerCase();
    const name = form.name.trim();
    if (!slug) {
      window.alert("テナントスラッグを入力してください。");
      return;
    }

    startCreateTransition(async () => {
      try {
        const res = await fetch("/api/manage/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, name }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "テナントの作成に失敗しました。");
        }
        setTenants((prev) => [...prev, { ...data.tenant, admins: [] }].sort((a, b) => a.slug.localeCompare(b.slug)));
        setForm({ slug: "", name: "" });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "テナントの作成に失敗しました。");
      }
    });
  };

  const handleRenameTenant = async (tenantId: string, currentName: string) => {
    const next = window.prompt("テナント名を入力", currentName);
    if (next === null) return;
    const name = next.trim();
    if (!name) {
      window.alert("テナント名を入力してください。");
      return;
    }

    try {
      const res = await fetch(`/api/manage/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "テナント名の更新に失敗しました。");
      }
      setTenants((prev) => prev.map((tenant) => (tenant.id === tenantId ? { ...tenant, name: data.tenant.name } : tenant)));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "テナント名の更新に失敗しました。");
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!window.confirm(`${tenantName} を削除しますか？この操作は元に戻せません。`)) return;

    try {
      const res = await fetch(`/api/manage/tenants/${tenantId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? 'テナントの削除に失敗しました。');
      }
      setTenants((prev) => prev.filter((tenant) => tenant.id !== tenantId));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'テナントの削除に失敗しました。');
    }
  };

  const handleCreateAdmin = async (tenantId: string) => {
    const email = window.prompt("管理者のメールアドレスを入力");
    if (!email) return;
    const password = window.prompt("初期パスワードを入力");
    if (!password) return;

    try {
      const res = await fetch(`/api/manage/tenants/${tenantId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "管理者の作成に失敗しました。");
      }
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === tenantId
            ? { ...tenant, admins: [...tenant.admins, data.admin] }
            : tenant
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "管理者の作成に失敗しました。");
    }
  };

  const handleUpdateAdmin = async (tenantId: string, admin: TenantAdmin, type: 'email' | 'password') => {
    const promptText = type === 'email' ? '新しいメールアドレスを入力' : '新しいパスワードを入力';
    const placeholder = type === 'email' ? admin.email : '';
    const next = window.prompt(promptText, placeholder);
    if (!next) return;
    const value = next.trim();
    if (!value) {
      window.alert(type === 'email' ? 'メールアドレスを入力してください。' : 'パスワードを入力してください。');
      return;
    }

    try {
      const payload: Record<string, string> = {};
      if (type === 'email') {
        payload.email = value;
      } else {
        payload.password = value;
      }
      const res = await fetch(`/api/manage/tenants/${tenantId}/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "管理者の更新に失敗しました。");
      }
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === tenantId
            ? {
                ...tenant,
                admins: tenant.admins.map((item) => (item.id === admin.id ? { ...item, email: data.admin.email } : item)),
              }
            : tenant
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "管理者の更新に失敗しました。");
    }
  };

  const handleDeleteAdmin = async (tenantId: string, adminId: string) => {
    if (!window.confirm('この管理者を削除しますか？')) return;

    try {
      const res = await fetch(`/api/manage/tenants/${tenantId}/admins/${adminId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? '管理者の削除に失敗しました。');
      }
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === tenantId
            ? { ...tenant, admins: tenant.admins.filter((admin) => admin.id !== adminId) }
            : tenant
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '管理者の削除に失敗しました。');
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-subtle bg-surface-overlay p-6 shadow-xl backdrop-blur">
        <h2 className="text-xl font-semibold text-headline">テナントを追加</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-paragraph">スラッグ</label>
            <input
              type="text"
              value={form.slug}
              onChange={(event) => { const value = event.currentTarget.value; setForm((prev) => ({ ...prev, slug: value })); }}
              className="w-full rounded-[8px] border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
              placeholder="例: factory-a"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-paragraph">表示名</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => { const value = event.currentTarget.value; setForm((prev) => ({ ...prev, name: value })); }}
              className="w-full rounded-[8px] border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
              placeholder="例: 工場A"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleCreateTenant}
          className="mt-4 inline-flex items-center rounded-[8px] bg-button px-4 py-2 text-sm font-semibold text-button-text transition hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60"
          disabled={creating}
        >
          {creating ? '作成中...' : 'テナントを作成'}
        </button>
      </section>

      <section className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-headline">テナント一覧 ({tenantCount})</h2>
          <p className="text-sm text-paragraph">テナント管理者 合計: {totalAdminCount}</p>
        </header>

        <div className="space-y-6">
          {tenants.map((tenant) => (
            <article
              key={tenant.id}
              className="rounded-3xl border border-subtle bg-surface-overlay p-6 shadow-lg backdrop-blur"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-paragraph">{tenant.slug}</p>
                  <h3 className="mt-1 text-lg font-semibold text-headline">{tenant.name}</h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleRenameTenant(tenant.id, tenant.name)}
                    className="rounded-md border text-button-text bg-button px-2 py-1 text-xs text-headline transition hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    名前を変更
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                    className="rounded-md border border-danger px-2 py-1 text-xs text-danger transition hover:bg-surface-tertiary"
                  >
                    テナント削除
                  </button>
                </div>
              </header>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-paragraph">
                  <span>管理者 ({tenant.admins.length})</span>
                  <button
                    type="button"
                    onClick={() => handleCreateAdmin(tenant.id)}
                    className="rounded-md bg-button px-2 py-1 text-xs font-semibold text-button-text transition hover:bg-button-hover"
                  >
                    追加
                  </button>
                </div>

                <ul className="space-y-2">
                  {tenant.admins.length === 0 && (
                    <li className="rounded-lg border border-subtle bg-background px-3 py-2 text-xs text-paragraph">
                      管理者が登録されていません。
                    </li>
                  )}
                  {tenant.admins.map((admin) => (
                    <li
                      key={admin.id}
                      className="rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-headline">{admin.email}</p>
                          <p className="text-xs text-paragraph">
                            作成日: {new Date(admin.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateAdmin(tenant.id, admin, 'email')}
                            className="rounded-md border text-button-text bg-button px-2 py-1 text-xs text-headline transition hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            メール変更
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateAdmin(tenant.id, admin, 'password')}
                            className="rounded-md border text-button-text bg-button px-2 py-1 text-xs text-headline transition hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            パスワード変更
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdmin(tenant.id, admin.id)}
                            className="rounded-md border border-danger px-2 py-1 text-xs text-danger transition hover:bg-surface-tertiary"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
