"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  params: { tenantId: string };
};

export default function TenantUserNewPage({ params }: Props) {
  const { tenantId } = params;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "MEMBER"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "メールアドレスは必須です";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "有効なメールアドレスを入力してください";
    }

    if (!formData.password) {
      newErrors.password = "パスワードは必須です";
    } else if (formData.password.length < 6) {
      newErrors.password = "パスワードは6文字以上である必要があります";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "パスワードが一致しません";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantId}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            role: formData.role,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "ユーザーの作成に失敗しました");
        }

        // 成功時はユーザー一覧に戻る
        router.push(`/tenants/${tenantId}/users`);
      } catch (error) {
        setErrors({
          submit: error instanceof Error ? error.message : "ユーザーの作成に失敗しました"
        });
      }
    });
  };

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-2xl px-6 py-16 space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-subtle">New User</p>
          <h1 className="text-3xl font-semibold text-headline">新規ユーザー作成</h1>
          <p className="text-muted">テナントに新しいユーザーを追加します。</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur space-y-4">
          {/* メールアドレス */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-paragraph">
              メールアドレス *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
              placeholder="user@example.com"
              disabled={isPending}
            />
            {errors.email && (
              <p className="text-xs text-danger">{errors.email}</p>
            )}
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-paragraph">
              パスワード *
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
              placeholder="6文字以上"
              disabled={isPending}
            />
            {errors.password && (
              <p className="text-xs text-danger">{errors.password}</p>
            )}
          </div>

          {/* パスワード確認 */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-paragraph">
              パスワード確認 *
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
              placeholder="パスワードを再入力"
              disabled={isPending}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-danger">{errors.confirmPassword}</p>
            )}
          </div>

          {/* ロール選択 */}
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium text-paragraph">
              ロール
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full rounded-lg border border-subtle bg-background px-3 py-2 text-sm text-headline focus:border-highlight focus:outline-none"
              disabled={isPending}
            >
              <option value="MEMBER">メンバー</option>
              <option value="TENANT_ADMIN">テナント管理者</option>
            </select>
          </div>

          {/* エラーメッセージ */}
          {errors.submit && (
            <div className="rounded-lg bg-danger/10 border border-danger/20 p-3">
              <p className="text-sm text-danger">{errors.submit}</p>
            </div>
          )}

          {/* ボタン */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "作成中..." : "ユーザーを作成"}
            </button>
            <Link
              href={`/tenants/${tenantId}/users`}
              className="flex-1 rounded-lg border border-soft px-4 py-2 text-sm text-center text-headline transition hover:border-accent"
            >
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}