import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/server/**/*.ts', 'src/i18n/**/*.ts', 'src/lib/**/*.ts'],
      // api-client.ts needs a live Next.js request (cookies(), redirect()): covered by the e2e suite.
      exclude: ['src/**/*.test.ts', 'src/server/api-client.ts'],
      // The session code (BFF) guards every request: same bar as the domain.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
