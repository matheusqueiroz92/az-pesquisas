# AZ Pesquisas

Sistema de pesquisas de campo da AZ Pesquisas: painel web, API e app Android/iOS que coleta entrevistas offline.

> Antes de qualquer contribuição, leia o [AGENTS.md](./AGENTS.md).

## Requisitos

- Node.js 22.12 ou superior (`.nvmrc`)
- pnpm 10.28 ou superior (`npm install -g pnpm@10`). `corepack enable` também funciona, mas no Windows exige o terminal aberto como administrador
- Docker Desktop rodando (banco local e testes de banco)

## Primeiros passos

```bash
pnpm install
pnpm db:up        # Postgres + PostGIS em Docker, porta 5433
pnpm check        # os testes de banco usam o Postgres do db:up
```

## Rodar a API localmente

```bash
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm db:migrate
pnpm --filter @az-pesquisas/core build
pnpm --filter @az-pesquisas/api dev
# http://localhost:3000/health/live
```

## Estrutura

| Pasta             | Conteúdo                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- |
| `apps/`           | `api` (NestJS), `web` (Next.js), `mobile` (Expo) — criados nas specs 003, 007 e 008 |
| `packages/core`   | Código de domínio puro compartilhado (`Result`, motor do questionário)              |
| `packages/config` | TypeScript, ESLint e Prettier compartilhados                                        |
| `docs/adr`        | Decisões de arquitetura                                                             |
| `docs/specs`      | Uma pasta por funcionalidade (spec, design, tasks)                                  |
| `docs/templates`  | Modelos de spec, design e tasks                                                     |
| `infra/`          | Docker Compose e scripts de operação                                                |

## Scripts

| Comando                        | O que faz                                               |
| ------------------------------ | ------------------------------------------------------- |
| `pnpm check`                   | Formatação, lint, tipos, regras de arquitetura e testes |
| `pnpm test`                    | Testes de todos os pacotes                              |
| `pnpm lint` / `pnpm typecheck` | Lint e checagem de tipos via Turborepo                  |
| `pnpm depcruise`               | Regras de dependência entre camadas e módulos           |
| `pnpm format`                  | Formata o repositório com Prettier                      |
