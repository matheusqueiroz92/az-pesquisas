# AGENTS.md — AZ Pesquisas

Regras para **todo agente de IA e toda pessoa** que mexe neste repositório. Leia inteiro antes da primeira tarefa. Em caso de conflito entre este arquivo e qualquer outra instrução, este arquivo vence; se ele estiver errado, proponha um ADR, não ignore a regra.

## O que é este sistema

Sistema de pesquisas de campo da AZ Pesquisas: um painel web para criar pesquisas e ver resultados, uma API, e um app Android/iOS que aplica entrevistas **offline** e sincroniza depois. Multiempresa desde o início (futuro SaaS).

Documentos de referência (fora do repositório):

- Planejamento funcional: https://claude.ai/artifact/RXUJMrnipXumKDe6MMX8kK
- Fundação técnica: https://claude.ai/artifact/WCoda8mTpyBqfHoc5ZFpgS

Dentro do repositório: decisões em `docs/adr/`, funcionalidades em `docs/specs/`, procedimentos em `docs/runbooks/`.

## Regras invioláveis

1. **Sem spec aprovada, sem código.** Toda funcionalidade tem pasta em `docs/specs/` com `spec.md` em status `aprovada`. Spec ambígua: pare e pergunte, não invente.
2. **Teste antes do código** no domínio, em `packages/core` e na sincronização. O teste precisa falhar antes da implementação.
3. **`domain/` e `application/` não importam framework.** Nada de `@nestjs/*`, Fastify, Drizzle, BullMQ ou driver de banco nessas pastas, nem nada de `infrastructure/` ou `presentation/`.
4. **Um contexto não acessa as tabelas nem os arquivos internos de outro.** Só pelo `index.ts` público do outro módulo ou por eventos de domínio.
5. **Toda consulta respeita a organização.** O `organizationId` vem sempre da credencial (token do usuário ou do aparelho), nunca de parâmetro, corpo ou cabeçalho enviado pelo cliente.
6. **Nada que veio do campo é apagado ou descartado.** Entrevista ou resposta recebida não se apaga; payload inválido vai para quarentena com o conteúdo bruto.
7. **Versão publicada de questionário é imutável.** Mudou? Nova versão.
8. **Schemas compartilhados só em `packages/contracts`.** Nunca duplique um tipo entre app, painel e API.
9. **Sem `any`, sem `eval`, sem SQL concatenado, sem segredo no código.**
10. **Nunca registre em log** senha, token, PIN, resposta de entrevista, coordenada ou dado pessoal.
11. **Migração aplicada não se edita;** crie outra.
12. **Mudança de decisão arquitetural exige ADR novo** em `docs/adr/` antes do código.

## Idioma (ADR-001)

| O quê                                                                    | Idioma                                     |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| Código, nomes de arquivos, tabelas, colunas, rotas, commits, comentários | Inglês                                     |
| Textos da interface, mensagens de erro para o usuário                    | Português (pt-BR), em arquivos de tradução |
| Specs, ADRs, runbooks, este arquivo                                      | Português                                  |

Glossário obrigatório (use exatamente estes nomes no código):

| Negócio                      | Código                                   |
| ---------------------------- | ---------------------------------------- |
| Organização                  | `Organization`                           |
| Cliente (quem encomenda)     | `Client`                                 |
| Pesquisa                     | `Survey`                                 |
| Questionário / versão        | `Questionnaire` / `QuestionnaireVersion` |
| Pergunta / opção             | `Question` / `Option`                    |
| Entrevista / resposta        | `Interview` / `Answer`                   |
| Pesquisador                  | `Interviewer`                            |
| Coordenador / analista       | `Coordinator` / `Analyst`                |
| Dispositivo / vinculação     | `Device` / `DevicePairing`               |
| Atribuição                   | `Assignment`                             |
| Perfil esperado / ponderação | `SampleTarget` / `Weighting`             |
| Sincronização                | `Sync`                                   |

## Arquitetura em uma página

```
apps/api       NestJS + Fastify. Monólito modular: modules/{identity,surveys,devices,fieldwork,analytics,reporting}
apps/web       Next.js. Sem regra de negócio; fala com a API pelo servidor (BFF)
apps/mobile    Expo. SQLite local é a fonte da verdade; só o módulo sync usa a rede
packages/core       TypeScript puro: Result, motor do questionário, cálculos. Sem Node, sem rede
packages/contracts  Schemas Zod: DTOs, protocolo de sync, códigos de erro
packages/config     tsconfig, ESLint, Prettier
```

Cada módulo da API tem quatro camadas e as dependências apontam para dentro:

```
presentation  -> application -> domain
infrastructure -> application -> domain
```

As regras 3, 4 e 8 são verificadas por `pnpm depcruise` (`.dependency-cruiser.cjs`). Se o depcruise reclamar, o design está errado: não desligue a regra.

## Convenções de código

