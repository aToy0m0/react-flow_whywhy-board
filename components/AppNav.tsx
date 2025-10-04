"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Route } from "next";
import { Home, LayoutDashboard, FileText, Users, Settings, RefreshCw, FileQuestion, LogIn, Menu, X } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

  const visibleLinks = links.filter((link) => !link.hidden);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-overlay bg-surface-overlay backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 text-sm text-paragraph sm:h-16">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-headline">
            <WhyBoardIcon size={28} />
            <span>WhyWhy Board</span>
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-soft bg-surface/90 p-2 text-paragraph shadow-sm transition hover:border-accent hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-controls="mobile-nav"
            aria-expanded={mobileMenuOpen}
          >
            <Menu size={18} aria-hidden="true" />
            <span className="sr-only">メインメニューを開く</span>
          </button>
          <nav
            className="no-scrollbar hidden items-center gap-1 overflow-x-auto pr-2 sm:flex sm:pt-1 md:gap-2 md:overflow-visible md:pr-0"
            aria-label="主要ナビゲーション"
          >
            {visibleLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href as Route}
                  aria-label={link.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={link.label}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors group md:flex-col md:gap-1 md:text-[11px] ${
                    isActive
                      ? 'bg-accent text-background'
                      : 'text-paragraph hover:bg-surface-hover hover:text-accent'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`transition-colors md:size-4 ${
                      isActive ? 'text-background' : 'text-paragraph group-hover:text-accent'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="sr-only md:hidden">{link.label}</span>
                  <span
                    className={`hidden md:block transition-colors ${
                      isActive
                        ? 'text-background'
                        : 'text-paragraph group-hover:text-accent'
                    }`}
                  >
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
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={closeMobileMenu} />
          <div className="absolute top-16 left-4 right-4 rounded-2xl border border-soft bg-surface-overlay-strong p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-headline">メニュー</span>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="inline-flex items-center justify-center rounded-lg border border-soft bg-surface/90 p-2 text-paragraph shadow-sm transition hover:border-accent hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="メインメニューを閉じる"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav id="mobile-nav" className="flex flex-col gap-2" aria-label="モバイルナビゲーション">
              {visibleLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const Icon = link.icon;
                return (
                  <Link
                    key={`mobile-${link.href}`}
                    href={link.href as Route}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-accent text-background'
                        : 'text-paragraph hover:bg-surface-hover hover:text-accent'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
