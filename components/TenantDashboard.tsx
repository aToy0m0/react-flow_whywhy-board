'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeSelector } from '@/components/ThemeSelector';
import { type TenantThemeKey, DEFAULT_TENANT_THEME_KEY } from '@/lib/tenantThemes';

interface TenantInfo {
  tenantId: string;
  boardCount: number;
  userCount: number;
  recentBoards: Array<{
    id: string;
    boardKey: string;
    name: string;
    updatedAt: string;
  }>;
}

interface UserInfo {
  role: string;
  tenantId?: string;
}

interface TenantDashboardProps {
  tenantInfo: TenantInfo;
  userInfo: UserInfo;
}

export function TenantDashboard({ tenantInfo, userInfo }: TenantDashboardProps) {
  const [currentTheme, setCurrentTheme] = useState<TenantThemeKey>(DEFAULT_TENANT_THEME_KEY);
  const [loadingTheme, setLoadingTheme] = useState(true);

  const { tenantId, boardCount, userCount, recentBoards } = tenantInfo;

  // テーマ変更権限チェック
  const canChangeTheme = userInfo.role === 'SUPER_ADMIN' ||
    (userInfo.tenantId === tenantId && userInfo.role === 'TENANT_ADMIN');

  // 現在のテーマを取得
  useEffect(() => {
    const fetchCurrentTheme = async () => {
      try {
        const response = await fetch(`/api/tenants/${tenantId}/theme`);
        if (response.ok) {
          const data = await response.json();
          setCurrentTheme(data.tenant.themeKey || DEFAULT_TENANT_THEME_KEY);
        }
      } catch (error) {
        console.error('テーマ取得エラー:', error);
      } finally {
        setLoadingTheme(false);
      }
    };

    fetchCurrentTheme();
  }, [tenantId]);

  // テーマ変更ハンドラ
  const handleThemeChange = async (themeKey: TenantThemeKey) => {
    const response = await fetch(`/api/tenants/${tenantId}/theme`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ themeKey }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'テーマの更新に失敗しました');
    }

    setCurrentTheme(themeKey);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.4em] text-subtle">Tenant Dashboard</p>
        <h1 className="text-3xl font-semibold text-headline">{tenantId} のダッシュボード</h1>
        <p className="text-muted">ボード数とユーザー数の概要、最近更新されたボードを確認できます。</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
          <p className="text-sm uppercase text-subtle">Boards</p>
          <p className="mt-2 text-4xl font-bold text-headline">{boardCount}</p>
          <p className="mt-1 text-sm text-muted">登録されているボード</p>
          <Link href={`/tenants/${tenantId}/boards`} className="mt-4 inline-block text-sm text-accent-soft hover:text-accent-soft-hover">
            ボード一覧へ
          </Link>
        </div>
        <div className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
          <p className="text-sm uppercase text-subtle">Members</p>
          <p className="mt-2 text-4xl font-bold text-headline">{userCount}</p>
          <p className="mt-1 text-sm text-muted">テナント内のユーザー数</p>
          <Link href={`/tenants/${tenantId}/users`} className="mt-4 inline-block text-sm text-accent-soft hover:text-accent-soft-hover">
            ユーザー管理へ
          </Link>
        </div>
      </section>

      <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-headline">最近更新されたボード</h2>
          <Link href={`/tenants/${tenantId}/boards`} className="text-sm text-accent-soft hover:text-accent-soft-hover">
            すべて表示
          </Link>
        </div>
        {recentBoards.length === 0 ? (
          <p className="text-sm text-muted">まだボードがありません。新規作成してください。</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recentBoards.map((board) => (
              <Link
                key={board.id}
                href={`/tenants/${tenantId}/boards/${board.boardKey}`}
                className="rounded-xl border border-soft bg-surface-card-muted px-4 py-3 transition hover:border-accent"
              >
                <p className="text-sm font-semibold text-headline">{board.name}</p>
                <p className="text-xs text-muted">更新: {new Date(board.updatedAt).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {canChangeTheme && (
        <section className="rounded-3xl bg-surface-card p-6 shadow-xl backdrop-blur">
          {loadingTheme ? (
            <p className="text-muted">テーマ設定を読み込み中...</p>
          ) : (
            <ThemeSelector
              currentTheme={currentTheme}
              onThemeChange={handleThemeChange}
            />
          )}
        </section>
      )}
    </div>
  );
}