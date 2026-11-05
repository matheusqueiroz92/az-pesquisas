import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast.js';
import { azSymbol } from './symbol.js';
import { brand, chart, radius, semantic, sidebar, typography } from './tokens.js';

const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');

const cssVar = (name: string): string | undefined =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

/** Prettier writes hex in lowercase; tokens.ts keeps uppercase. */
const expectColor = (name: string, value: string): void => {
  expect(cssVar(name)?.toLowerCase(), name).toBe(value.toLowerCase());
};

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('theme.css mirrors tokens.ts (spec 012, rule 1)', () => {
  it.each(Object.entries(semantic.light))('semantic %s', (key, value) => {
    expectColor(`color-${kebab(key)}`, value);
  });

  it.each(Object.entries(sidebar))('sidebar %s', (key, value) => {
    const name = key === 'background' ? 'color-sidebar' : `color-sidebar-${kebab(key)}`;
    expectColor(name, value);
  });

  it('brand primitives', () => {
    for (const [key, value] of Object.entries(brand)) {
      if (key === 'chalk0') continue;
      const name = `color-az-${kebab(key).replace(/(\d+)$/, '-$1')}`;
      expectColor(name, value);
    }
  });

  it('chart palette, in order', () => {
    chart.light.forEach((value, i) => {
      expectColor(`color-chart-${i + 1}`, value);
    });
    expectColor('color-chart-other', chart.other.light);
  });

  it('fonts, type scale and radii', () => {
    expect(cssVar('font-sans')).toBe(typography.family.sans);
    expect(cssVar('font-serif')).toBe(typography.family.serif);
    expect(cssVar('font-mono')).toBe(typography.family.mono);
    for (const [step, { size, lineHeight }] of Object.entries(typography.scale)) {
      expect(cssVar(`text-${step}`), step).toBe(size);
      expect(cssVar(`text-${step}--line-height`), step).toBe(lineHeight);
    }
    for (const [name, value] of Object.entries(radius)) {
      expect(cssVar(`radius-${name}`)).toBe(value);
    }
  });

  it("removes Tailwind's default palette", () => {
    expect(css).toContain('--color-*: initial;');
  });
});

describe('text contrast (WCAG AA, rule 4)', () => {
  const light = semantic.light;
  const AA = 4.5;

  it.each([
    ['foreground on background', light.foreground, light.background],
    ['foreground on surface', light.foreground, light.surface],
    ['muted text on surface', light.mutedForeground, light.surface],
    ['muted text on background', light.mutedForeground, light.background],
    ['primary button text', light.primaryForeground, light.primary],
    ['primary button hover', light.primaryForeground, light.primaryHover],
    ['link on surface', light.link, light.surface],
    ['link on background', light.link, light.background],
    ['success text on its soft background', light.successForeground, light.successSoft],
    ['warning text on its soft background', light.warningForeground, light.warningSoft],
    ['error text on its soft background', light.errorForeground, light.errorSoft],
    ['error text on surface', light.errorForeground, light.surface],
    ['sidebar text', sidebar.foreground, sidebar.background],
    ['sidebar muted text', sidebar.mutedForeground, sidebar.background],
    ['sidebar muted text on hover', sidebar.mutedForeground, sidebar.hover],
    ['dark mode text', semantic.dark.foreground, semantic.dark.surface],
    ['dark mode muted text', semantic.dark.mutedForeground, semantic.dark.surface],
    [
      'dark success text on its soft background',
      semantic.dark.successForeground,
      semantic.dark.successSoft,
    ],
    [
      'dark warning text on its soft background',
      semantic.dark.warningForeground,
      semantic.dark.warningSoft,
    ],
    [
      'dark error text on its soft background',
      semantic.dark.errorForeground,
      semantic.dark.errorSoft,
    ],
    ['dark link on surface', semantic.dark.link, semantic.dark.surface],
  ])('%s', (_name, text, background) => {
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(AA);
  });

  it('the sidebar accent (red) is visible on the sidebar (non-text, 3:1)', () => {
    expect(contrastRatio(sidebar.accent, sidebar.background)).toBeGreaterThanOrEqual(3);
  });

  it('focus ring is visible on both light backgrounds (3:1)', () => {
    expect(contrastRatio(light.ring, light.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(light.ring, light.background)).toBeGreaterThanOrEqual(3);
  });
});

describe('chart palette', () => {
  it('has 8 slots in each mode and distinct colors', () => {
    expect(chart.light).toHaveLength(8);
    expect(chart.dark).toHaveLength(8);
    expect(new Set(chart.light).size).toBe(8);
  });

  it('keeps the "other" gray out of the categorical slots', () => {
    expect(chart.light).not.toContain(chart.other.light);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('refuses malformed colors', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow('#RRGGBB');
  });
});

describe('azSymbol', () => {
  it('matches assets/az-symbol.svg', () => {
    const svg = readFileSync(new URL('../assets/az-symbol.svg', import.meta.url), 'utf8');
    expect(svg).toContain(`viewBox="${azSymbol.viewBox}"`);
    expect(svg).toContain(`d="${azSymbol.path}"`);
    expect(azSymbol.ratio).toBeGreaterThan(1.5);
  });
});
