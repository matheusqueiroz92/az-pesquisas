import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Spec 012, CA-01: components use the design tokens only. Tailwind's default
// palette is removed from the theme, so a class like `text-slate-500` would
// silently render nothing; this test catches it before review.
const DEFAULT_PALETTE =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const HEX = /#[0-9a-fA-F]{6}\b/g;

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });

// fileURLToPath, not URL.pathname: the latter breaks on Windows (/C:/...).
const files = sources(fileURLToPath(new URL('.', import.meta.url)));

describe('design tokens only (spec 012)', () => {
  it('finds the components to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('%s uses no default Tailwind colors or raw hex', (file) => {
    const text = readFileSync(file, 'utf8').replaceAll(/az-red-\d{3}/g, '');
    expect(text.match(DEFAULT_PALETTE) ?? []).toEqual([]);
    expect(text.match(HEX) ?? []).toEqual([]);
  });
});
