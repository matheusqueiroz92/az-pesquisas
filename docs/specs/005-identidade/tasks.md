# Tasks 005 — Identidade e acesso

- [x] T1 — Pacote `packages/contracts`: permissões, códigos de erro, schemas de auth e usuários · Prova: `packages/contracts/src/*.test.ts`
- [x] T2 — Domínio: `Email`, `User`, `Session`, `PasswordReset` · Prova: testes do domínio (cobertura ≥ 90%)
- [x] T3 — Casos de uso com fakes em memória · Prova: testes de `application` (cobertura ≥ 90%)
- [x] T4 — Banco: tabelas, RLS, auditoria só-inserção, funções `SECURITY DEFINER` · Prova: `test/identity-db.db.test.ts` (CA-10)
- [x] T5 — Infraestrutura: repositórios, Argon2, JWT, gerador de token, mailer, lookup · Prova: testes de integração
- [x] T6 — Validação Zod (ADR-0012), guard, interceptor de organização, controllers, rate limit · Prova: `test/auth.db.test.ts`, `test/users.db.test.ts` (CA-01 a CA-09)
- [x] T7 — Comando `seed:admin` · Prova: execução contra banco local
