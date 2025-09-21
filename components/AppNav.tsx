"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Route } from "next";
import { Home, LayoutDashboard, FileText, Users, Settings, RefreshCw, FileQuestion, LogIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import WhyBoardIcon from "@/components/WhyBoardIcon";
import { SessionInfo } from "@/types/session";

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

  type LinkItem = { href: string; label: string; icon: LucideIcon; hidden?: boolean };

  const links: LinkItem[] = isAuthenticated
    ? [
        { href: '/', label: 'ダッシュボード', icon: Home },
        tenantId ? { href: `/tenants/${tenantId}/dashboard`, label: 'テナント', icon: LayoutDashboard } : null,
        tenantId ? { href: `/tenants/${tenantId}/boards`, label: 'ボード', icon: FileText } : null,
        tenantId ? { href: `/tenants/${tenantId}/users`, label: 'ユーザー', icon: Users } : null,
        isSuperAdmin ? { href: '/manage', label: 'テナント管理', icon: Settings } : null,
        isSuperAdmin ? { href: '/init', label: '初期化', icon: RefreshCw } : null,
        { href: '/setup', label: 'セットアップ', icon: Settings, hidden: !isSuperAdmin },
        { href: '/docs', label: 'ドキュメント', icon: FileQuestion },
      ].filter((link): link is LinkItem => Boolean(link))
    : [
        { href: '/login', label: 'ログイン', icon: LogIn },
        { href: '/setup', label: 'セットアップ', icon: Settings },
        { href: '/docs', label: 'ドキュメント', icon: FileQuestion },
      ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-overlay bg-surface-overlay backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 text-sm text-paragraph">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-headline">
            <WhyBoardIcon size={28} />
            <span>WhyWhy Board</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links
              .filter((link) => !link.hidden)
              .map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href as Route}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl transition-colors group ${
                      isActive
                        ? 'bg-accent text-background'
                        : 'text-paragraph hover:text-accent hover:bg-surface-hover'
                    }`}
                    title={link.label}
                  >
                    <Icon size={16} className={`transition-colors mb-1 ${
                      isActive
                        ? 'text-background'
                        : 'text-paragraph group-hover:text-accent'
                    }`} />
                    <span className={`text-xs transition-colors ${
                      isActive
                        ? 'text-background'
                        : 'text-paragraph group-hover:text-accent'
                    }`}>
                      {link.label}
                    </span>
                  </Link>
                );
              })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden text-xs text-muted md:inline">{session.email} ({session.role})</span>
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
                className="rounded-lg border border-soft px-3 py-1 text-xs font-medium text-paragraph transition hover:border-accent hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={signingOut}
              >
                {signingOut ? 'ログアウト中...' : 'ログアウト'}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-soft px-3 py-1 text-xs font-medium text-paragraph transition hover:border-accent hover:bg-surface-hover"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
