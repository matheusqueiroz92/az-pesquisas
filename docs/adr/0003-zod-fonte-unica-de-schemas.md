# ADR-0003 — Zod como fonte única de schemas

- Status: aceita (biblioteca de validação alterada pelo [ADR-0012](./0012-validacao-zod-sem-nestjs-zod.md))
- Data: 2026-11-03

## Contexto

O mesmo dado (questionário, entrevista, protocolo de sincronização) é validado no app offline, no painel e na API. Tipos duplicados divergem com o tempo e quebram a sincronização de forma silenciosa.

## Decisão

- Schemas em Zod no pacote `packages/contracts`, consumido pelas três aplicações.
- A API valida com `nestjs-zod` e gera o OpenAPI a partir dos mesmos schemas.
- `class-validator` e `class-transformer` não são usados.

## Consequências

- Mudança de contrato aparece como erro de tipo em todos os consumidores.
- Contratos trocados com o app levam `schemaVersion`; mudança que quebra exemplo antigo exige nova versão.
