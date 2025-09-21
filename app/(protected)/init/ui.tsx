"use client";

import { useState } from "react";

type InitResponse = {
  ok: boolean;
  created: boolean;
  updated: boolean;
  email: string;
  message?: string;
  error?: string;
};

type Props = {
  email: string | null;
};

export default function InitClient({ email }: Props) {
  const [status, setStatus] = useState<"idle" | "pending" | "fulfilled" | "rejected">("idle");
  const [message, setMessage] = useState<string>("");
  const [response, setResponse] = useState<InitResponse | null>(null);

  const handleInit = async () => {
    setStatus("pending");
    setMessage("");
    setResponse(null);
    try {
      const res = await fetch("/api/init", { method: "POST" });
      const data: InitResponse = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setStatus("fulfilled");
      setResponse(data);
      setMessage(data.message ?? "初期化に成功しました");
    } catch (error) {
      setStatus("rejected");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-subtle">Initialization</p>
          <h1 className="text-3xl font-semibold text-headline">スーパー管理者の初期化</h1>
          <p className="text-muted">
            現在ログインしているユーザー: {email ?? "不明"}
          </p>
        </header>

        <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur space-y-4">
          <p className="text-sm text-paragraph">
            `.env` の `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` を使用してユーザーを upsert します。既存ユーザーが存在する場合はパスワードを上書きします。
          </p>
          <button
            type="button"
            onClick={handleInit}
            className="rounded-lg bg-highlight px-4 py-2 text-sm font-semibold text-headline transition hover:bg-highlight/80 disabled:bg-subtle"
            disabled={status === "pending"}
          >
            {status === "pending" ? "呼び出し中..." : "/api/init を実行"}
          </button>
          {status !== "idle" && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                status === "fulfilled"
                  ? "border-success text-success"
                  : status === "rejected"
                  ? "border-error text-error"
                  : "border-accent text-accent-soft"
              }`}
            >
              {message}
            </div>
          )}
          {response && (
            <pre className="whitespace-pre-wrap rounded-lg bg-black/40 px-4 py-3 text-xs text-paragraph">
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </main>
  );
}
