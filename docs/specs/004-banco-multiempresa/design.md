# Design 004 — Banco de dados e multiempresa

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Sim (migração e segurança). Pontos de decisão marcados abaixo.

## Usuários e privilégios

| Usuário    | Atributos                                               | Para que serve                                                             |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `postgres` | superusuário                                            | Só para o bootstrap: criar usuários, extensão PostGIS e privilégios padrão |
| `az_owner` | `LOGIN`, dono do schema `public`                        | Rodar migrações (`DATABASE_MIGRATION_URL`)                                 |
| `az_app`   | `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` | API em tempo de execução (`DATABASE_URL`)                                  |

Bootstrap em dois scripts idempotentes, em `infra/db/`:

- `01-roles.sql` (uma vez por servidor): cria `az_owner` e `az_app`.
- `02-database.sql` (uma vez por banco): `CREATE EXTENSION postgis`, transfere o schema `public` para `az_owner`, tira `CREATE` de `PUBLIC` e define `ALTER DEFAULT PRIVILEGES FOR ROLE az_owner` dando a `az_app` só `SELECT, INSERT, UPDATE, DELETE` nas tabelas futuras.

As senhas não ficam nos scripts: o `init.sh` do Compose aplica `ALTER ROLE ... PASSWORD` a partir das variáveis de ambiente.

## Política RLS (padrão de toda tabela de negócio)

```sql
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON outbox_events
  USING (organization_id = app_current_organization_id())
  WITH CHECK (organization_id = app_current_organization_id());
```

`app_current_organization_id()` é uma função SQL criada na primeira migração:

```sql
SELECT nullif(current_setting('app.organization_id', true), '')::uuid
```

Sem a variável definida, retorna `NULL`, a comparação nunca é verdadeira e nenhuma linha passa. Em `organizations` a política compara a própria coluna `id`.

O `az_owner`, como dono, não é afetado por RLS (o padrão do Postgres). Isso é intencional: migrações de dados precisam ver todas as organizações. Ele nunca é usado pela API.

## Na aplicação

```
apps/api/src/shared/
  tenancy/tenant-context.ts      # AsyncLocalStorage: runWithTenant(), currentOrganizationId()
  database/database.ts           # Pool pg + Drizzle; withTenantTransaction(fn)
  database/database.module.ts    # provê DATABASE e a checagem de readiness
  database/schema.ts             # reexporta os schema.ts de todos os contextos (para o drizzle-kit)
  outbox/schema.ts               # tabela outbox_events
  outbox/outbox.ts               # recordEvent(tx, event) dentro da transação do caso de uso
  ids.ts                         # newId(): UUID v7
apps/api/src/modules/identity/infrastructure/schema.ts   # tabela organizations
apps/api/drizzle/                # migrações geradas + migração SQL com função e políticas
apps/api/src/migrate.ts          # comando db:migrate (usa DATABASE_MIGRATION_URL)
```

`withTenantTransaction(fn)`:

1. Lê a organização do `TenantContext`; se não houver, lança `MissingTenantContextError` sem tocar no banco.
2. Abre transação, executa `select set_config('app.organization_id', $1, true)`.
3. Chama `fn(tx)`; commit ou rollback.

O valor vale só até o fim da transação (`is_local = true`), então uma conexão devolvida ao pool não carrega a organização para a próxima requisição.

## Tabelas

| Tabela          | Colunas                                                                                                   | RLS                                              |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `organizations` | `id uuid pk`, `name text`, `slug text unique`, `created_at`, `updated_at`                                 | `id = app_current_organization_id()`             |
| `outbox_events` | `id uuid pk`, `organization_id uuid fk`, `type text`, `payload jsonb`, `occurred_at`, `published_at null` | padrão; índice parcial em `published_at IS NULL` |

## Testes

- Testes de banco recebem a URL de superusuário em `TEST_DATABASE_ADMIN_URL` (padrão: o Postgres do `pnpm db:up`, porta 5433). Cada arquivo de teste cria um banco novo, roda o bootstrap e as migrações, e apaga o banco ao final.
- Se o banco não responder, o teste falha com a mensagem "rode `pnpm db:up`".

**Ponto de decisão (difere da Fundação técnica):** a Fundação previa Testcontainers. Proponho usar o Postgres do Docker Compose localmente e um _service container_ no GitHub Actions (spec 009). Mesma imagem, menos uma dependência, e funciona igual no Windows. Testcontainers só valeria se cada teste precisasse de um contêiner isolado, o que o banco-por-arquivo já resolve.

## Imagem

`postgis/postgis:17-3.5-alpine` no Compose (e, na spec 010, em homologação e produção). Os testes desta spec foram executados também em PostgreSQL 16 + PostGIS 3; nenhum recurso usado depende da versão 17.

## Riscos

- Esquecer RLS numa tabela nova. Mitigação: teste que lista todas as tabelas de `public` com coluna `organization_id` e falha se alguma não tiver RLS e política.
- `drizzle-kit generate` não gera funções. A função e as políticas ficam numa migração SQL própria; políticas de tabelas futuras também (uma migração SQL por tabela de negócio, revisada em PR).