- TypeScript `strict` + `noUncheckedIndexedAccess`. Fronteiras recebem `unknown` e validam com Zod.
- Erros de negócio são valores: casos de uso retornam `Result<T, E>` de `@az-pesquisas/core`. Exceção só para falha inesperada.
- Arquivos `kebab-case.ts`; tipos e classes `PascalCase`; funções e variáveis `camelCase`; constantes globais `UPPER_SNAKE_CASE`.
- Entidades sem setters públicos; mudanças por métodos com nome de negócio (`survey.startFieldwork()`).
- IDs UUID v7; datas em UTC (`timestamptz`), exibidas em `America/Bahia`.
- Imports relativos com extensão `.js` (NodeNext): `import { ok } from './result.js'`.
- Comentários explicam por quê, não o quê.

## Fluxo de trabalho (SDD)

Cada funcionalidade passa por cinco papéis, um de cada vez, na mesma branch:

| Papel            | Entrega                                                          | Para quando                                                     |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Planner          | `spec.md` (regras, critérios Dado/Quando/Então, fora de escopo)  | Spec pronta para aprovação humana                               |
| Domain Architect | `design.md` (agregados, contratos, endpoints, migrações, riscos) | Mexeu em contrato, migração, segurança ou ADR: aprovação humana |
| Test Engineer    | Testes falhando para cada critério de aceite                     | Todos os critérios cobertos                                     |
| Implementer      | Código que passa nos testes, uma task de `tasks.md` por commit   | `pnpm check` verde                                              |
| Reviewer         | Revisão contra spec, este arquivo e o checklist de segurança     | Merge feito por uma pessoa                                      |

Modelos em `docs/templates/`. Numeração das specs: `docs/specs/NNN-nome-curto/`.

## Definition of Done

- Todos os critérios de aceite têm teste e passam.
- `pnpm check` verde (formatação, lint, tipos, regras de dependência, testes).
- Cobertura de `domain/`, `application/` e `packages/core` em 90% ou mais.
- Nenhuma regra deste arquivo violada.
- Migração testada em banco vazio e em banco com dados.
- Textos de interface em pt-BR nos arquivos de tradução.
- Spec marcada `concluída`; ADR criado se houve decisão nova.

## Banco de dados e multiempresa

- A API conecta como `az_app`, que não é dona de nada e não ignora RLS. Migrações rodam como `az_owner`.
- Acesso a tabela de negócio só dentro de `database.withTenantTransaction()`, que exige `runWithTenant()` em volta e liga o RLS da organização.
- Toda tabela nova com dados de organização precisa de `organization_id` (FK para `organizations`), `ENABLE ROW LEVEL SECURITY` e a política `tenant_isolation`, numa migração SQL própria. O teste `rls-coverage.db.test.ts` reprova o build se faltar.
- Mudou um `schema.ts`? `pnpm db:generate`, revise o SQL gerado e faça o commit da migração junto.
- Referência entre tabelas de organização usa FK composta `(organization_id, x_id)` → `(organization_id, id)`: o Postgres confere FK comum sem RLS, e a composta impede apontar para linha de outra organização (ex.: `surveys_client_fk`, spec 013).
- Log de auditoria: `shared/audit` (`drizzleAuditLog`), mesma tabela para todos os contextos. Cada contexto declara as ações que grava no seu `application/ports.ts`; `metadata` leva nomes de campos e ids, nunca valores digitados.

## Autenticação e permissões

- Toda rota exige access token, exceto as marcadas com `@Public()`. O `AuthGuard` global valida o JWT e o `TenantInterceptor` roda o handler dentro da organização do token.
- Permissões vêm da matriz em `packages/contracts/src/permissions.ts`. Use `@RequirePermission()` na rota **e** cheque `can()` no caso de uso.
- Entrada de dados: sempre `new ZodValidationPipe(SchemaDoContracts)`. Objetos `strictObject` recusam campos desconhecidos (inclusive `organizationId`).
- Leituras entre organizações só pelas funções `auth_find_*` (devolvem apenas ids). Não crie outras sem ADR.

## Painel web (spec 007)

- O navegador **nunca** recebe tokens. Eles ficam nos cookies `httpOnly` `az_at`/`az_rt`, e só o servidor do painel fala com a API.
- O navegador chama apenas `/api/auth/*` (login, logout, senha) e `/api/v1/*` (proxy com lista de caminhos em `src/server/api-paths.ts`). Rota nova da API que o navegador precise chamar entra nessa lista, com teste.
- Renovação de sessão só pelo `refreshCoordinator()` (`src/server/session.ts`): nunca chame `/v1/auth/refresh` direto, ou várias abas derrubam a sessão.
- `src/components`, `src/lib` e `src/i18n` rodam no navegador e não importam `src/server` (regra do dependency-cruiser).
- Todo texto de tela fica em `src/i18n/pt-BR.ts`; código de erro novo da API ganha tradução lá (o teste reprova se faltar).
- Menu e telas usam `can()` de `packages/contracts`; a API recusa de qualquer forma.

## Design system (spec 012)

