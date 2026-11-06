# Design 015 — Publicação de versão

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Sim (migração e contrato novos).

## Contratos (`packages/contracts/src/questionnaire-versions.ts`)

- `compareVersions(anterior, nova)`: mudanças por id estável — título, abertura, configurações; pergunta nova, retirada, texto, código, configuração, tipo; opção/linha nova, retirada, rótulo, código. Compara JSON com chaves ordenadas (o JSONB devolve as chaves em outra ordem).
- `affectsComparability` (opção nova/retirada, enunciado) e `isIncompatible` (tipo).
- `PublicationPreview`, `PublishQuestionnaireRequest { revision }`, `QuestionnaireVersionSummary/List/View`.
- `SurveyView.publishedVersion` (0 = nunca publicada). Erros novos: `QUESTIONNAIRE_NOT_PUBLISHABLE`, `QUESTIONNAIRE_UNCHANGED`, `QUESTIONNAIRE_INCOMPATIBLE`, `QUESTIONNAIRE_VERSION_NOT_FOUND`, `SURVEY_TSE_INCOMPLETE`, `SURVEY_FIELD_LOCKED`.

## Domínio (contexto `surveys`)

- `planPublication({ survey, draft, previous, versionId })`, puro: número da próxima versão, pendências, campos do TSE que faltam, mudanças, snapshot e o primeiro bloqueio (arquivada → pendências → TSE → tipo mudou → nada mudou). A prévia e a publicação usam a mesma função.
- `Survey`: `publishedVersion`; `markPublished(n)` (rascunho → em campo na primeira); `close`/`reopen`; `archive` de rascunho ou encerrada; `unarchive` volta para encerrada se já publicada; `update` liberado fora de arquivada, com tipo e registro no TSE travados depois da publicação.

## API

| Rota                                            | Permissão         |
| ----------------------------------------------- | ----------------- |
| `GET /v1/surveys/:id/questionnaire/publication` | `surveys.publish` |
| `POST /v1/surveys/:id/questionnaire/publish`    | `surveys.publish` |
| `GET /v1/surveys/:id/versions`                  | `surveys.manage`  |
| `GET /v1/surveys/:id/versions/:number`          | `surveys.manage`  |
| `POST /v1/surveys/:id/close` / `reopen`         | `surveys.manage`  |

A publicação trava a linha da pesquisa (`FOR UPDATE`), confere a revisão do rascunho e grava versão, pesquisa e auditoria na mesma transação.

## Banco

- `0009_questionnaire_versions.sql`: tabela `questionnaire_versions` (snapshot e mudanças em JSONB, `UNIQUE (survey_id, number)`, FK composta com a pesquisa sem cascata) e `surveys.published_version`.
- `0010_questionnaire_versions_security.sql`: RLS; `REVOKE UPDATE, DELETE, TRUNCATE` para `az_app` (imutabilidade no banco); o snapshot tem de citar a própria versão, número e pesquisa; `published_version` coerente com a situação.

## Painel

- Aba **Questionário**: "Publicado: versão N" e **Publicar versão N+1** (só com tudo salvo). O diálogo busca a prévia e mostra bloqueio, dados do TSE que faltam, mudanças, aviso de comparabilidade.
- Aba **Versões**: lista com mudanças; cada versão abre um documento para impressão (`print:` do Tailwind esconde o menu). "Imprimir / salvar em PDF" usa a impressão do navegador.
- Aba **Dados**: Encerrar/Reabrir campo; tipo e número do TSE travados depois da publicação; Excluir só para rascunho nunca publicado.
