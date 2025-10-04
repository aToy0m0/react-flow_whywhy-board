'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTenantTheme } from '@/hooks/useTenantTheme';
import { DEFAULT_TENANT_THEME_KEY, type TenantThemeKey, isTenantThemeKey } from '@/lib/tenantThemes';

interface ThemeProviderProps {
  children: React.ReactNode;
  initialThemeKey?: string | null;
}

export function ThemeProvider({ children, initialThemeKey }: ThemeProviderProps) {
  const { initializeTheme } = useTenantTheme();
  const [themeLoaded, setThemeLoaded] = useState(false);
  const pathname = usePathname();
  const currentTenantRef = useRef<string | null>(null);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        // URLからテナントIDを取得
        const pathSegments = pathname.split('/');
        const tenantIndex = pathSegments.indexOf('tenants');

        if (tenantIndex !== -1 && pathSegments[tenantIndex + 1]) {
          const tenantId = pathSegments[tenantIndex + 1];

          // テナントが変わった場合のみ再読み込み
          if (currentTenantRef.current === tenantId && themeLoaded) {
            return;
          }

          currentTenantRef.current = tenantId;

          // データベースからテーマを取得
          const response = await fetch(`/api/tenants/${tenantId}/theme`);
          if (response.ok) {
            const data = await response.json();
            const dbThemeKey = data.tenant.themeKey || DEFAULT_TENANT_THEME_KEY;
            initializeTheme(dbThemeKey);
            setThemeLoaded(true);
            return;
          }

          // 403エラーの場合は権限不足のため、デフォルトテーマを静かに適用
          if (response.status === 403) {
            const themeKey: TenantThemeKey = isTenantThemeKey(initialThemeKey)
              ? initialThemeKey
              : DEFAULT_TENANT_THEME_KEY;
            initializeTheme(themeKey);
            setThemeLoaded(true);
            return;
          }
        } else {
          // テナントページ以外に移動した場合
          if (currentTenantRef.current !== null) {
            currentTenantRef.current = null;
          }
        }

        // 初回読み込み時、またはテナントページでない場合
        if (!themeLoaded) {
          const themeKey: TenantThemeKey = isTenantThemeKey(initialThemeKey)
            ? initialThemeKey
            : DEFAULT_TENANT_THEME_KEY;
          initializeTheme(themeKey);
          setThemeLoaded(true);
        }
      } catch (error) {
        console.error('テーマ読み込みエラー:', error);
        // エラー時はデフォルトテーマを適用
        if (!themeLoaded) {
          initializeTheme(DEFAULT_TENANT_THEME_KEY);
          setThemeLoaded(true);
        }
      }
    };

    loadTheme();
  }, [initializeTheme, initialThemeKey, pathname, themeLoaded]);

  // テーマが読み込まれるまでは内容を表示しない（フラッシュを防ぐ）
  if (!themeLoaded) {
    return null;
  }

  return <>{children}</>;
}