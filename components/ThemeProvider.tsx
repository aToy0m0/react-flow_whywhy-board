'use client';

import { useEffect, useState } from 'react';
import { useTenantTheme } from '@/hooks/useTenantTheme';
import { DEFAULT_TENANT_THEME_KEY, type TenantThemeKey, isTenantThemeKey } from '@/lib/tenantThemes';

interface ThemeProviderProps {
  children: React.ReactNode;
  initialThemeKey?: string | null;
}

export function ThemeProvider({ children, initialThemeKey }: ThemeProviderProps) {
  const { initializeTheme } = useTenantTheme();
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        // URLからテナントIDを取得
        const pathSegments = window.location.pathname.split('/');
        const tenantIndex = pathSegments.indexOf('tenants');

        if (tenantIndex !== -1 && pathSegments[tenantIndex + 1]) {
          const tenantId = pathSegments[tenantIndex + 1];

          // データベースからテーマを取得
          const response = await fetch(`/api/tenants/${tenantId}/theme`);
          if (response.ok) {
            const data = await response.json();
            const dbThemeKey = data.tenant.themeKey || DEFAULT_TENANT_THEME_KEY;
            initializeTheme(dbThemeKey);
            setThemeLoaded(true);
            return;
          }
        }

        // テナントページでない場合や取得失敗時はデフォルトまたは初期テーマを使用
        const themeKey: TenantThemeKey = isTenantThemeKey(initialThemeKey)
          ? initialThemeKey
          : DEFAULT_TENANT_THEME_KEY;
        initializeTheme(themeKey);
        setThemeLoaded(true);
      } catch (error) {
        console.error('テーマ読み込みエラー:', error);
        // エラー時はデフォルトテーマを適用
        initializeTheme(DEFAULT_TENANT_THEME_KEY);
        setThemeLoaded(true);
      }
    };

    loadTheme();
  }, [initializeTheme, initialThemeKey]);

  // テーマが読み込まれるまでは内容を表示しない（フラッシュを防ぐ）
  if (!themeLoaded) {
    return null;
  }

  return <>{children}</>;
}