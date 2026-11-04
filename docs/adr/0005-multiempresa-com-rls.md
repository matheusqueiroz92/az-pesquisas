# ADR-0005 — Multiempresa com isolamento duplo (aplicação + RLS)

- Status: aceita
- Data: 2026-11-03

## Contexto

O sistema começa atendendo só a AZ Pesquisas, mas a intenção é vendê-lo como SaaS para outros institutos. Adicionar isolamento depois exigiria reescrever consultas e migrar dados.

## Decisão

- Banco compartilhado; `organization_id` em toda tabela de negócio.
- Barreira 1: `TenantContext` (AsyncLocalStorage) preenchido a partir da credencial; repositórios filtram por ele.
- Barreira 2: Row Level Security no Postgres. Cada transação começa com `SET LOCAL app.organization_id`; a aplicação conecta com um usuário sem permissão de ignorar RLS.
- Migrações usam outro usuário de banco, dono das tabelas.

## Consequências

- Um filtro esquecido no código não vaza dados: o banco bloqueia.
- Suite de testes obrigatória no CI tenta acesso cruzado entre duas organizações em todas as rotas.
- Cadastro de organizações, planos e cobrança ficam fora até o SaaS ser priorizado.
