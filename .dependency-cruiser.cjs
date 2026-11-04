// Architecture rules enforced in CI (Fundação Técnica › Arquitetura; AGENTS.md rules 3, 4, 8).
// A forbidden import fails `pnpm depcruise` and therefore the build.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies hide design problems and break module boundaries.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-and-application-are-framework-free',
      severity: 'error',
      comment:
        'domain/ and application/ must not know NestJS, Fastify, Drizzle, BullMQ or the database driver (AGENTS.md rule 3).',
      from: { path: '^apps/api/src/modules/[^/]+/(domain|application)/' },
      to: {
        path: '(^|/)node_modules/(@nestjs|fastify|@fastify|drizzle-orm|drizzle-kit|bullmq|ioredis|pg|postgres)(/|$)',
      },
    },
    {
      name: 'domain-depends-on-nothing-outer',
      severity: 'error',
      comment:
        'The domain layer is the center: it never imports application, infrastructure or presentation.',
      from: { path: '^apps/api/src/modules/[^/]+/domain/' },
      to: { path: '^apps/api/src/modules/[^/]+/(application|infrastructure|presentation)/' },
    },
    {
      name: 'application-depends-only-inward',
      severity: 'error',
      comment: 'Use cases depend on the domain and on ports, never on adapters.',
      from: { path: '^apps/api/src/modules/[^/]+/application/' },
      to: { path: '^apps/api/src/modules/[^/]+/(infrastructure|presentation)/' },
    },
    {
      name: 'no-reaching-into-other-modules',
      severity: 'error',
      comment:
        'A bounded context only talks to another through its public entry point (index.ts) or events (AGENTS.md rule 4).',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/[^/]+/',
        pathNot: ['^apps/api/src/modules/$1/', '^apps/api/src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'shared-packages-never-import-apps',
      severity: 'error',
      comment: 'packages/* are consumed by the apps, never the other way around.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'core-is-pure',
      severity: 'error',
      comment:
        'packages/core runs on the phone, in the browser and on the server: no Node built-ins and no runtime libraries except zod.',
      from: { path: '^packages/core/src/', pathNot: '\\.test\\.ts$' },
      to: {
        dependencyTypesNot: ['local', 'type-only'],
        pathNot: '(^|/)node_modules/zod(/|$)',
      },
    },
    {
      name: 'production-code-does-not-import-tests',
      severity: 'error',
      from: { pathNot: '(\\.test\\.ts|\\.spec\\.ts|/__tests__/|/test/)' },
      to: { path: '(\\.test\\.ts|\\.spec\\.ts|/__tests__/)' },
    },
    {
      name: 'web-browser-code-never-imports-server-code',
      severity: 'error',
      comment:
        'apps/web/src/server holds what only runs on the panel server (tokens, cookies, API calls). Components and lib also run in the browser (spec 007).',
      from: { path: '^apps/web/src/(components|lib|i18n)/' },
      to: { path: '^apps/web/src/server/' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['(^|/)(dist|build|coverage|\\.turbo|\\.next|\\.expo)/', 'next-env\\.d\\.ts$'],
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    // Resolves NodeNext-style imports ('./result.js' -> result.ts) the same way tsc does.
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
