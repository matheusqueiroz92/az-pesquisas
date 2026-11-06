# Tasks 013 — Clientes e pesquisas

- [x] T1 — Contratos: `TaxId`, municípios da Bahia, clientes e pesquisas, códigos de erro (testes primeiro)
- [x] T2 — Log de auditoria em `shared/audit` (sem mudar a tabela)
- [x] T3 — Domínio `Client` e `Survey` (testes primeiro)
- [x] T4 — Casos de uso com dublês em memória (testes primeiro)
- [x] T5 — Tabelas, migrações 0004/0005 com RLS e checagens, repositórios Drizzle (teste com banco)
- [x] T6 — Rotas HTTP (teste HTTP com banco: permissões e isolamento)
- [x] T7 — Painel: Clientes, Pesquisas, formulário da pesquisa, menu
- [x] T8 — Ponta a ponta no painel; AGENTS.md e README atualizados

## Alteração 1 — municípios de qualquer estado

- [x] Lista completa do IBGE em `packages/contracts` e validação por código de município
- [x] Migração 0006 (checagem do banco)
- [x] Seletor de UF no painel e teste de ponta a ponta com Montes Claros (MG)
- [x] `pnpm db:migrate` e `pnpm seed:admin` compilam os pacotes da API antes