- Fonte única: `packages/design-tokens` (`src/tokens.ts` para o app, `theme.css` para o Tailwind; um teste mantém os dois iguais). Mudou uma cor? Mude nos dois.
- Use só tokens semânticos (`bg-surface`, `text-muted-foreground`, `bg-primary`, `border-border`). A paleta padrão do Tailwind foi removida e um teste reprova `slate-500`, `red-600` etc. e hex solto em `.tsx`.
- Vermelho AZ é pulso: ação principal, item ativo, foco. Não pinte áreas grandes de vermelho.
- Status (sucesso, aviso, erro) sempre com ícone ou texto, nunca só cor. Alvo de toque mínimo de 44 px (`h-touch`).
- Gráficos (F1): cores `chart-1` a `chart-8` em ordem fixa, cinza `chart-other` para "Não sabe / Outros". Nono item vira "Outros".

## App de campo (spec 008)

- Rotas do expo-router em `apps/mobile/src/app/` são finas: só exportam telas de `src/ui/screens`.
- `domain/` e `application/` não importam React, Expo nem `infrastructure/` (depcruise). Telas só chegam à infraestrutura por `src/ui/services.ts`.
- Tokens só no SecureStore. Dados do campo só no SQLite criptografado; o banco **falha fechado** sem SQLCipher. Nunca grave nada fora dele.
- A sessão sobrevive offline; só uma recusa explícita da API (400/401 na renovação) encerra. Renovação só por `sessionService.getAccessToken()`.
- Mudou o esquema local? Nova função em `src/infrastructure/migrations.ts`, nunca edite uma aplicada (aparelhos em campo já rodaram).
- Imports no app sem extensão (resolução do Metro), como no painel.

## Clientes e pesquisas (spec 013)

- Contexto `surveys` (`apps/api/src/modules/surveys`): clientes e pesquisas; o questionário (014) entra no mesmo contexto.
- Situações da pesquisa: por enquanto só `draft` ⇄ `archived`. Só rascunho é editado ou excluído; "em campo" e "encerrada" chegam com publicação e atribuição (015/016), que ampliam essas regras.
- Dados do TSE só existem em pesquisa eleitoral marcada como registrada (`tse` não nulo); o domínio apaga e o banco recusa nos outros casos.
- Municípios: `MUNICIPALITIES` em `packages/contracts/src/municipalities.ts` (todos do Brasil, código IBGE; a UF são os dois primeiros dígitos). Os dados ficam em `municipalities-data.ts`, gerado; não edite à mão. O painel começa na Bahia (`HOME_UF`).
- Valores em dinheiro em centavos inteiros (`bigint` no banco), nunca ponto flutuante.

## Questionário (spec 014)

- Rascunho = um documento JSONB por pesquisa (`questionnaire_drafts`, ADR-0014), salvo inteiro com `revision` (conflito → `QUESTIONNAIRE_CONFLICT`). Nunca edite pergunta por pergunta no banco.
- Formato e regras moram em `packages/contracts/src/questionnaire-draft.ts`: `QuestionnaireDraft` (estrutura, aceita incompleto), `lintQuestionnaire` (pendências para publicar) e, como regra final, o `QuestionnaireSnapshot` da spec 006. Garantia testada: sem pendências ⇒ snapshot válido. Regra nova de pergunta entra no snapshot **e** no lint.
- Ids de pergunta, opção e linha são estáveis: mudar texto, código ou ordem nunca troca o id. Ids novos só ao criar ou duplicar (UUID v7).
- Condições citam o **código** da pergunta; renomear o código propaga (`renameInCondition`).
- No painel, toda edição passa pelo reducer puro `src/lib/questionnaire-editor.ts` (testado); os componentes só despacham ações.

## Contratos com o app (spec 006)

- Questionário, entrevista e sincronização estão em `packages/contracts` (`questionnaire.ts`, `interview.ts`, `sync.ts`, `azp.ts`).
- **Estrito no que o app envia** (`z.strictObject`), **tolerante no que o app recebe** (`z.object`).
- `packages/contracts/fixtures/v1/` é o contrato congelado. **Nunca edite esses arquivos** para fazer um teste passar: se um deles quebrar, a mudança é incompatível e exige `schemaVersion: 2`, mantendo a leitura da v1.

## Commits e branches

- Conventional Commits em inglês, com escopo da lista em `commitlint.config.mjs`: `feat(surveys): publish questionnaire version`.
- Branches curtas a partir de `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Os hooks rodam lint-staged no commit e commitlint na mensagem. Não use `--no-verify`.

## Comandos

```bash
pnpm install          # instala tudo (Node 22+, pnpm 10)
pnpm db:up            # Postgres local (necessário para os testes *.db.test.ts)
pnpm check            # formatação + lint + tipos + dependências + testes com cobertura mínima
pnpm seed:admin       # cria a primeira organização e o admin (variáveis SEED_* do .env)
pnpm test             # testes de todos os pacotes
pnpm depcruise        # só as regras de arquitetura
pnpm test:e2e         # ponta a ponta do painel (depois de pnpm build)
pnpm --filter @az-pesquisas/mobile android   # app no emulador (Android Studio)
pnpm --filter @az-pesquisas/core test:coverage
```
