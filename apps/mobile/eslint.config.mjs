import base from '@az-pesquisas/config/eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config({ ignores: ['android/**', 'ios/**', 'dist-export/**'] }, ...base, {
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  languageOptions: { globals: { ...globals.browser } },
});
