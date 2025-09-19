"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";

const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "default";
const DEFAULT_BOARD_ID = "MVP";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setStatus("error");
      setMessage("ユーザー名とパスワードを入力してください。");
      return;
    }

    setStatus("loading");
    setMessage("認証を確認しています...");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      setStatus("success");
      setMessage("認証に成功しました。ボード画面へ移動します。");
      setTimeout(() => {
        router.push(`/${DEFAULT_TENANT_ID}/board/${DEFAULT_BOARD_ID}`);
      }, 1000);
    } else {
      setStatus("error");
      setMessage("認証に失敗しました。ユーザー名とパスワードを確認してください。");
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    setStatus("idle");
    setMessage("サインアウトしました。");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-16">
        <header className="mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-300">WhyWhy Board</p>
          <h1 className="mt-4 text-4xl font-bold lg:text-5xl">サインイン</h1>
          <p className="mt-4 text-slate-300">
            認証に成功するとセッションが開始され、ボードや管理画面へアクセスできるようになります。
          </p>
        </header>

        <section className="flex flex-1 flex-col gap-8 lg:flex-row">
          <div className="flex-1 rounded-2xl bg-white/10 p-8 shadow-xl backdrop-blur">
            <h2 className="text-2xl font-semibold">認証情報の入力</h2>
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-slate-200">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-base text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500"
                  placeholder="admin@example.com"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-base text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500"
                  placeholder="******"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-sky-500 px-4 py-2 text-base font-semibold text-white shadow-lg transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-500"
                disabled={status === "loading"}
              >
                {status === "loading" ? "認証中..." : "サインイン"}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-lg border border-white/30 px-4 py-2 text-base font-semibold text-slate-200 transition hover:border-white/60 hover:bg-white/5"
              >
                サインアウト
              </button>
            </form>

            <div className="mt-6 min-h-[3rem] rounded-lg bg-black/30 px-4 py-3 text-sm text-slate-100">
              {status === "idle" && (
                <p>入力したユーザーが有効であればセッションが開始されます。初期ユーザーは管理者画面から追加してください。</p>
              )}
              {status === "loading" && <p className="text-sky-200">{message || "認証を確認しています..."}</p>}
              {status === "success" && <p className="text-emerald-200">{message}</p>}
              {status === "error" && <p className="text-rose-200">{message}</p>}
            </div>
          </div>

          <aside className="flex-1 space-y-6 rounded-2xl bg-white/5 p-8 shadow-lg backdrop-blur">
            <h2 className="text-xl font-semibold text-white">ログインに関するヒント</h2>
            <ul className="space-y-4 text-sm text-slate-200">
              <li>
                <strong className="font-semibold text-sky-200">セッション管理</strong>
                <p className="mt-1 text-slate-300">
                  NextAuth のセッションクッキーでログイン状態を維持します。ブラウザを閉じてもセッションが有効な間は再サインインは不要です。
                </p>
              </li>
              <li>
                <strong className="font-semibold text-sky-200">推奨ワークフロー</strong>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-300">
                  <li>管理者がユーザーを作成（管理画面から）</li>
                  <li>ユーザーはこの画面でサインイン</li>
                  <li>ボードや管理機能にアクセス</li>
                </ol>
              </li>
              <li>
                <strong className="font-semibold text-sky-200">困ったときは</strong>
                <p className="mt-1 text-slate-300">
                  パスワードを忘れた場合は管理者に問い合わせ、新しいパスワードを発行してください。
                </p>
              </li>
            </ul>

            <div className="rounded-xl bg-black/30 p-6">
              <h3 className="text-lg font-semibold text-white">次のステップ</h3>
              <p className="mt-2 text-slate-300">
                認証が完了したら、「WhyWhy ボードに移動」から分析を開始できます。
              </p>
              <div className="mt-4 space-y-3">
                <Link
                  href={`/${DEFAULT_TENANT_ID}/board/${DEFAULT_BOARD_ID}`}
                  className="block rounded-lg bg-sky-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  WhyWhy ボードに移動
                </Link>
                <Link
                  href="/"
                  className="block rounded-lg border border-white/40 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/60 hover:bg-white/10"
                >
                  トップページに戻る
                </Link>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
