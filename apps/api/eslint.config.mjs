import base from '@az-pesquisas/config/eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(...base, {
  files: ['**/*.ts'],
  languageOptions: {
    parserOptions: {
      // NestJS resolves constructor dependencies from decorator metadata: a class
      // used only as a parameter type must stay a value import, not `import type`.
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
    },
  },
  rules: {
    // Nest modules are empty classes carrying a @Module decorator.
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
  },
});
