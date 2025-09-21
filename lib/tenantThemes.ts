const CSS_VARIABLE_NAMES = [
  '--color-background',
  '--color-headline',
  '--color-paragraph',
  '--color-muted',
  '--color-subtle',
  '--color-highlight',
  '--color-secondary',
  '--color-tertiary',
  '--color-main',
  '--color-button',
  '--color-button-text',
  '--color-button-hover',
  '--color-danger-text',
  '--surface-card-muted',
  '--surface-card',
  '--surface-card-strong',
  '--surface-muted',
  '--surface-panel',
  '--surface-code',
  '--surface-overlay',
  '--surface-overlay-strong',
  '--surface-hover',
  '--surface-hover-strong',
  '--surface-active',
  '--surface-danger',
  '--border-subtle',
  '--border-soft',
  '--border-overlay',
  '--border-accent',
  '--border-soft-accent',
  '--border-accent-strong',
  '--border-strong',
  '--border-danger',
  '--accent-solid',
  '--accent-solid-hover',
  '--accent-soft',
  '--accent-soft-hover',
  '--accent-border',
  '--accent-border-active',
  '--accent-ring',
  '--accent-ring-soft',
  '--ring-primary',
  '--ring-highlight',
  '--grid-dot-color',
] as const;

export type CssVariableName = (typeof CSS_VARIABLE_NAMES)[number];

export type TenantThemeKey = 'midnight' | 'lagoon' | 'sunrise' | 'forest';

export type TenantTheme = {
  key: TenantThemeKey;
  label: string;
  description: string;
  previewGradient: string;
  cssVars: Record<CssVariableName, string>;
};

const midnightTheme: TenantTheme = {
  key: 'midnight',
  label: 'Midnight Aurora',
  description: 'ネイビーとローズを基調にした既定のダークテーマ',
  previewGradient: 'linear-gradient(135deg, #232946 0%, #4a3f6a 100%)',
  cssVars: {
    '--color-background': '#232946',
    '--color-headline': '#ffffff',
    '--color-paragraph': '#b8c1ec',
    '--color-muted': '#94a0cf',
    '--color-subtle': '#a6b2de',
    '--color-highlight': '#eebbc3',
    '--color-secondary': '#ffffff',
    '--color-tertiary': '#eebbc3',
    '--color-main': '#b8c1ec',
    '--color-button': '#eebbc3',
    '--color-button-text': '#232946',
    '--color-button-hover': '#e4929f',
    '--color-danger-text': 'rgba(238, 187, 195, 0.95)',
    '--surface-card-muted': 'rgba(255, 255, 255, 0.05)',
    '--surface-card': 'rgba(255, 255, 255, 0.06)',
    '--surface-card-strong': 'rgba(255, 255, 255, 0.08)',
    '--surface-muted': 'rgba(18, 22, 41, 0.55)',
    '--surface-panel': 'rgba(18, 22, 41, 0.75)',
    '--surface-code': 'rgba(18, 22, 41, 0.65)',
    '--surface-overlay': 'rgba(18, 22, 41, 0.85)',
    '--surface-overlay-strong': 'rgba(255, 255, 255, 0.8)',
    '--surface-hover': 'rgba(238, 187, 195, 0.10)',
    '--surface-hover-strong': 'rgba(238, 187, 195, 0.12)',
    '--surface-active': 'rgba(238, 187, 195, 0.18)',
    '--surface-danger': 'rgba(238, 68, 90, 0.12)',
    '--border-subtle': 'rgba(18, 22, 41, 0.35)',
    '--border-soft': 'rgba(255, 255, 255, 0.20)',
    '--border-overlay': 'rgba(18, 22, 41, 0.45)',
    '--border-accent': 'rgba(238, 187, 195, 0.40)',
    '--border-soft-accent': 'rgba(238, 187, 195, 0.35)',
    '--border-accent-strong': 'rgba(238, 187, 195, 0.50)',
    '--border-strong': 'rgba(238, 187, 195, 0.55)',
    '--border-danger': 'rgba(238, 68, 90, 0.60)',
    '--accent-solid': '#0ea5e9',
    '--accent-solid-hover': '#38bdf8',
    '--accent-soft': '#7dd3fc',
    '--accent-soft-hover': '#bae6fd',
    '--accent-border': '#38bdf8',
    '--accent-border-active': '#7dd3fc',
    '--accent-ring': 'rgba(14, 165, 233, 0.4)',
    '--accent-ring-soft': 'rgba(125, 211, 252, 0.35)',
    '--ring-primary': 'rgba(184, 193, 236, 0.16)',
    '--ring-highlight': 'rgba(238, 187, 195, 0.16)',
    '--grid-dot-color': 'rgba(99, 102, 241, 0.1)',
  },
};

