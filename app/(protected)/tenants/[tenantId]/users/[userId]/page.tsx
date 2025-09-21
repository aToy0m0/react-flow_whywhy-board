"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  params: { tenantId: string; userId: string };
};

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

export default function TenantUserDetailPage({ params }: Props) {
  const { tenantId, userId } = params;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // パスワード変更用の状態
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: ""
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // ロール変更用の状態
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");

  // ユーザー情報取得
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const [userResponse, sessionResponse] = await Promise.all([
          fetch(`/api/tenants/${tenantId}/users/${userId}`),
          fetch('/api/auth/session')
        ]);

        if (!userResponse.ok) {
          throw new Error("ユーザー情報の取得に失敗しました");
        }

        const userData = await userResponse.json();
        setUser(userData.user);
        setSelectedRole(userData.user.role);

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setCurrentUser(sessionData.user);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [tenantId, userId]);

  // パスワード変更
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!passwordData.password) {
      newErrors.password = "パスワードは必須です";
    } else if (passwordData.password.length < 6) {
      newErrors.password = "パスワードは6文字以上である必要があります";
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "パスワードが一致しません";
    }

    if (Object.keys(newErrors).length > 0) {
      setPasswordErrors(newErrors);
      return;
    }

    setPasswordErrors({});

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantId}/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: passwordData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "パスワードの変更に失敗しました");
        }

        // 成功時
        setShowPasswordForm(false);
        setPasswordData({ password: "", confirmPassword: "" });
        alert("パスワードが正常に変更されました");
      } catch (error) {
        setPasswordErrors({
          submit: error instanceof Error ? error.message : "パスワードの変更に失敗しました"
        });
      }
    });
  };

  // ロール変更
  const handleRoleChange = async () => {
    if (!user || selectedRole === user.role) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantId}/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: selectedRole,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "ロールの変更に失敗しました");
        }

        // 成功時
        setUser({ ...user, role: selectedRole });
        setShowRoleForm(false);
        alert("ロールが正常に変更されました");
      } catch (error) {
        alert(error instanceof Error ? error.message : "ロールの変更に失敗しました");
      }
    });
  };

  // ユーザー削除
  const handleDeleteUser = async () => {
    if (!user) return;

    if (!confirm(`${user.email} を削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantId}/users/${userId}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "ユーザーの削除に失敗しました");
        }

        // 成功時はユーザー一覧に戻る
        router.push(`/tenants/${tenantId}/users`);
      } catch (error) {
        alert(error instanceof Error ? error.message : "ユーザーの削除に失敗しました");
      }
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-paragraph">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <p>読み込み中...</p>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="min-h-screen bg-background text-paragraph">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <p className="text-danger">{error || "ユーザーが見つかりません"}</p>
          <Link
            href={`/tenants/${tenantId}/users`}
            className="mt-4 inline-flex rounded-lg border border-accent px-4 py-2 text-sm text-headline transition hover:border-accent/70"
          >
            ユーザー一覧に戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 space-y-6">
        <header className="space-y-1">
          <p className="text-sm uppercase tracking-[0.4em] text-subtle">User Detail</p>
          <h1 className="text-3xl font-semibold text-headline">{user.email}</h1>
          <p className="text-muted">ロール: {user.role}</p>
        </header>

        {/* ユーザー情報 */}
        <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur space-y-3 text-sm text-paragraph">
          <h2 className="text-lg font-semibold text-headline mb-4">基本情報</h2>
          <p>ID: {user.id}</p>
          <p>作成日時: {new Date(user.createdAt).toLocaleString()}</p>
          <p>更新日時: {new Date(user.updatedAt).toLocaleString()}</p>
        </section>

        {/* アクションボタン */}
        <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur space-y-4">
          <h2 className="text-lg font-semibold text-headline">管理操作</h2>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90"
            >
              パスワード変更
            </button>

            {/* ロール変更は管理者権限のみ */}
            {currentUser && (currentUser.role === "SUPER_ADMIN" || currentUser.role === "TENANT_ADMIN") && (
              <button
                onClick={() => setShowRoleForm(!showRoleForm)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90"
              >
                ロール変更
              </button>
            )}

            {/* ユーザー削除は管理者権限のみ */}
            {currentUser && (currentUser.role === "SUPER_ADMIN" || currentUser.role === "TENANT_ADMIN") && (
              <button
                onClick={handleDeleteUser}
                disabled={isPending}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-background transition hover:bg-danger/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? "削除中..." : "ユーザー削除"}
              </button>
            )}
          </div>
        </section>

        {/* パスワード変更フォーム */}
        {showPasswordForm && (
          <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-headline mb-4">パスワード変更</h3>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium text-paragraph">
                  新しいパスワード
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordData.password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
                  placeholder="6文字以上"
                  disabled={isPending}
                />
                {passwordErrors.password && (
                  <p className="text-xs text-danger">{passwordErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmNewPassword" className="text-sm font-medium text-paragraph">
                  パスワード確認
                </label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
                  placeholder="パスワードを再入力"
                  disabled={isPending}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-xs text-danger">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              {passwordErrors.submit && (
                <div className="rounded-lg bg-danger/10 border border-danger/20 p-3">
                  <p className="text-sm text-danger">{passwordErrors.submit}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? "変更中..." : "パスワード変更"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordData({ password: "", confirmPassword: "" });
                    setPasswordErrors({});
                  }}
                  className="rounded-lg border border-soft px-4 py-2 text-sm text-headline transition hover:border-accent"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ロール変更フォーム */}
        {showRoleForm && currentUser && (currentUser.role === "SUPER_ADMIN" || currentUser.role === "TENANT_ADMIN") && (
          <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-headline mb-4">ロール変更</h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="roleSelect" className="text-sm font-medium text-paragraph">
                  新しいロール
                </label>
                <select
                  id="roleSelect"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
                  disabled={isPending}
                >
                  <option value="MEMBER">メンバー</option>
                  <option value="TENANT_ADMIN">テナント管理者</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRoleChange}
                  disabled={isPending || selectedRole === user?.role}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? "変更中..." : "ロール変更"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleForm(false);
                    setSelectedRole(user?.role || "");
                  }}
                  className="rounded-lg border border-soft px-4 py-2 text-sm text-headline transition hover:border-accent"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </section>
        )}

        <Link
          href={`/tenants/${tenantId}/users`}
          className="inline-flex w-fit rounded-lg border border-accent px-4 py-2 text-sm text-headline transition hover:border-accent/70"
        >
          ユーザー一覧に戻る
        </Link>
      </div>
    </main>
  );
}
