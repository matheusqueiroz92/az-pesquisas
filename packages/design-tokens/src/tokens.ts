/**
 * AZ Pesquisas design tokens (spec 012). Single source for the panel (via
 * theme.css, kept identical by tokens.test.ts) and the Expo app.
 * Brand primitives come from the AZ Work Center brand manual.
 */

/** Brand primitives. Components never use these directly: use `semantic`. */
export const brand = {
  red500: '#EF233C',
  red600: '#E21D2F',
  red700: '#C9182B',
  ink950: '#090A0C',
  carbon900: '#111317',
  graphite800: '#1A1D22',
  steel700: '#2B3038',
  mist400: '#A9B0BA',
  paper50: '#F4F1EB',
  chalk0: '#FFFFFF',
} as const;

/** Roles. Light is the panel default; dark is the sidebar and the app's dark surfaces. */
export const semantic = {
  light: {
    background: brand.paper50,
    foreground: brand.carbon900,
    surface: brand.chalk0,
    surfaceSunken: '#EBE7DF',
    muted: '#E7E3DC',
    mutedForeground: '#535861',
    border: '#DDD8CF',
    borderStrong: '#C8C5BF',
    primary: brand.red600,
    primaryHover: brand.red700,
    primaryForeground: brand.chalk0,
    link: brand.red700,
    ring: brand.red700,
    success: '#2F9E62',
    successForeground: '#1F6B43',
    successSoft: '#E3F2EA',
    warning: '#D97706',
    warningForeground: '#A84A06',
    warningSoft: '#FCEFD9',
    error: '#D9363E',
    errorForeground: '#B4232B',
    errorSoft: '#FBE4E5',
    info: '#2563EB',
    infoSoft: '#E3ECFC',
  },
  dark: {
    background: brand.ink950,
    foreground: brand.paper50,
    surface: brand.carbon900,
    surfaceSunken: brand.ink950,
    muted: brand.graphite800,
    mutedForeground: brand.mist400,
    border: brand.steel700,
    borderStrong: '#3A404A',
    primary: brand.red500,
    primaryHover: '#FF4056',
    primaryForeground: brand.ink950,
    link: '#FF5A6C',
    ring: brand.red500,
    success: '#2F9E62',
    successForeground: '#6FD3A0',
    successSoft: '#12291D',
    warning: '#D97706',
    warningForeground: '#F5B556',
    warningSoft: '#2E2008',
    error: '#D9363E',
    errorForeground: '#FF8A90',
    errorSoft: '#341316',
    info: '#3B82F6',
    infoSoft: '#13223F',
  },
} as const;

/** The panel's dark sidebar. */
export const sidebar = {
  background: brand.carbon900,
  foreground: brand.paper50,
  mutedForeground: brand.mist400,
  border: brand.steel700,
  hover: brand.graphite800,
  accent: brand.red500,
} as const;

/**
 * Charts (F1). Fixed order, never cycled: a 9th category folds into "Outros".
 * Validated for color-vision deficiency on adjacent pairs in both modes; the
 * first three also pass all-pairs (scatter, maps). Amber, aqua and magenta sit
 * below 3:1 on white, so charts always carry direct labels or a table view.
 */
export const chart = {
  light: ['#E21D2F', '#2A78D6', '#1BAF7A', '#EB6834', '#6250D6', '#008300', '#EDA100', '#E87BA4'],
  dark: ['#EF233C', '#3987E5', '#199E70', '#D95926', '#9085E9', '#2F9E62', '#C98500', '#D55181'],
  /** "Não sabe / Não respondeu / Outros": never a categorical slot. */
  other: { light: '#8B909A', dark: '#6B717B' },
  /** Magnitude (maps, heatmaps): one hue, light to dark. */
  sequential: ['#CDE2FB', '#9EC5F4', '#6DA7EC', '#3987E5', '#256ABF', '#184F95', '#0D366B'],
  /** Polarity (approval x disapproval): blue and red arms, gray midpoint. */
  diverging: {
    negative: ['#C9182B', '#E8737D', '#F4B6BB'],
    neutral: '#E7E3DC',
    positive: ['#B7D3F6', '#5598E7', '#1C5CAB'],
  },
} as const;

export const typography = {
  family: {
    sans: "'Manrope Variable', 'Manrope', ui-sans-serif, system-ui, sans-serif",
    serif: "'Newsreader Variable', 'Newsreader', ui-serif, Georgia, serif",
    mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  },
  /** rem sizes and line heights for the app UI (denser than the marketing site). */
  scale: {
    xs: { size: '0.75rem', lineHeight: '1.1rem' },
    sm: { size: '0.875rem', lineHeight: '1.35rem' },
    base: { size: '1rem', lineHeight: '1.6rem' },
    lg: { size: '1.125rem', lineHeight: '1.65rem' },
    xl: { size: '1.375rem', lineHeight: '1.8rem' },
    '2xl': { size: '1.75rem', lineHeight: '2.1rem' },
    '3xl': { size: '2.25rem', lineHeight: '2.5rem' },
    display: { size: '3.25rem', lineHeight: '3.3rem' },
  },
} as const;

export const radius = { xs: '4px', sm: '8px', md: '12px', lg: '20px', pill: '999px' } as const;

/** Minimum touch target (field tablets). */
export const touchTarget = '44px';
