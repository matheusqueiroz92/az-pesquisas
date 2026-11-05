import { defineConfig } from 'vitest/config';

// Domain and application are framework-free and TDD: 90% coverage, like the API.
// Screens are checked by `expo export` and the manual script in the README.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/application/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/ui/sign-in-message.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/infrastructure/expo/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
