# Design NNN — <título curto>

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? sim/não (sim se mexer em contrato, migração, segurança ou ADR)

## Contextos e módulos afetados

## Modelo de domínio

Agregados, entidades, objetos de valor, invariantes, eventos de domínio.

## Casos de uso

| Caso de uso | Entrada | Saída (`Result`) | Erros de domínio |
| ----------- | ------- | ---------------- | ---------------- |

## Contratos (`packages/contracts`)

Schemas novos ou alterados, com `schemaVersion` quando trafegam até o app.

## API

| Método | Rota | Permissão | Resposta |
| ------ | ---- | --------- | -------- |

## Banco de dados

Tabelas, colunas, índices, políticas RLS, migração (expandir → contrair se for destrutiva).

## Segurança

Permissões, dados sensíveis, logs, rate limit.

## Riscos e alternativas descartadas
