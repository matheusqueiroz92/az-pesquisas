# Tasks 004 — Banco de dados e multiempresa

- [x] T1 — Bootstrap SQL (`infra/db`), Docker Compose local, scripts `db:up`/`db:down` · Prova: CA-01 (`pnpm db:up`)
- [x] T2 — `TenantContext` · Prova: `src/shared/tenancy/tenant-context.test.ts`
- [x] T3 — Schemas Drizzle, migração gerada + migração SQL de RLS, comando `db:migrate` · Prova: `test/support/test-database.ts` cria banco e migra
- [x] T4 — `Database.withTenantTransaction` e outbox · Prova: `test/tenancy.db.test.ts` (CA-02 a CA-06)
- [x] T5 — Guarda contra tabela sem RLS · Prova: `test/rls-coverage.db.test.ts`
- [x] T6 — Config `DATABASE_URL`, readiness do banco · Prova: `app-config.test.ts` (CA-08), `test/app.db.test.ts` (CA-07)
