# ADR-0004 — PostgreSQL + PostGIS com Drizzle ORM

- Status: aceita
- Data: 2026-11-03

## Contexto

Os dados são relacionais (pesquisa → versão → pergunta → resposta), os relatórios dependem de agregações e cruzamentos em SQL, e as entrevistas têm localização. MongoDB foi descartado: os dados não têm forma livre e dois bancos dobrariam operação e backup.

## Decisão

- PostgreSQL com a extensão PostGIS.
- Drizzle ORM na API e no app (sobre o SQLite local).
- Migrações versionadas geradas pelo `drizzle-kit`, revisadas em PR. `drizzle-kit push` só no ambiente local.

## Consequências

- Consultas de resultado ficam em SQL explícito e indexado.
- Partes flexíveis (configuração de pergunta, snapshot da versão) usam `jsonb`.
- Migração aplicada em homologação nunca é editada (AGENTS.md, regra 11).
