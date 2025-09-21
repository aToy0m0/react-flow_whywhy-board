'use client';

import { useState } from 'react';
import { useTenantTheme } from '@/hooks/useTenantTheme';
import { TENANT_THEME_OPTIONS, type TenantThemeKey } from '@/lib/tenantThemes';

interface ThemeSelectorProps {
  currentTheme: TenantThemeKey;
  onThemeChange: (themeKey: TenantThemeKey) => Promise<void>;
  disabled?: boolean;
}

export function ThemeSelector({ currentTheme, onThemeChange, disabled = false }: ThemeSelectorProps) {
  const [selectedTheme, setSelectedTheme] = useState<TenantThemeKey>(currentTheme);
  const [isSaving, setIsSaving] = useState(false);
  const { applyTheme } = useTenantTheme();

  const hasUnsavedChanges = selectedTheme !== currentTheme;

  const handleThemeSelect = (themeKey: TenantThemeKey) => {
    if (disabled || isSaving) return;

    setSelectedTheme(themeKey);
    // プレビューとして即座にテーマを適用
    applyTheme(themeKey);
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges || isSaving || disabled) return;

    setIsSaving(true);
    try {
      await onThemeChange(selectedTheme);
    } catch (error) {
      console.error('テーマ保存に失敗しました:', error);
      // エラー時は元のテーマに戻す
      setSelectedTheme(currentTheme);
      applyTheme(currentTheme);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (disabled || isSaving) return;

    setSelectedTheme(currentTheme);
    applyTheme(currentTheme);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-headline">テーマ設定</h3>
      <p className="text-sm text-muted">
        テナントのカラーテーマを選択してください。すべてのユーザーに適用されます。
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TENANT_THEME_OPTIONS.map((theme) => {
          const isSelected = theme.key === selectedTheme;
          const isCurrent = theme.key === currentTheme;
          const isDisabled = disabled || isSaving;

          return (
            <button
              key={theme.key}
              onClick={() => handleThemeSelect(theme.key)}
              disabled={isDisabled}
              className={`
                relative rounded-lg border p-4 text-left transition-all duration-200
                ${isSelected
                  ? 'border-highlight bg-surface-active'
                  : 'border-soft bg-surface-card hover:border-accent hover:bg-surface-hover'
                }
                ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
            >
              <div
                className="mb-3 h-8 w-full rounded"
                style={{ background: theme.previewGradient }}
              />

              <div className="space-y-1">
                <p className={`text-sm font-medium ${isSelected ? 'text-headline' : 'text-paragraph'}`}>
                  {theme.label}
                  {isCurrent && !hasUnsavedChanges && (
                    <span className="ml-2 text-xs text-muted">(現在)</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {theme.description}
                </p>
              </div>

              {isSelected && (
                <div className="absolute -top-1 -right-1 rounded-full bg-highlight p-1">
                  <svg className="h-3 w-3 text-background" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {hasUnsavedChanges && (
        <div className="flex items-center gap-3 rounded-lg bg-surface-card p-4 border border-soft">
          <div className="flex-1">
            <p className="text-sm font-medium text-headline">
              テーマの変更があります
            </p>
            <p className="text-xs text-muted">
              変更を保存するか、キャンセルしてください
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm border border-soft rounded-md text-paragraph hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm bg-highlight text-background rounded-md hover:bg-highlight-hover transition-colors disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {isSaving && (
        <p className="text-sm text-muted">テーマを保存中...</p>
      )}
    </div>
  );
}