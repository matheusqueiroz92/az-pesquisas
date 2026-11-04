# Spec 001 — Monorepo

- Status: concluída
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

Base de todo o projeto: um repositório com API, painel, app e pacotes compartilhados, onde as regras de qualidade e arquitetura são verificadas por ferramenta, não por memória. Fundação técnica › Estrutura do monorepo e Convenções.

## Regras

1. Um único repositório com pnpm workspaces (`apps/*`, `packages/*`) e Turborepo.
2. TypeScript estrito compartilhado (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`).
3. ESLint com informação de tipos e Prettier compartilhados em `packages/config`.
4. `any`, `eval` e `console` são erro de lint.
5. Regras de arquitetura verificadas pelo dependency-cruiser.
6. Commits no padrão Conventional Commits, com escopos fixos.
7. Pacote de exemplo `packages/core` com `Result<T, E>` (ADR-0008), cobertura mínima de 90%.

## Critérios de aceite

### CA-01 — Instalação limpa

- **Dado** um clone novo com Node 22 e pnpm 10
- **Quando** rodar `pnpm install && pnpm check`
- **Então** formatação, lint, tipos, regras de dependência e testes passam

### CA-02 — Lint barra código proibido

- **Dado** um arquivo com `any` ou `eval`
- **Quando** rodar `pnpm lint`
- **Então** o comando falha apontando a regra

### CA-03 — Arquitetura barra imports proibidos

- **Dado** um arquivo de `domain/` importando `infrastructure/`, ou um módulo importando o interior de outro, ou `packages/core` importando um built-in do Node
- **Quando** rodar `pnpm depcruise`
- **Então** o comando falha com a regra violada

### CA-04 — Commit fora do padrão é recusado

- **Dado** uma mensagem `bad message`
- **Quando** o hook `commit-msg` roda
- **Então** o commit é recusado

### CA-05 — `Result` testado

- **Dado** o pacote `@az-pesquisas/core`
- **Quando** rodar `pnpm --filter @az-pesquisas/core test:coverage`
- **Então** todos os testes passam com cobertura igual ou acima de 90%

## Fora de escopo

- Apps (`api`, `web`, `mobile`): specs 003, 007 e 008.
- CI no GitHub Actions: spec 009.
- `packages/contracts`: spec 006.
