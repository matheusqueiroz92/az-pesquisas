# ADR-0007 — Datas em UTC, exibição em America/Bahia

- Status: aceita
- Data: 2026-11-03

## Contexto

O horário vem de aparelhos (que podem estar com relógio errado), do servidor e aparece em relatórios. Fusos implícitos geram erros de um dia em filtros por data.

## Decisão

- Banco: `timestamptz`. API: ISO 8601 em UTC.
- Exibição no painel, no app e nos relatórios: `America/Bahia`.
- Cada entrevista registra a diferença entre o relógio do aparelho e o do servidor.

## Consequências

- Filtros por dia convertem a data local para o intervalo UTC correspondente.
- Relógio adulterado vira sinal de qualidade, sem rejeitar a entrevista.
