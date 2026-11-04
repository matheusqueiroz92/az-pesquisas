# Spec 003 — Esqueleto da API

- Status: concluída
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

Antes de qualquer regra de negócio, a API precisa de uma base que todos os módulos vão herdar: configuração que falha cedo, logs que não vazam dados, erros num formato único e endpoints de saúde para o deploy e o monitoramento. Fundação técnica › Convenções › API HTTP, Segurança, Ambientes.

## Regras

1. A API é uma aplicação NestJS 12 com adaptador Fastify em `apps/api` (ADR-0002).
2. A configuração vem de variáveis de ambiente validadas com Zod na inicialização. Variável inválida impede a API de subir, e a mensagem cita o **nome** da variável, nunca o valor.
3. Todo erro HTTP sai no formato Problem Details (RFC 9457), com `Content-Type: application/problem+json` e os campos `type`, `title`, `status`, `detail`, `instance`, `code` e `requestId` (ADR-0008).
4. Erro inesperado (500) nunca expõe mensagem interna, stack ou nome de classe ao cliente; o detalhe completo vai só para o log e para o Sentry.
5. Toda resposta carrega o cabeçalho `x-request-id`. Um `x-request-id` recebido é reaproveitado se for seguro (8 a 64 caracteres, letras, números e hífen); caso contrário, a API gera um novo.
6. Logs em JSON (pino) com o `requestId` de cada requisição. Cabeçalhos `authorization` e `cookie`, e campos `password`, `pin`, `token`, `refreshToken`, `answers`, `location`, `lat`, `lng` são substituídos por `[REDACTED]` (AGENTS.md, regra 10).
7. Cabeçalhos de segurança HTTP via `@fastify/helmet`. CORS desligado por padrão; liberado só para as origens listadas em `CORS_ORIGINS`.
8. Corpo de requisição limitado a 2 MB (tamanho máximo de um lote de sincronização).
9. `GET /health/live` responde 200 sempre que o processo está de pé. `GET /health/ready` executa as verificações de prontidão registradas e responde 200 se todas passarem ou 503 se alguma falhar, dizendo qual.
10. Sentry é ativado somente quando `SENTRY_DSN` estiver definido, sem enviar dados pessoais. No Sentry 11 a coleta de cabeçalhos, cookies, corpos, parâmetros de URL e dados de usuário vem **ligada** por padrão (`dataCollection`); todas essas categorias são desligadas explicitamente.

## Variáveis de ambiente

| Variável       | Obrigatória | Padrão        | Regra                                                          |
| -------------- | ----------- | ------------- | -------------------------------------------------------------- |
| `NODE_ENV`     | não         | `development` | `development`, `test` ou `production`                          |
| `APP_ENV`      | não         | `local`       | `local`, `staging` ou `production`                             |
| `APP_VERSION`  | não         | `dev`         | Texto livre (hash do commit no deploy)                         |
| `HOST`         | não         | `0.0.0.0`     | —                                                              |
| `PORT`         | não         | `3000`        | Inteiro de 1 a 65535                                           |
| `LOG_LEVEL`    | não         | `info`        | `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent` |
| `CORS_ORIGINS` | não         | vazio         | Lista de URLs separadas por vírgula                            |
| `SENTRY_DSN`   | não         | —             | URL válida                                                     |

Regra cruzada: `APP_ENV=production` exige `NODE_ENV=production`.

## Critérios de aceite

### CA-01 — Configuração válida

- **Dado** nenhuma variável definida
- **Quando** a configuração é carregada
- **Então** os valores padrão da tabela são usados

### CA-02 — Configuração inválida impede a subida

- **Dado** `PORT=abc` e `LOG_LEVEL=verbose`
- **Quando** a configuração é carregada
- **Então** a carga falha listando `PORT` e `LOG_LEVEL`, sem repetir os valores recebidos

### CA-03 — Produção exige NODE_ENV de produção

- **Dado** `APP_ENV=production` e `NODE_ENV=development`
- **Quando** a configuração é carregada
- **Então** a carga falha citando `NODE_ENV`

### CA-04 — Liveness

- **Dado** a API rodando
- **Quando** `GET /health/live`
- **Então** 200 com `{ "status": "ok", "version": <APP_VERSION> }`

### CA-05 — Readiness saudável e degradada

- **Dado** verificações de prontidão registradas
- **Quando** `GET /health/ready`
- **Então** 200 com o resultado de cada verificação se todas passarem; 503 com a verificação que falhou se alguma falhar

### CA-06 — Rota inexistente

- **Dado** a API rodando
- **Quando** `GET /nao-existe`
- **Então** 404 em `application/problem+json` com `code: "NOT_FOUND"` e o `requestId` da resposta

### CA-07 — Erro inesperado não vaza detalhes

- **Dado** uma rota que lança um erro com a mensagem `db password is hunter2`
- **Quando** a rota é chamada
- **Então** 500 com `code: "INTERNAL_ERROR"`, sem a mensagem original nem stack no corpo

### CA-08 — Request ID

- **Dado** uma requisição com `x-request-id: req-12345678`
- **Quando** a API responde
- **Então** a resposta tem `x-request-id: req-12345678`; com um valor inseguro (ex.: contendo espaços ou com 200 caracteres) ou ausente, a API gera um novo

### CA-09 — Logs sem segredos

- **Dado** uma requisição com cabeçalho `authorization: Bearer secret-token`
- **Quando** a API registra o log da requisição
- **Então** o log não contém `secret-token`

### CA-10 — Cabeçalhos de segurança

- **Dado** a API rodando
- **Quando** qualquer resposta é enviada
- **Então** ela contém `x-content-type-options: nosniff` e não contém `x-powered-by`

### CA-11 — Limite de corpo

- **Dado** um corpo JSON acima de 2 MB
- **Quando** enviado a qualquer rota
- **Então** 413 em Problem Details com `code: "PAYLOAD_TOO_LARGE"`

## Fora de escopo

- Banco, `TenantContext` e verificação de prontidão do Postgres: spec 004.
- Validação de entrada com Zod e OpenAPI: spec 005/006 (ver risco no design).
- Dockerfile e deploy: spec 010.
