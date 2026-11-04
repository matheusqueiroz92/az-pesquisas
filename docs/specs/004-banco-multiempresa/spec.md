# Spec 004 — Banco de dados e multiempresa

- Status: concluída
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

Todo dado do sistema pertence a uma organização (instituto de pesquisa). O isolamento precisa existir desde a primeira tabela, em duas barreiras independentes: a aplicação filtra pela organização da credencial e o próprio Postgres recusa linhas de outra organização (Row Level Security). Fundação técnica › Multiempresa; ADR-0004 e ADR-0005.

## Regras

1. PostgreSQL com PostGIS. Local: Docker Compose. Produção e homologação: spec 010.
2. Dois usuários de banco:
   - `az_owner`: dono das tabelas, usado **só** para rodar migrações.
   - `az_app`: usado pela API em tempo de execução, sem ser dono de nada e sem permissão de ignorar RLS.
3. Migrações geradas pelo drizzle-kit a partir dos `schema.ts` de cada contexto, versionadas em `apps/api/drizzle/` e aplicadas por um comando próprio (`db:migrate`) com o usuário `az_owner`.
4. Toda tabela de negócio tem `organization_id`, RLS habilitado e política que só deixa ver e gravar linhas cuja `organization_id` seja a da sessão.
5. A organização da sessão é definida por transação com `set_config('app.organization_id', $1, true)` (equivalente a `SET LOCAL`, com parâmetro, sem concatenar SQL). Fora de uma transação de organização, consultas em tabelas de negócio não retornam nada e escritas são recusadas.
6. Na aplicação, a organização corrente vive num `TenantContext` (AsyncLocalStorage). Abrir uma transação de negócio sem organização no contexto é um erro de programação e lança exceção.
7. IDs gerados pela aplicação em UUID v7 (ADR-0006).
8. Tabelas desta spec: `organizations` (contexto `identity`) e `outbox_events` (infraestrutura compartilhada, eventos gravados na mesma transação do caso de uso).
9. `GET /health/ready` passa a verificar o banco.
10. A API recebe `DATABASE_URL` (obrigatória) e `DATABASE_POOL_MAX` (padrão 10). O comando de migração recebe `DATABASE_MIGRATION_URL`.

## Critérios de aceite

### CA-01 — Banco local em um comando

- **Dado** o Docker rodando
- **Quando** `pnpm db:up` e depois `pnpm db:migrate`
- **Então** existe um banco com PostGIS, os usuários `az_owner` e `az_app` e as tabelas desta spec

### CA-02 — Isolamento de leitura

- **Dado** as organizações A e B, cada uma com eventos no outbox
- **Quando** a API consulta `outbox_events` dentro da transação da organização A
- **Então** só vê os eventos de A

### CA-03 — Isolamento de escrita

- **Dado** uma transação da organização A
- **Quando** tenta inserir uma linha com `organization_id` de B, ou alterar uma linha de B
- **Então** o banco recusa a inserção e a alteração não afeta nenhuma linha

### CA-04 — Sem organização, nada

- **Dado** uma conexão do usuário `az_app` sem `app.organization_id` definido
- **Quando** consulta `outbox_events` ou `organizations`
- **Então** recebe zero linhas, mesmo existindo dados

### CA-05 — Usuário da aplicação não ignora as barreiras

- **Dado** o usuário `az_app`
- **Quando** tenta desligar RLS, apagar uma tabela ou criar uma tabela
- **Então** o banco recusa

### CA-06 — Contexto obrigatório na aplicação

- **Dado** código que abre uma transação de negócio sem `TenantContext`
- **Quando** executa
- **Então** recebe um erro `MissingTenantContextError`, antes de qualquer consulta

### CA-07 — Readiness com banco

- **Dado** a API rodando
- **Quando** `GET /health/ready`
- **Então** responde `database: up` com o banco acessível e 503 com `database: down` caso contrário

### CA-08 — Configuração do banco obrigatória

- **Dado** a API sem `DATABASE_URL`
- **Quando** a configuração é carregada
- **Então** a carga falha citando `DATABASE_URL`, sem exibir a URL

## Fora de escopo

- Publicador do outbox (leitura entre organizações e envio ao BullMQ): entra com a primeira funcionalidade que precisar de fila.
- Demais tabelas de identidade (usuários, sessões): spec 005.
- Banco de homologação e produção, backup: spec 010.
