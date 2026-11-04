import base from '@az-pesquisas/config/eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...base,
  {
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
