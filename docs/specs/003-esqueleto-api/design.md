# Design 003 — Esqueleto da API

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Não (sem contrato com o app, sem migração, sem mudança de ADR). Um risco abaixo pede decisão antes da spec 005.

## Estrutura

```
apps/api/
  src/
    main.ts                     # sobe o servidor e trata desligamento
    instrument.ts               # Sentry, carregado com node --import antes do app
    app.factory.ts              # createApp(config, options): usado pelo main e pelos testes
    app.module.ts               # AppModule.forRoot(config)
    health/
      health.controller.ts      # /health/live e /health/ready
      health.module.ts
      readiness.ts              # porta ReadinessCheck + agregação (puro)
    shared/
      config/
        app-config.ts           # schema Zod + loadConfig()
      http/
        problem-details.ts      # tipo + mapeamento status -> code (puro)
        problem-details.filter.ts
        request-id.ts           # geração e validação do request id (puro)
      logging/
        logger.ts               # pino com redação + adaptador LoggerService do Nest
  test/
    app.int.test.ts             # testes de integração via fastify.inject
```

`health/` e `shared/` não são contextos de negócio; ficam fora de `modules/`, então as regras de camada do dependency-cruiser não se aplicam a eles.

## Decisões

- **Logger:** o próprio logger do Fastify (pino) via `loggerInstance`, e um adaptador de `LoggerService` para o Nest. Evita o `nestjs-pino`, que depende de middleware Express-like (middie) e duplicaria a geração de request id.
- **Request id:** `genReqId` do Fastify lê `x-request-id`, reaproveita se casar com `^[A-Za-z0-9-]{8,64}$`, senão gera UUID v4 (request id não é chave de banco). Um hook `onSend` devolve o cabeçalho.
- **Erros:** um único `ExceptionFilter` global. `HttpException` vira Problem Details com `code` derivado do status; uma `HttpException` cujo corpo traga `{ code, detail }` usa esses valores (os erros de domínio da spec 005 vão por esse caminho). Erros do Fastify com `statusCode` (ex.: 413) são respeitados. Qualquer outra coisa vira 500 genérico, registrado no log e no Sentry.
- **`type`:** `urn:az-pesquisas:error:<code>`; `title` é a frase padrão do status HTTP.
- **Testes:** Vitest com `unplugin-swc`, porque o NestJS depende de `emitDecoratorMetadata`, que o transformador padrão do Vitest não emite.
- **Build:** `tsc` puro (ESM, NodeNext); sem `@nestjs/cli`. Desenvolvimento com `tsc --watch` e `node --watch` em paralelo.

## Segurança

- Redação do pino cobre cabeçalhos e campos sensíveis em qualquer nível do objeto logado (caminhos com curinga).
- `trustProxy: true` porque a API fica atrás do Traefik (IP real em `x-forwarded-for`).
- Mensagem de erro de configuração nunca ecoa valores (um `SENTRY_DSN` mal formatado ainda é segredo).

## Riscos

- **`nestjs-zod` não suporta NestJS 12** (peer `@nestjs/common ^10 || ^11`). O ADR-0003 cita essa biblioteca. Antes da spec 005, decidir entre: (a) um `ZodValidationPipe` próprio de poucas linhas + geração de OpenAPI com `zod` 4 nativo (`z.toJSONSchema`), ou (b) aguardar suporte oficial. Decidido em 2026-11-04: opção (a), registrada no [ADR-0012](../../adr/0012-validacao-zod-sem-nestjs-zod.md).
- TypeScript 6.0 ainda aceita `experimentalDecorators`; o TypeScript 7 precisa ser validado com NestJS antes de migrar (ADR-0011).
