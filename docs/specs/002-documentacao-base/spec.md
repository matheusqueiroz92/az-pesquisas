# Spec 002 — Documentação base

- Status: concluída
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

Agentes e pessoas precisam das mesmas regras escritas dentro do repositório, não só em documentos externos. Fundação técnica › Fluxo de trabalho.

## Regras

1. `AGENTS.md` na raiz com as 12 regras invioláveis, glossário, arquitetura, convenções, fluxo SDD e Definition of Done.
2. Um ADR por decisão da Fundação técnica em `docs/adr/`, com índice.
3. Modelos de `spec.md`, `design.md` e `tasks.md` em `docs/templates/`.
4. README com requisitos e comandos.

## Critérios de aceite

### CA-01 — Regras disponíveis para os agentes

- **Dado** um agente abrindo o repositório no Cursor
- **Quando** ler `AGENTS.md`
- **Então** encontra as 12 regras, o glossário e os comandos de verificação

### CA-02 — Decisões rastreáveis

- **Dado** qualquer decisão da tabela de ADRs da Fundação técnica
- **Quando** procurar em `docs/adr/`
- **Então** existe um arquivo com contexto, decisão e consequências

## Fora de escopo

- Runbooks operacionais: criados junto com a infraestrutura (spec 010).
