# Design 014 — Editor de questionário

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- ADR: [0014 — rascunho em JSONB](../../adr/0014-rascunho-do-questionario-em-jsonb.md)
- Precisa de aprovação humana? Sim (migração, contrato e ADR novos).

## Contratos (`packages/contracts/src/questionnaire-draft.ts`)

- `QuestionnaireDraft`: `{ introText, questions }`. Cada pergunta tem o mesmo formato do snapshot (spec 006), com objetos estritos e tamanhos máximos, mas aceitando incompleto: textos e rótulos vazios, código em edição, menos opções que o mínimo.
- `lintQuestionnaire(draft)`: lista de pendências `{ code, questionId?, list?, item? }`, na ordem das perguntas. Se as checagens específicas não acham nada, o rascunho é convertido (`draftToSnapshotInput`) e validado pelo `QuestionnaireSnapshot`; qualquer erro restante vira `INVALID`/`CONDITION_INVALID` na pergunta. Assim, **sem pendências ⇒ snapshot válido**.
- `renameInCondition`: troca o código citado nas condições (regra 7).
- `QuestionnaireView` e `SaveQuestionnaireRequest`; erros `QUESTIONNAIRE_CONFLICT` e `QUESTIONNAIRE_LOCKED` (409).

## API (contexto `surveys`)

| Rota                                | O que faz                                           |
| ----------------------------------- | --------------------------------------------------- |
| `GET /v1/surveys/:id/questionnaire` | rascunho (vazio, revisão 0, se nunca salvo) e trava |
| `PUT /v1/surveys/:id/questionnaire` | `{ revision, content }` → salva tudo, revisão + 1   |

- `Survey.questionnaireLock()`: `archived` ou `tse_registered` (eleitoral com número de registro).
- `saveQuestionnaire` trava a linha da pesquisa (`FOR UPDATE`), confere trava e revisão e grava (_upsert_). A trava da pesquisa serializa salvamentos simultâneos.
- `duplicateSurvey` copia o rascunho com ids novos.

## Banco

- `0007_questionnaire_drafts.sql`: tabela `questionnaire_drafts` (`survey_id` PK, `organization_id`, `content` JSONB, `revision`, `updated_at`, `updated_by`), FK composta `(organization_id, survey_id)` → `surveys` com `ON DELETE CASCADE` (só rascunho de pesquisa em rascunho é apagado junto). `surveys` ganha `UNIQUE (organization_id, id)`.
- `0008_questionnaire_drafts_security.sql`: RLS `tenant_isolation`, `revision >= 1`, `content` é objeto com `questions` lista.

## Painel

- Rota `/pesquisas/[id]/questionario`; a página da pesquisa ganha abas **Dados** e **Questionário**.
- Estado do editor num _reducer_ puro (`src/lib/questionnaire-editor.ts`, testado): adicionar por tipo (código `Pnn` livre, opções `1`, `2`…), duplicar, remover, mover, editar campos, opções e linhas, condições; renomear código propaga para as condições.
- Lista à esquerda com arrastar e soltar (`@dnd-kit/sortable`, que também aceita teclado) e botões subir/descer; pendências por pergunta.
- Editor da pergunta ao centro; pré-visualização em moldura de celular à direita (telas largas).
- Salvamento automático 1,2 s depois da última mudança (`PUT` com a revisão); estado "Salvando…/Salvo/Erro"; conflito mostra aviso com "Recarregar"; `beforeunload` com alterações pendentes.
- Ids novos com UUID v7 (`uuid`), como no resto do sistema (ADR-0006).

## Alteração 1 — blocos prontos de perfil

- `packages/contracts/src/questionnaire.ts`: `PROFILE_KEYS` e campo opcional `profile` na pergunta; o snapshot recusa a mesma variável em duas perguntas.
- `packages/contracts/src/profile-blocks.ts`: textos e códigos padrão (`PROFILE_TEMPLATES`), blocos `basic` e `full` e `buildProfileBlock` (ids novos, pula variáveis presentes, código livre com sufixo `_2`).
- Painel: ação `insertMany` no reducer; cartão "Inserir bloco pronto" na coluna das perguntas; selo "Variável de perfil" com "Desvincular" na pergunta.
