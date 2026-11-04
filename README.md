# AZ Pesquisas

Sistema de pesquisas de campo da AZ Pesquisas: painel web, API e app Android/iOS que coleta entrevistas offline.

> Antes de qualquer contribuição, leia o [AGENTS.md](./AGENTS.md).

## Requisitos

- Node.js 22.12 ou superior (`.nvmrc`)
- pnpm 10.28 ou superior (`corepack enable` instala a versão fixada em `package.json`)
- Docker (a partir da spec 004, para o banco local)

## Primeiros passos

```bash
corepack enable
pnpm install
pnpm check
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
