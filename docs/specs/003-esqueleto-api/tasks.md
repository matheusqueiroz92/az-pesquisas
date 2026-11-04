# Tasks 003 — Esqueleto da API

- [x] T1 — Pacote `apps/api` (package.json, tsconfig, ESLint com decorators, Vitest com SWC) · Prova: `pnpm --filter @az-pesquisas/api typecheck`
- [x] T2 — Configuração com Zod · Prova: `src/shared/config/app-config.test.ts` (CA-01, CA-02, CA-03; 11 testes)
- [x] T3 — Request id e Problem Details (funções puras) · Prova: `request-id.test.ts`, `problem-details.test.ts`
- [x] T4 — Readiness (agregação) · Prova: `src/health/readiness.test.ts`
- [x] T5 — App: módulo, filtro, logger, helmet, CORS, limite de corpo, health · Prova: `test/app.int.test.ts` (CA-04 a CA-11 e casos extras do filtro; 15 testes) e `src/shared/logging/logger.test.ts` (redação)
- [x] T6 — `main.ts`, `instrument.ts` (Sentry), scripts de dev/build/start, `.env.example` · Prova: `pnpm --filter @az-pesquisas/api build && node dist/main.js` responde em `/health/live`; com `PORT=abc` sai com código 1 sem exibir o valor
