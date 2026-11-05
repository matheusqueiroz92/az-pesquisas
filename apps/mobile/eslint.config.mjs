import base from '@az-pesquisas/config/eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['android/**', 'ios/**', 'dist-export/**', 'expo-env.d.ts'] },
  ...base,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
  },
);
