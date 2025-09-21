"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Route } from "next";
import WhyBoardIcon from "@/components/WhyBoardIcon";

interface SessionInfo {
  email: string;
  role: string;
  tenantId?: string | null;
}

interface AppNavProps {
  session: SessionInfo | null;
}

export default function AppNav({ session }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const isAuthenticated = Boolean(session);
  const tenantId = session?.tenantId ?? undefined;
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  type LinkItem = { href: string; label: string; hidden?: boolean };

  const links: LinkItem[] = isAuthenticated
    ? [
        { href: '/', label: 'ダッシュボード' },
        tenantId ? { href: `/tenants/${tenantId}/dashboard`, label: 'テナント' } : null,
        tenantId ? { href: `/tenants/${tenantId}/boards`, label: 'ボード' } : null,
        tenantId ? { href: `/tenants/${tenantId}/users`, label: 'ユーザー' } : null,
        isSuperAdmin ? { href: '/manage', label: 'テナント管理' } : null,
        isSuperAdmin ? { href: '/init', label: '初期化' } : null,
        { href: '/setup', label: 'セットアップ', hidden: !isSuperAdmin },
        { href: '/docs', label: 'ドキュメント' },
      ].filter((link): link is LinkItem => Boolean(link))
    : [
        { href: '/login', label: 'ログイン' },
        { href: '/setup', label: 'セットアップ' },
        { href: '/docs', label: 'ドキュメント' },
      ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[rgba(18,22,41,0.45)] bg-[rgba(18,22,41,0.85)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 text-sm text-paragraph">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-headline">
            <WhyBoardIcon size={28} />
            <span>WhyWhy Board</span>
          </Link>
          <nav className="hidden gap-2 md:flex">
            {links
              .filter((link) => !link.hidden)
              .map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href as Route}
                    className={`rounded-md px-3 py-1 text-sm transition ${
                      isActive
                        ? 'bg-[rgba(238,187,195,0.18)] text-headline border border-[rgba(238,187,195,0.4)]'
                        : 'text-paragraph hover:text-headline hover:bg-[rgba(238,187,195,0.1)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden text-xs text-paragraph md:inline">{session.email} ({session.role})</span>
              <button
                type="button"
                onClick={async () => {
                  if (signingOut) return;
                  setSigningOut(true);
                  try {
                    const result = await signOut({ redirect: false, callbackUrl: '/login' });
                    const nextUrl = (result?.url ?? '/login') as Route;
                    router.replace(nextUrl);
                    router.refresh();
                  } finally {
                    setSigningOut(false);
                  }
                }}
                className="rounded-lg border border-[rgba(238,187,195,0.45)] px-3 py-1 text-xs font-medium text-headline transition hover:border-highlight hover:bg-[rgba(238,187,195,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={signingOut}
              >
                {signingOut ? 'ログアウト中...' : 'ログアウト'}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-[rgba(238,187,195,0.45)] px-3 py-1 text-xs font-medium text-headline transition hover:border-highlight hover:bg-[rgba(238,187,195,0.12)]"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
