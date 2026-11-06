# ADR-0014 — Rascunho do questionário como documento JSONB

- Status: aceita
- Data: 2026-11-06
- Spec: [014 — Editor de questionário](../specs/014-editor-questionario/spec.md)

## Contexto

O planejamento funcional previa tabelas `pergunta` e `opcao` (com `config JSONB`) para o questionário. Ao desenhar o editor (spec 014) ficou claro que:

- o editor trabalha com o questionário inteiro: reordenar, renomear um código que outras perguntas citam nas condições, duplicar; quase toda mudança mexe em várias linhas;
- as pendências de publicação dependem do conjunto (códigos repetidos, condições que citam perguntas anteriores), não de uma pergunta isolada;
- o que o app usa, o PDF do TSE e as respostas apontam é a **versão publicada**, um _snapshot_ JSON imutável (spec 006) com ids estáveis de perguntas e opções.

## Decisão

O rascunho de cada pesquisa é **um documento JSONB** (`questionnaire_drafts.content`), no mesmo formato das perguntas do snapshot, salvo inteiro a cada mudança com um número de **revisão** (bloqueio otimista: quem salva a partir de uma revisão velha recebe `QUESTIONNAIRE_CONFLICT`). A validação estrutural é o schema `QuestionnaireDraft` de `packages/contracts`; as pendências, `lintQuestionnaire`; a regra final, `QuestionnaireSnapshot`.

Os ids de pergunta, opção e linha ficam dentro do documento e são estáveis entre versões. Resultados (018) agregam as respostas por esses ids, lidos dos snapshots publicados.

## Consequências

- Uma escrita por salvamento, atômica; nada de reconciliar dezenas de linhas por reordenação.
- O mesmo schema valida no painel (pendências ao vivo) e na API.
- Sem consultas SQL por pergunta no rascunho; quem precisar (resultados, exportação) usa as versões publicadas.
- Documento grande: 500 perguntas cabem com folga no limite de 2 MB do corpo da requisição.
- Salvamentos automáticos não vão para o log de auditoria (seriam um registro a cada pausa de digitação); fica `updated_by`/`updated_at` no rascunho, e a publicação (015) é auditada.
