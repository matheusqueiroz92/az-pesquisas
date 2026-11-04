# ADR-0011 — TypeScript 6.0 e pnpm 10

- Status: aceita
- Data: 2026-11-04

## Contexto

Em novembro de 2026 a versão `latest` do TypeScript é a 7.0 (compilador reescrito). O `typescript-eslint` 8.72 só aceita TypeScript abaixo de 6.1, e a API depende de decorators do NestJS, que precisam ser validados com o compilador novo antes de adotá-lo.

## Decisão

- TypeScript fixado em `~6.0.3` em todos os pacotes.
- pnpm 10.28 fixado em `packageManager` (versão já instalada nas máquinas da equipe).

## Consequências

- Lint com informação de tipos funciona sem gambiarras.
- Migrar para TypeScript 7 exige novo ADR, depois que `typescript-eslint` e NestJS suportarem oficialmente.
