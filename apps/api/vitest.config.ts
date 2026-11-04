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
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/instrument.ts', 'src/migrate.ts'],
    },
  },
});
