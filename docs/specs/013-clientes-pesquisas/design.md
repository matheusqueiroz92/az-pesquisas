# Design 013 — Clientes e pesquisas

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Sim (migração e contrato novos).

## Contexto `surveys`

Clientes e pesquisas ficam no mesmo contexto (`apps/api/src/modules/surveys`): o cliente só existe para dar dono às pesquisas, e a regra "cliente em uso não é excluído" precisa ler as duas tabelas. O questionário (014) entra neste mesmo contexto.

```
domain/
  client.ts          # agregado Client (normaliza nome, documento, contato)
  survey.ts          # agregado Survey (campos, regra do TSE, situação, duplicar)
  repositories.ts    # portas ClientRepository e SurveyRepository
application/
  ports.ts           # Clock, IdGenerator, TransactionRunner, AuditLog (ações deste contexto)
  surveys-deps.ts
  clients.ts         # listClients, getClient, createClient, updateClient, deleteClient
  surveys.ts         # listSurveys, getSurvey, createSurvey, updateSurvey, archive/unarchive,
                     # duplicateSurvey, deleteSurvey
  views.ts
infrastructure/
  schema.ts          # clients, surveys
  drizzle-repositories.ts
  surveys-deps.factory.ts
presentation/
  clients.controller.ts, surveys.controller.ts, http-errors.ts, surveys.module.ts
```

Os casos de uso seguem o padrão da 005: checam `can(actor.role, 'surveys.manage')`, entram em `runWithTenant(actor.organizationId)` e numa transação, devolvem `Result`.

## Log de auditoria vira infraestrutura compartilhada

A tabela `audit_logs` e o adaptador que grava nela saem do contexto `identity` e vão para `shared/audit` (como o outbox). A tabela é a mesma, sem migração; cada contexto continua declarando no seu `ports.ts` as ações que registra. Sem isso o contexto `surveys` teria de importar a infraestrutura de `identity` (AGENTS.md, regra 4).

## Banco

```
clients
  id, organization_id, name, document (só dígitos, 11 ou 14), contact_name,
  contact_email, contact_phone, created_at, updated_at
  UNIQUE (organization_id, id)          -- alvo da FK composta abaixo

surveys
  id, organization_id, client_id (nulo = pesquisa própria), title, type, status,
  municipality_codes integer[], field_start date, field_end date, target_interviews,
  gps_mode, audio, min_duration_sec, consent_text,
  tse_registered, tse_registration_number, tse_statistician_name, tse_statistician_conre,
  tse_contractor_name, tse_contract_value_cents bigint, created_at, updated_at
  FK (organization_id, client_id) -> clients (organization_id, id)
```

- **FK composta.** Uma chave estrangeira comum é conferida pelo Postgres sem RLS; com `(organization_id, client_id)` o banco recusa uma pesquisa apontando para cliente de outra organização mesmo se o caso de uso falhar.
- `0004_surveys.sql` (gerada pelo drizzle-kit) cria as tabelas; `0005_surveys_security.sql` (escrita à mão) liga RLS com a política `tenant_isolation` e repete no banco as regras do domínio: valores de `type`, `status`, `gps_mode`, `audio`; `field_end >= field_start`; metas e duração nos limites; dados do TSE só com `type = 'electoral' AND tse_registered`.
- Valor contratado em **centavos** (`bigint`), nunca em ponto flutuante.

## API

| Método e rota                    | Corpo / resposta                                             |
| -------------------------------- | ------------------------------------------------------------ |
| `GET /v1/clients`                | `{ items: ClientView[] }` (com `surveyCount`)                |
| `POST /v1/clients`               | `CreateClientRequest` → `ClientView`                         |
| `GET /v1/clients/:id`            | `ClientView`                                                 |
| `PATCH /v1/clients/:id`          | `UpdateClientRequest` → `ClientView`                         |
| `DELETE /v1/clients/:id`         | 204; `CLIENT_IN_USE` (409)                                   |
| `GET /v1/surveys`                | `{ items: SurveySummary[] }` (todas, mais recentes primeiro) |
| `POST /v1/surveys`               | `CreateSurveyRequest` → `SurveyView`                         |
| `GET /v1/surveys/:id`            | `SurveyView`                                                 |
| `PATCH /v1/surveys/:id`          | `UpdateSurveyRequest` → `SurveyView`                         |
| `DELETE /v1/surveys/:id`         | 204                                                          |
| `POST /v1/surveys/:id/archive`   | `SurveyView`                                                 |
| `POST /v1/surveys/:id/unarchive` | `SurveyView`                                                 |
| `POST /v1/surveys/:id/duplicate` | `SurveyView` da cópia (201)                                  |

Todas com `@RequirePermission('surveys.manage')`. Filtro de arquivadas e busca por título ficam no painel: uma organização tem dezenas de pesquisas por ano, a lista inteira é pequena.

Erros novos: `CLIENT_NOT_FOUND` (404, também quando o `clientId` do corpo não é da organização), `CLIENT_IN_USE` (409), `SURVEY_NOT_FOUND` (404), `SURVEY_NOT_EDITABLE` (409).

## Contratos (`packages/contracts/src/surveys.ts`)

- `TaxId`: aceita com ou sem máscara, devolve só dígitos; CPF (11) ou CNPJ (14) com dígitos verificadores.
- `SurveyTse`: `{ registrationNumber, statisticianName, statisticianConre, contractorName, contractValueCents }`, todos anuláveis. `tse: null` = não registrada; objeto = registrada no TSE. Enviar `tse` com tipo diferente de eleitoral é recusado.
- `municipalityCodes`: códigos de `BAHIA_MUNICIPALITIES` (417 municípios, `municipalities-ba.ts`, gerado a partir da tabela do IBGE), sem repetição.
- `settings`: mesmo formato de `SurveySettings` do snapshot (spec 006), com `consentText` anulável. A 015 copia esses valores para o snapshot.
- Corpos com `strictObject` (nada de `organizationId` vindo do cliente).

## Painel

- Menu ganha **Pesquisas** e **Clientes** (permissão `surveys.manage`).
- `/clientes`: tabela com nome, documento formatado, contato e número de pesquisas; criar/editar em diálogo; excluir com confirmação.
- `/pesquisas`: tabela com busca por título e filtro "Arquivadas" (parâmetros de URL); ações duplicar e arquivar.
- `/pesquisas/nova` e `/pesquisas/[id]`: formulário em seções (Identificação, Campo, Municípios, Coleta no app, TSE). O seletor de municípios tem busca e mostra os escolhidos como etiquetas. A seção TSE só aparece no tipo eleitoral. Na página da pesquisa, arquivar/desarquivar e excluir (só rascunho).
