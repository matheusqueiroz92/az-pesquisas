import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS needs emitDecoratorMetadata, which Vitest's default transformer does not
// emit. SWC compiles the test files with legacy decorators and metadata enabled.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2023',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['reflect-metadata'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/main.ts',
        'src/instrument.ts',
        'src/migrate.ts',
        'src/seed-admin.ts',
      ],
      // Definition of Done: domain and application layers at 90% or more (AGENTS.md).
      thresholds: {
        'src/modules/**/domain/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'src/modules/**/application/**': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
      },
    },
  },
});
