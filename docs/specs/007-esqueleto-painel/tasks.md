# Tasks 007 — Esqueleto do painel web

- [x] T1 — App Next.js 16 + Tailwind 4 no monorepo (lint, tipos, testes) · Prova: `pnpm --filter @az-pesquisas/web build`
- [x] T2 — Coordenador de renovação, cookies, origem e caminhos do proxy · Prova: testes unitários em `src/server/*.test.ts`
- [x] T3 — `proxy.ts` (CSP com nonce, renovação, redirecionamentos) e rotas `/api/auth/*` e `/api/v1/*` · Prova: e2e CA-01, CA-03, CA-04, CA-09
- [x] T4 — Componentes de interface, layout e menu por permissão, textos pt-BR · Prova: e2e CA-06
- [x] T5 — Telas: login, esqueci/redefinir senha, início, usuários, minha conta · Prova: e2e CA-02, CA-05, CA-07, CA-08
- [x] T6 — Infra de e2e (banco descartável, API e painel reais) · Prova: `pnpm test:e2e`