const lagoonTheme: TenantTheme = {
  key: 'lagoon',
  label: 'Lagoon Tide',
  description: '深い群青とターコイズで視差感を抑えたクールトーン',
  previewGradient: 'linear-gradient(135deg, #041b27 0%, #1f6f8b 100%)',
  cssVars: {
    '--color-background': '#041b27',
    '--color-headline': '#f8fafc',
    '--color-paragraph': '#cde4f0',
    '--color-muted': '#90b8ca',
    '--color-subtle': '#a3c5d6',
    '--color-highlight': '#23a0be',
    '--color-secondary': '#e6f7fc',
    '--color-tertiary': '#23a0be',
    '--color-main': '#7bd4ef',
    '--color-button': '#23a0be',
    '--color-button-text': '#03141f',
    '--color-button-hover': '#1c88a6',
    '--color-danger-text': 'rgba(248, 218, 226, 0.95)',
    '--surface-card-muted': 'rgba(35, 160, 190, 0.08)',
    '--surface-card': 'rgba(35, 160, 190, 0.12)',
    '--surface-card-strong': 'rgba(35, 160, 190, 0.16)',
    '--surface-muted': 'rgba(6, 41, 54, 0.65)',
    '--surface-panel': 'rgba(6, 41, 54, 0.78)',
    '--surface-code': 'rgba(6, 41, 54, 0.72)',
    '--surface-overlay': 'rgba(5, 32, 44, 0.88)',
    '--surface-overlay-strong': 'rgba(16, 44, 56, 0.92)',
    '--surface-hover': 'rgba(35, 160, 190, 0.18)',
    '--surface-hover-strong': 'rgba(35, 160, 190, 0.24)',
    '--surface-active': 'rgba(35, 160, 190, 0.32)',
    '--surface-danger': 'rgba(252, 129, 129, 0.16)',
    '--border-subtle': 'rgba(14, 40, 54, 0.55)',
    '--border-soft': 'rgba(56, 125, 149, 0.45)',
    '--border-overlay': 'rgba(18, 61, 80, 0.6)',
    '--border-accent': 'rgba(35, 160, 190, 0.55)',
    '--border-soft-accent': 'rgba(35, 160, 190, 0.40)',
    '--border-accent-strong': 'rgba(35, 160, 190, 0.65)',
    '--border-strong': 'rgba(35, 160, 190, 0.75)',
    '--border-danger': 'rgba(230, 77, 92, 0.65)',
    '--accent-solid': '#23a0be',
    '--accent-solid-hover': '#1c88a6',
    '--accent-soft': '#7bd4ef',
    '--accent-soft-hover': '#c2ecf7',
    '--accent-border': '#2ab2d2',
    '--accent-border-active': '#55c5de',
    '--accent-ring': 'rgba(35, 160, 190, 0.45)',
    '--accent-ring-soft': 'rgba(123, 212, 239, 0.40)',
    '--ring-primary': 'rgba(123, 212, 239, 0.28)',
    '--ring-highlight': 'rgba(35, 160, 190, 0.35)',
    '--grid-dot-color': 'rgba(43, 178, 210, 0.22)',
  },
};

