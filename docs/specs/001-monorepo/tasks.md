# Tasks 001 — Monorepo

- [x] T1 — Raiz: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.editorconfig`, `.gitattributes`, `.nvmrc` · Prova: `pnpm install`
- [x] T2 — `packages/config`: tsconfig base e de biblioteca, ESLint flat config, Prettier · Prova: `pnpm lint`, `pnpm typecheck`
- [x] T3 — `Result<T, E>` em `packages/core` com TDD · Prova: `packages/core/src/result.test.ts` (14 testes, 100% de cobertura)
- [x] T4 — Regras de arquitetura em `.dependency-cruiser.cjs` · Prova: violações injetadas detectadas (CA-03), repositório limpo sem violações
- [x] T5 — Husky + lint-staged + commitlint · Prova: `echo "bad message" | pnpm exec commitlint` falha (CA-04)
- [x] T6 — `pnpm check` agregando todas as verificações · Prova: CA-01
