# Spec 006 — Contratos v1 (questionário, entrevista e sincronização)

- Status: concluída
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

O app de campo e a API trocam três tipos de dado: o **questionário** (desce para o aparelho), a **entrevista** (sobe do aparelho) e as **mensagens de sincronização**. Depois que um app estiver instalado num tablet, ele continuará mandando dados no formato que conhecia, às vezes dias depois, sem internet. Por isso esses formatos são fechados antes de qualquer tela, versionados e protegidos por testes. Fundação técnica › Contratos técnicos; ADR-0003 e ADR-0012.

O **motor** que aplica o questionário (ordem das perguntas, avaliação da lógica de salto, validação de respostas contra o questionário) entra na F1. Esta spec define apenas os formatos e as regras estruturais de cada um.

## Regras gerais

1. Os três contratos são schemas Zod em `packages/contracts`, usados pela API, pelo app e pelo painel.
2. Todo documento trocado com o app leva `schemaVersion: 1`.
3. Exemplos fixos de cada contrato ficam em `packages/contracts/fixtures/v1/`. Uma mudança que faça um exemplo v1 deixar de ser aceito **quebra o build**: exige `schemaVersion: 2`, mantendo a leitura da v1.
4. **Estrito no que o app envia, tolerante no que o app recebe.** Entrevistas e mensagens que sobem do aparelho recusam campos desconhecidos. Questionários e respostas que descem da API ignoram campos desconhecidos, para que a API possa ganhar um campo opcional novo sem derrubar apps antigos que ainda estão em campo.

## Questionário (snapshot de uma versão publicada)

5. Identificação: `surveyId`, `versionId`, `versionNumber` (≥ 1), `title`, `introText` opcional.
6. Configurações: GPS `off`, `optional` ou `required`; áudio `off` ou `on`; duração mínima em segundos (0 a 7200); texto de consentimento opcional.
7. Cada pergunta tem `id` (UUID estável entre versões), `code` (variável de exportação, ex.: `P01_SEXO`: maiúsculas, números e `_`, começando por letra, até 40 caracteres), `text`, `helpText` opcional, `required` e `visibleIf` opcional.
8. Tipos de pergunta e suas regras:

| Tipo              | Configuração                                               | Regras                                                |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| `single_choice`   | opções, `shuffleOptions`                                   | 2 a 200 opções                                        |
| `multiple_choice` | opções, `shuffleOptions`, `minSelections`, `maxSelections` | `min ≤ max ≤ número de opções`                        |
| `text`            | `multiline`, `maxLength` (1 a 5000)                        | —                                                     |
| `number`          | `integer`, `min`, `max`, `unit`                            | `min ≤ max`                                           |
| `scale`           | `min`, `max`, `minLabel`, `maxLabel`                       | inteiros, `min < max`, no máximo 101 pontos           |
| `matrix`          | linhas e colunas (opções)                                  | 1 a 50 linhas, 2 a 20 colunas; uma resposta por linha |
| `ranking`         | opções, `maxRanked`                                        | `maxRanked ≤ número de opções`                        |
| `date`            | `min`, `max` (AAAA-MM-DD)                                  | `min ≤ max`                                           |
| `photo`           | `maxPhotos` (1 a 5)                                        | —                                                     |
| `signature`       | —                                                          | —                                                     |

9. Opções têm `id` (UUID), `code` (valor exportado, ex.: `1`, `NS_NR`) e `label`. Podem ser `fixed` (não embaralha) e, em múltipla escolha, `exclusive` (desmarca as outras). No máximo uma opção `other` por pergunta (pede texto "Outro, especificar").
10. IDs de perguntas e códigos de perguntas são únicos no questionário; IDs e códigos de opções e de linhas são únicos na pergunta.

### Lógica de salto (`visibleIf`)

