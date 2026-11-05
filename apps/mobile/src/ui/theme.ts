import { radius, semantic, sidebar } from '@az-pesquisas/design-tokens';

/** App theme from packages/design-tokens (spec 012). Light: legible in daylight, like the panel. */
export const colors = { ...semantic.light, sidebar } as const;

/** Font family names as registered by useFonts in the root layout. */
export const fonts = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'IBMPlexMono_500Medium',
} as const;

const px = (value: string): number => Number.parseInt(value, 10);

export const radii = {
  sm: px(radius.sm),
  md: px(radius.md),
  pill: 999,
} as const;

/** Spec 012: minimum touch target for field tablets. */
export const TOUCH = 48;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;
