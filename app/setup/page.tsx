"use client";

import { FormEvent, useState } from "react";
import AppNav from "@/components/AppNav";

export default function SetupPage() {
  const [status, setStatus] = useState<"idle" | "pending" | "fulfilled" | "rejected">("idle");
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [tenantSlug, setTenantSlug] = useState<string>("");

  const triggerInit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!password.trim()) {
      setStatus("rejected");
      setMessage("パスワードを入力してください。");
      return;
    }
    setStatus("pending");
    setMessage("");
    try {
      const payload: Record<string, string> = {};
      if (email.trim()) {
        payload.email = email.trim();
      }
      if (tenantSlug.trim()) {
        payload.tenantSlug = tenantSlug.trim();
      }
      payload.password = password;

      const res = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error ?? res.statusText);
      }
      setStatus("fulfilled");
      setMessage(data.message ?? "初期化に成功しました。/login へ移動してください。");
    } catch (error) {
      setStatus("rejected");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <AppNav session={null} />
      <main className="min-h-screen bg-background text-paragraph">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 pt-20 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-subtle">Setup</p>
          <h1 className="text-3xl font-semibold text-headline">初回セットアップ</h1>
          <p className="text-muted">
            下記フォームからスーパー管理者のメールアドレス・パスワード・テナントスラッグを指定して初期化できます。空欄の項目は環境変数（`SUPERADMIN_EMAIL` / `NEXT_PUBLIC_TENANT_ID`）の値が使用されます。
          </p>
        </header>

        <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur space-y-4">
          <h2 className="text-lg font-semibold text-headline">手順</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-paragraph">
            <li>メール・パスワードなどを入力します。</li>
            <li>「スーパー管理者を作成」を押して `/api/init` を実行します。</li>
            <li>サインインページ(`/login`)で指定した資格情報を入力します。</li>
          </ol>
          <form className="space-y-4" onSubmit={triggerInit}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-paragraph" htmlFor="superadmin-email">
                メールアドレス（任意）
              </label>
              <input
                id="superadmin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                className="w-full rounded-lg border border-soft bg-surface-panel px-3 py-2 text-sm text-headline focus:border-accent-border focus:outline-none"
                placeholder="例: sadmin@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-paragraph" htmlFor="superadmin-password">
                パスワード（必須）
              </label>
              <input
                id="superadmin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                className="w-full rounded-lg border border-soft bg-surface-panel px-3 py-2 text-sm text-headline focus:border-accent-border focus:outline-none"
                placeholder="任意のパスワードを入力"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-paragraph" htmlFor="superadmin-tenant">
                テナントスラッグ（任意）
              </label>
              <input
                id="superadmin-tenant"
                type="text"
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.currentTarget.value)}
                className="w-full rounded-lg border border-soft bg-surface-panel px-3 py-2 text-sm text-headline focus:border-accent-border focus:outline-none"
                placeholder="例: default"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-semibold text-headline transition hover:bg-accent-solid-hover disabled:opacity-50"
              disabled={status === "pending"}
            >
              {status === "pending" ? "初期化中..." : "スーパー管理者を作成"}
            </button>
          </form>
          {status !== "idle" && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                status === "fulfilled"
                  ? "border-emerald-400 text-emerald-200"
                  : status === "rejected"
                  ? "border-rose-400 text-rose-200"
                  : "border-sky-400 text-sky-200"
              }`}
            >
              {message || (status === "pending" ? "API を呼び出しています..." : "完了しました")}
            </div>
          )}
        </section>
        </div>
      </main>
    </>
  );
}
