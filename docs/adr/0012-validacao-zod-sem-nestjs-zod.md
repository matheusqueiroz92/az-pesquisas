# ADR-0012 — Validação com Zod sem `nestjs-zod`

- Status: aceita
- Data: 2026-11-04
- Altera: [ADR-0003](./0003-zod-fonte-unica-de-schemas.md) (só a parte da biblioteca)

## Contexto

O ADR-0003 previa validar as entradas da API com `nestjs-zod`. Na versão 5.5 essa biblioteca aceita só `@nestjs/common` 10 e 11; a API usa NestJS 12 (spec 003). Zod 4 já gera JSON Schema nativamente (`z.toJSONSchema`).

## Decisão

- Um `ZodValidationPipe` próprio na API (poucas linhas): recebe um schema de `packages/contracts`, valida, e em caso de falha responde 400 em Problem Details com `code: "VALIDATION_FAILED"` e a lista de campos inválidos, sem ecoar os valores enviados.
- OpenAPI montado a partir dos mesmos schemas com `z.toJSONSchema`.
- Continua valendo o restante do ADR-0003: Zod é a fonte única de schemas, sem `class-validator`.

## Consequências

- Uma dependência a menos presa à versão do NestJS.
- O pipe e a geração do OpenAPI são código nosso e precisam de testes (entram na spec 005).
- Se o `nestjs-zod` passar a suportar NestJS 12, a troca é possível, mas não necessária.
