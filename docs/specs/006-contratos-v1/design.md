# Design 006 — Contratos v1

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Sim (contrato com o app).

## Arquivos

```
packages/contracts/
  src/questionnaire.ts      # QuestionnaireSnapshot, Question (união por type), Condition
  src/interview.ts          # Interview, Answer (união por kind), GeoPoint, MediaRef
  src/sync.ts               # PairDevice*, SyncInterviews*, SyncPull*, Heartbeat*
  src/azp.ts                # AzpManifest
  fixtures/v1/*.json        # exemplos congelados (CA-01)
  src/*.test.ts
```

## Decisões

### Respostas com `kind` explícito (difere do exemplo da Fundação)

O exemplo da Fundação deduzia o tipo da resposta pelo campo presente (`optionIds`, `text`, `number`). Troquei por uma união discriminada com `kind`, por três motivos:

1. A validação acusa "kind inválido" em vez de "nenhum dos formatos casou", que é a mensagem do Zod para uniões sem discriminante.
2. O motor da F1 faz `switch (answer.kind)` e o TypeScript garante que todos os casos foram tratados.
3. Uma resposta `{ "number": 3, "text": "3" }` deixa de ser ambígua.

`scale` responde com `kind: "number"`; `photo` e `signature` com `kind: "media"`.

### Condições citam o código, não o id

`visibleIf` usa o `code` da pergunta (`P02_IDADE`), que é o que o coordenador vê no editor e no Excel. Como códigos são únicos e uma condição só cita perguntas anteriores, a referência é inequívoca.

### Sem `deviceClockOffsetSec` na entrevista

O exemplo da Fundação colocava a diferença de relógio dentro da entrevista, mas o aparelho não sabe que o relógio dele está errado. O lote leva `sentAt` (relógio do aparelho no envio); a API compara com o próprio relógio e registra a diferença em cada entrevista recebida.

### Consentimento recusado vira um registro

Uma abordagem recusada também sobe, com `consent.accepted = false` e sem respostas. Isso alimenta a taxa de recusa, que é um indicador de qualidade de campo, e respeita a regra "nada do campo é descartado".

## Validação estrutural (no schema) × validação contra o questionário (motor, F1)

| Fica no contrato (esta spec)                                                      | Fica no motor (F1)                                        |
| --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Códigos e ids únicos                                                              | A resposta corresponde ao tipo da pergunta                |
| `visibleIf` só cita perguntas anteriores, opções existentes e operador compatível | A pergunta respondida estava visível                      |
| Limites de tamanho e de profundidade                                              | Obrigatórias respondidas, `min/maxSelections` respeitados |
| Consentimento recusado sem respostas                                              | Duração mínima, GPS obrigatório presente                  |

## Versionamento

- `schemaVersion: z.literal(1)`. Na v2, os schemas da v1 continuam no pacote (`InterviewV1`) e a API aceita as duas enquanto houver app antigo em campo.
- O teste de contrato carrega os arquivos de `fixtures/v1/` do disco. Eles **não** são editados para acompanhar mudanças de schema: se um deles deixar de passar, a mudança é incompatível.
