# ADR-0008 — Erros de negócio como valores; Problem Details na API

- Status: aceita
- Data: 2026-11-03

## Contexto

Regras de negócio que falham ("pesquisa já tem entrevistas", "aparelho revogado") são esperadas, não excepcionais. Tratá-las com exceções espalha try/catch e esconde caminhos nos testes.

## Decisão

- Casos de uso retornam `Result<T, E>` (`@az-pesquisas/core`), com `E` sendo uma união de erros de domínio nomeados.
- Exceções ficam para falhas inesperadas (bug, banco fora do ar).
- A API converte erros para Problem Details (RFC 9457), com campo `code` estável definido em `packages/contracts`.

## Consequências

- O compilador obriga a tratar o caminho de erro.
- App e painel traduzem `code` para mensagens em português.
