'use client';

import { useEffect, useCallback } from 'react';
import TENANT_THEMES, {
  type TenantThemeKey,
  type TenantTheme,
  resolveTenantTheme,
  DEFAULT_TENANT_THEME_KEY
} from '@/lib/tenantThemes';

export function useTenantTheme() {
  const applyTheme = useCallback((themeKey: TenantThemeKey | null | undefined) => {
    const theme = resolveTenantTheme(themeKey);

    // CSS変数をHTMLに適用
    Object.entries(theme.cssVars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, []);

  const initializeTheme = useCallback((themeKey?: TenantThemeKey | null) => {
    // デフォルトテーマまたは指定されたテーマを適用
    applyTheme(themeKey || DEFAULT_TENANT_THEME_KEY);
  }, [applyTheme]);

  return {
    applyTheme,
    initializeTheme,
    availableThemes: TENANT_THEMES,
  };
}

export type { TenantThemeKey, TenantTheme };