const sunriseTheme: TenantTheme = {
  key: 'sunrise',
  label: 'Sunrise Bloom',
  description: '夜明けのオレンジとモーブが基調のウォームトーン',
  previewGradient: 'linear-gradient(135deg, #2f1633 0%, #f28482 100%)',
  cssVars: {
    '--color-background': '#2f1633',
    '--color-headline': '#fff7f5',
    '--color-paragraph': '#f3d7d9',
    '--color-muted': '#d9a8b5',
    '--color-subtle': '#e2b8c2',
    '--color-highlight': '#f7a072',
    '--color-secondary': '#ffe5d9',
    '--color-tertiary': '#f28482',
    '--color-main': '#f3c6a6',
    '--color-button': '#f7a072',
    '--color-button-text': '#321118',
    '--color-button-hover': '#f28482',
    '--color-danger-text': 'rgba(255, 214, 222, 0.95)',
    '--surface-card-muted': 'rgba(247, 160, 114, 0.08)',
    '--surface-card': 'rgba(247, 160, 114, 0.12)',
    '--surface-card-strong': 'rgba(247, 160, 114, 0.18)',
    '--surface-muted': 'rgba(84, 33, 65, 0.55)',
    '--surface-panel': 'rgba(84, 33, 65, 0.68)',
    '--surface-code': 'rgba(66, 24, 55, 0.72)',
    '--surface-overlay': 'rgba(54, 22, 52, 0.82)',
    '--surface-overlay-strong': 'rgba(84, 33, 65, 0.9)',
    '--surface-hover': 'rgba(248, 199, 153, 0.18)',
    '--surface-hover-strong': 'rgba(248, 199, 153, 0.24)',
    '--surface-active': 'rgba(248, 199, 153, 0.32)',
    '--surface-danger': 'rgba(244, 114, 182, 0.16)',
    '--border-subtle': 'rgba(84, 33, 65, 0.45)',
    '--border-soft': 'rgba(242, 196, 191, 0.25)',
    '--border-overlay': 'rgba(108, 42, 74, 0.58)',
    '--border-accent': 'rgba(247, 160, 114, 0.5)',
    '--border-soft-accent': 'rgba(247, 160, 114, 0.35)',
    '--border-accent-strong': 'rgba(247, 160, 114, 0.65)',
    '--border-strong': 'rgba(248, 199, 153, 0.75)',
    '--border-danger': 'rgba(239, 71, 111, 0.6)',
    '--accent-solid': '#f28482',
    '--accent-solid-hover': '#f6bd60',
    '--accent-soft': '#f9bec7',
    '--accent-soft-hover': '#fde2e4',
    '--accent-border': '#f6bd60',
    '--accent-border-active': '#f7d488',
    '--accent-ring': 'rgba(242, 132, 130, 0.45)',
    '--accent-ring-soft': 'rgba(249, 190, 199, 0.35)',
    '--ring-primary': 'rgba(249, 190, 199, 0.28)',
    '--ring-highlight': 'rgba(247, 160, 114, 0.32)',
    '--grid-dot-color': 'rgba(242, 132, 130, 0.22)',
  },
};

