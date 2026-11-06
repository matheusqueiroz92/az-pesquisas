# Spec 009 — Integração contínua (GitHub Actions)

- Status: implementada (aguardando revisão)
- Fase: F0
- Aprovada por: Matheus (2026-11-05)

## Contexto

Hoje a garantia de que um PR não quebra nada é Claude rodar tudo num clone limpo e Matheus repetir no Windows. A CI faz isso sozinha a cada PR e a cada merge na `main`, no mesmo ambiente sempre, e o GitHub passa a bloquear o merge de PR vermelho.

## Regras

1. Roda em todo PR para `main` e em todo push na `main`. Um novo push no mesmo PR cancela a execução anterior.
2. Quatro verificações independentes, cada uma com nome estável (usado na proteção da branch):
   - **check**: `pnpm check` completo (formatação, lint, tipos, dependency-cruiser, testes com cobertura), com Postgres + PostGIS de verdade.
   - **e2e**: build e testes de ponta a ponta do painel (API, painel e banco reais, Chromium).
   - **mobile-bundle**: o bundle Android do app monta (`expo export`).
   - **commits**: mensagens no padrão Conventional Commits (commitlint), só em PR.
3. Instalação sempre com `--frozen-lockfile`: lockfile desatualizado reprova.
4. Mesmas versões do desenvolvimento: Node 22, pnpm do `packageManager`, `postgis/postgis:17-3.5-alpine`.
5. Falha no e2e anexa o relatório do Playwright (com rastro) ao run, por 7 dias.
6. Sem segredos: só valores de teste. Permissões mínimas (`contents: read`).
7. Ações do GitHub fixadas por versão maior, com pelo menos duas semanas de publicação.

## Critérios de aceite

- CA-01: um PR com tudo certo mostra as quatro verificações verdes.
- CA-02: um PR com teste quebrado, erro de lint ou mensagem de commit fora do padrão fica vermelho na verificação correspondente.
- CA-03: com a proteção da branch ligada (passo manual de Matheus, README), o botão de merge fica bloqueado enquanto houver verificação vermelha.

## Fora de escopo

- Build nativo do app (APK/IPA): spec 011 (EAS).
- Deploy: spec 010.
- Cache remoto do Turborepo.
