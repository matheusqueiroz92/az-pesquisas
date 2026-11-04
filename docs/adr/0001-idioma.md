# ADR-0001 — Idioma do código e da documentação

- Status: aceita
- Data: 2026-11-03

## Contexto

A equipe é brasileira e os usuários finais leem português. Bibliotecas, mensagens de erro de ferramentas e agentes de IA trabalham melhor com identificadores em inglês, e misturar idiomas no código gera nomes inconsistentes (`getPesquisa`, `surveyResposta`).

## Decisão

- Código, nomes de arquivos, tabelas, colunas, rotas, commits e comentários em **inglês**.
- Interface, mensagens ao usuário, specs, ADRs e runbooks em **português (pt-BR)**.
- O glossário do `AGENTS.md` define o nome em inglês de cada conceito de negócio e é obrigatório.

## Consequências

- Textos de interface ficam em arquivos de tradução, nunca soltos no código.
- Códigos de erro da API são estáveis em inglês (`SURVEY_HAS_INTERVIEWS`) e traduzidos no painel e no app.
