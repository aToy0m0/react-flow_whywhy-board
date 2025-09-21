"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { signIn, signOut } from "next-auth/react";

type Props = {
  callbackUrl?: string;
};

export default function LoginClient({ callbackUrl = "/" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setStatus("error");
      return;
    }

    setStatus("loading");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.ok) {
      setStatus("success");
      const target = (result.url ?? callbackUrl) as Route;
      router.replace(target);
      router.refresh();
    } else {
      setStatus("error");
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    setStatus("idle");
  };

  return (
    <main className="min-h-screen bg-background text-paragraph">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-16">
        <header className="mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-subtle">WhyWhy Board</p>
          <h1 className="mt-4 text-4xl font-bold lg:text-5xl text-headline">サインイン</h1>
          <p className="mt-4 text-muted">
            認証に成功するとセッションが開始され、ボードや管理画面へアクセスできるようになります。
          </p>
        </header>

        <section className="flex flex-1 flex-col gap-8 lg:flex-row">
          <div className="flex-1 rounded-2xl bg-surface-card p-8 shadow-xl backdrop-blur">
            <h2 className="text-2xl font-semibold text-headline">認証情報の入力</h2>
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-paragraph">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface-input px-4 py-2 text-base text-paragraph outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/50"
                  placeholder="sadmin@example.com"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-paragraph">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface-input px-4 py-2 text-base text-paragraph outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/50"
                  placeholder="********"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-highlight px-4 py-2 text-base font-semibold text-background shadow-lg transition hover:bg-highlight-hover focus:outline-none focus:ring-2 focus:ring-highlight/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status === "loading"}
              >
                {status === "loading" ? "認証中..." : "サインイン"}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-lg border border-soft px-4 py-2 text-base font-semibold text-paragraph transition hover:border-accent hover:bg-surface-hover"
              >
                サインアウト
              </button>
            </form>

            {/* <div className="mt-6 min-h-[3rem] rounded-lg bg-surface-card-muted px-4 py-3 text-sm text-paragraph">
              {status === "idle" && (
                <p>入力したユーザーが有効であればセッションが開始されます。初期ユーザーは SuperAdmin で作成してください。</p>
              )}
              {status === "loading" && <p className="text-accent-soft">{message || "認証を確認しています..."}</p>}
              {status === "success" && <p className="text-success">{message}</p>}
              {status === "error" && <p className="text-error">{message}</p>}
            </div> */}
          </div>

          {/* <aside className="flex-1 space-y-6 rounded-2xl bg-surface-card p-8 shadow-lg backdrop-blur">
            <h2 className="text-xl font-semibold text-headline">ログインに関するヒント</h2>
            <ul className="space-y-4 text-sm text-paragraph">
              <li>
                <strong className="font-semibold text-accent-soft">セッション管理</strong>
                <p className="mt-1 text-muted">
                  NextAuth のセッションでログイン状態を維持します。ブラウザを閉じてもセッションが有効な間は再サインインは不要です。
                </p>
              </li>
              <li>
                <strong className="font-semibold text-accent-soft">ロールの違い</strong>
                <p className="mt-1 text-muted text-xs">
                  SUPER_ADMIN: 全テナント管理 / TENANT_ADMIN: 自テナント管理 / MEMBER: ボード利用のみ。
                </p>
              </li>
              <li>
                <strong className="font-semibold text-accent-soft">困ったときは</strong>
                <p className="mt-1 text-muted">
                  パスワードを忘れた場合は管理者に問い合わせ、新しいパスワードを発行してください。
                </p>
              </li>
            </ul>

            <div className="rounded-xl bg-surface-card-muted p-6">
              <h3 className="text-lg font-semibold text-headline">次のステップ</h3>
              <p className="mt-2 text-muted">
                認証が完了したら、ダッシュボードから各機能に移動できます。
              </p>
              <div className="mt-4 space-y-3">
                <Link
                  href="/"
                  className="block rounded-lg bg-highlight px-4 py-2 text-center text-sm font-semibold text-background transition hover:bg-highlight-hover"
                >
                  ダッシュボードに移動
                </Link>
                <Link
                  href="/docs"
                  className="block rounded-lg border border-soft px-4 py-2 text-center text-sm font-semibold text-paragraph transition hover:border-accent hover:bg-surface-hover"
                >
                  ドキュメントを開く
                </Link>
              </div>
            </div>
          </aside> */}
        </section>
      </div>
    </main>
  );
}