11. Um único mecanismo: a pergunta aparece se a condição for verdadeira. "Pular para P7" no editor vira condições nas perguntas puladas.
12. Condição é uma árvore com `all`, `any`, `not` e comparações `{ question, op, value }`, em que `question` é o **código** de uma pergunta. Operadores fechados: `eq`, `neq`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte`, `answered`, `notAnswered`. Nada de expressões em texto livre.
13. Uma condição só pode citar perguntas **anteriores**. Isso impede ciclos.
14. Compatibilidade operador × tipo:
    - escolha única e múltipla: `eq`, `neq` (um código de opção), `in`, `notIn` (lista de códigos); os códigos precisam existir na pergunta citada;
    - número e escala: `eq`, `neq`, `gt`, `gte`, `lt`, `lte` com valor numérico;
    - qualquer tipo: `answered`, `notAnswered`, sem valor.
15. Limites: profundidade máxima 5 e no máximo 50 comparações por pergunta.

## Entrevista

16. Identificação: `id` (UUID v7 gerado no aparelho), `surveyId`, `versionId`, `interviewerId`, `appVersion`. O aparelho **não** informa `organizationId` nem `deviceId`: a API tira os dois do token do aparelho (AGENTS.md, regra 5).
17. Tempos: `startedAt` e `finishedAt` pelo relógio do aparelho, com `finishedAt ≥ startedAt`.
18. Localização: `null` quando o GPS está desligado na pesquisa; senão, pontos de início e fim (cada um pode ser `null` se não houve sinal) com latitude, longitude, precisão em metros, horário e indicação de localização simulada.
19. Consentimento: `null` quando a pesquisa não tem texto de consentimento; senão, se aceitou e o hash SHA-256 do texto exibido. **Consentimento recusado não tem respostas** (a recusa é enviada mesmo assim, para a taxa de recusa).
20. Respostas: uma por pergunta respondida (pergunta pulada ou opcional não respondida simplesmente não aparece), cada uma com um `kind` explícito: `choice`, `text`, `number`, `matrix`, `ranking`, `date` ou `media`.
21. Mídias: lista com id, tipo (`audio`, `photo`, `signature`), MIME, tamanho e hash SHA-256; o arquivo sobe separado.

## Sincronização

22. Mensagens: vincular aparelho, enviar entrevistas (lote de 1 a 20, com o horário de envio do aparelho para a API calcular a diferença de relógio), receber atualizações e heartbeat.
23. A resposta do envio lista `accepted` (ids) e `rejected` (id + código). Códigos de rejeição: `VERSION_UNKNOWN`, `SURVEY_NOT_ASSIGNED`, `INTERVIEWER_NOT_AUTHORIZED`, `VALIDATION_FAILED`. Rejeitada não é descartada: vai para quarentena (F1).
24. O pacote `.azp` (sem internet) tem um manifesto com formato, versão, organização, aparelho, contagens e o hash de cada arquivo; as entrevistas seguem o mesmo contrato, uma por linha. A criptografia do pacote fica para a F1, num ADR próprio.

## Critérios de aceite

### CA-01 — Exemplos válidos

- **Dado** os exemplos em `fixtures/v1/` (um questionário com todos os tipos de pergunta e lógica de salto, entrevistas aceita e recusada, mensagens de sincronização e manifesto `.azp`)
- **Quando** validados pelos schemas
- **Então** todos são aceitos

### CA-02 — Estrutura do questionário

- **Dado** questionários com código repetido, opção repetida, duas opções `other`, `minSelections > maxSelections`, escala invertida
- **Quando** validados
- **Então** cada um é recusado indicando o caminho do problema

### CA-03 — Lógica de salto segura

- **Dado** condições que citam uma pergunta posterior, a própria pergunta, um código inexistente, uma opção inexistente, `gt` numa escolha, `answered` com valor, ou profundidade 6
- **Quando** validadas
- **Então** todas são recusadas

### CA-04 — Entrevista coerente

- **Dado** entrevistas com `finishedAt` antes de `startedAt`, resposta duplicada para a mesma pergunta, consentimento recusado com respostas, `organizationId` no corpo, coordenada fora do planeta
- **Quando** validadas
- **Então** todas são recusadas

### CA-05 — Lotes de sincronização

- **Dado** um lote vazio, um lote com 21 entrevistas e um lote com o mesmo id duas vezes
- **Quando** validados
- **Então** todos são recusados

### CA-06 — Contratos exportáveis

- **Dado** os schemas
- **Quando** convertidos para JSON Schema (base do OpenAPI, ADR-0012)
- **Então** a conversão funciona para todos

## Alterações

1. **2026-11-06 — variável de perfil** (spec 014, alteração 1): toda pergunta pode ter `profile` (`sex`, `age_group`, `education`, `family_income`, `religion`, `occupation`, `area`), opcional; um questionário não repete a mesma variável. Campo novo e opcional: snapshots antigos continuam válidos.

## Fora de escopo

- Motor do questionário (avaliar `visibleIf`, validar respostas contra o questionário, embaralhar): F1.
- Endpoints que usam esses contratos: F1.
- Criptografia do `.azp` e protocolo de upload de mídia (tus): F1.