const forestTheme: TenantTheme = {
  key: 'forest',
  label: 'Evergreen Field',
  description: 'エバーグリーンとエメラルドを軸にしたオーガニックトーン',
  previewGradient: 'linear-gradient(135deg, #0f241b 0%, #2a9d8f 100%)',
  cssVars: {
    '--color-background': '#0f241b',
    '--color-headline': '#f1fdf7',
    '--color-paragraph': '#c1e3d4',
    '--color-muted': '#92cbb1',
    '--color-subtle': '#a3d5bc',
    '--color-highlight': '#5ecf9b',
    '--color-secondary': '#d4f7e8',
    '--color-tertiary': '#5ecf9b',
    '--color-main': '#82d9b4',
    '--color-button': '#5ecf9b',
    '--color-button-text': '#062116',
    '--color-button-hover': '#45ba86',
    '--color-danger-text': 'rgba(255, 224, 225, 0.95)',
    '--surface-card-muted': 'rgba(94, 207, 155, 0.08)',
    '--surface-card': 'rgba(94, 207, 155, 0.12)',
    '--surface-card-strong': 'rgba(94, 207, 155, 0.18)',
    '--surface-muted': 'rgba(12, 54, 37, 0.58)',
    '--surface-panel': 'rgba(12, 54, 37, 0.70)',
    '--surface-code': 'rgba(9, 42, 29, 0.68)',
    '--surface-overlay': 'rgba(9, 36, 24, 0.82)',
    '--surface-overlay-strong': 'rgba(44, 82, 63, 0.9)',
    '--surface-hover': 'rgba(130, 217, 180, 0.20)',
    '--surface-hover-strong': 'rgba(94, 207, 155, 0.26)',
    '--surface-active': 'rgba(94, 207, 155, 0.32)',
    '--surface-danger': 'rgba(239, 95, 111, 0.16)',
    '--border-subtle': 'rgba(12, 54, 37, 0.50)',
    '--border-soft': 'rgba(85, 128, 107, 0.35)',
    '--border-overlay': 'rgba(27, 77, 56, 0.60)',
    '--border-accent': 'rgba(94, 207, 155, 0.50)',
    '--border-soft-accent': 'rgba(94, 207, 155, 0.35)',
    '--border-accent-strong': 'rgba(94, 207, 155, 0.65)',
    '--border-strong': 'rgba(94, 207, 155, 0.75)',
    '--border-danger': 'rgba(217, 70, 98, 0.60)',
    '--accent-solid': '#34d399',
    '--accent-solid-hover': '#22c55e',
    '--accent-soft': '#6ee7b7',
    '--accent-soft-hover': '#bbf7d0',
    '--accent-border': '#47e2a5',
    '--accent-border-active': '#7ef3bf',
    '--accent-ring': 'rgba(34, 197, 94, 0.42)',
    '--accent-ring-soft': 'rgba(110, 231, 183, 0.35)',
    '--ring-primary': 'rgba(110, 231, 183, 0.28)',
    '--ring-highlight': 'rgba(94, 207, 155, 0.32)',
    '--grid-dot-color': 'rgba(94, 207, 155, 0.22)',
  },
};

const TENANT_THEMES: Record<TenantThemeKey, TenantTheme> = {
  midnight: midnightTheme,
  lagoon: lagoonTheme,
  sunrise: sunriseTheme,
  forest: forestTheme,
};

export const DEFAULT_TENANT_THEME_KEY: TenantThemeKey = 'midnight';

export function isTenantThemeKey(value: unknown): value is TenantThemeKey {
  return typeof value === 'string' && value in TENANT_THEMES;
}

export function resolveTenantTheme(themeKey: string | null | undefined): TenantTheme {
  if (isTenantThemeKey(themeKey)) {
    return TENANT_THEMES[themeKey];
  }
  return TENANT_THEMES[DEFAULT_TENANT_THEME_KEY];
}

export const TENANT_THEME_OPTIONS = Object.values(TENANT_THEMES).map(({ key, label, description, previewGradient }) => ({
  key,
  label,
  description,
  previewGradient,
}));

export const TENANT_THEME_KEYS = Object.keys(TENANT_THEMES) as TenantThemeKey[];

export function buildThemeCss(theme: TenantTheme) {
  const lines = CSS_VARIABLE_NAMES.map((name) => {
    const value = theme.cssVars[name];
    return `  ${name}: ${value};`;
  });
  return `:root {\n${lines.join('\n')}\n}`;
}

if (process.env.NODE_ENV !== 'production') {
  for (const theme of Object.values(TENANT_THEMES)) {
    for (const name of CSS_VARIABLE_NAMES) {
      if (!(name in theme.cssVars)) {
        throw new Error(`Theme "${theme.key}" is missing css variable ${name}`);
      }
    }
  }
}

export default TENANT_THEMES;
