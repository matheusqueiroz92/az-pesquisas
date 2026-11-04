# Design 007 — Esqueleto do painel web

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Sim (segurança da sessão).

## Pilha

Next.js 16 (App Router), React 19, Tailwind 4. Componentes de interface escritos no próprio projeto no estilo shadcn/ui (`src/components/ui`), sem depender da CLI do shadcn. Ficam no app por enquanto e vão para `packages/ui` quando um segundo app precisar deles.

## Fluxo da sessão

```
Navegador ──(cookies httpOnly)──> Painel Next.js ──(Authorization: Bearer)──> API
```

| Peça                     | Arquivo                             | Papel                                                                                                            |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `proxy.ts`               | `src/proxy.ts`                      | Roda antes de toda página: gera o nonce da CSP, renova a sessão se o access token venceu, redireciona sem sessão |
| Coordenador de renovação | `src/server/refresh-coordinator.ts` | _Single-flight_ por refresh token + cache de 30 s do resultado                                                   |
| Rotas de autenticação    | `src/app/api/auth/*`                | login, logout, esqueci/redefinir senha (únicas que tocam no refresh token)                                       |
| Proxy de dados           | `src/app/api/v1/[...path]/route.ts` | Repassa chamadas do navegador à API com o access token; só caminhos permitidos                                   |
| Cliente de servidor      | `src/server/api-client.ts`          | Server Components buscam dados na API com o token do cookie                                                      |

### Cookies

| Cookie  | Conteúdo      | `path` | Validade                          |
| ------- | ------------- | ------ | --------------------------------- |
| `az_at` | access token  | `/`    | expira junto com o token (15 min) |
| `az_rt` | refresh token | `/`    | 30 dias                           |

Ambos `httpOnly`, `SameSite=Lax`, `Secure` quando `APP_ENV` não é `local`. O `proxy.ts` lê `az_rt` porque roda no servidor; o navegador só o envia para `/api/auth/*`. Para o `proxy.ts` enxergá-lo em qualquer página, o cookie usa `path=/`, e o isolamento vem do `httpOnly`: nenhum JavaScript o lê. **Decisão**: `path=/` em vez de `/api/auth`, porque a renovação acontece na navegação. O CA-03 foi ajustado para conferir `httpOnly` nos dois.

### Renovação uma por vez

```
aba 1 ─┐
aba 2 ─┼─> proxy.ts ─> coordinator.refresh(rt) ─┬─> 1 chamada à API /v1/auth/refresh
aba 3 ─┘                                        └─> as 3 recebem o mesmo par novo
```

- Chave do mapa: SHA-256 do refresh token (o token em si nunca fica guardado em memória como chave).
- Resultado guardado por 30 s depois de concluído: cobre a aba que dispara logo depois, ainda com o cookie antigo.
- Funciona porque o painel roda num único processo. Se um dia houver mais de uma instância, o cache passa para o Redis (nota para a spec 010).

### Proteção contra CSRF

`SameSite=Lax` já impede que outro site envie os cookies num POST. Além disso, toda rota `/api/*` que muda dados confere o cabeçalho `Origin` contra a origem do painel.

## Telas e permissões

- `src/i18n/pt-BR.ts`: todos os textos e a tradução dos códigos de erro.
- `can(role, permission)` vem de `@az-pesquisas/contracts`; o menu e as páginas usam a mesma matriz que a API.

## Testes

- **Unitários (Vitest)**: coordenador de renovação (concorrência e cache), opções de cookie, lista de caminhos do proxy de dados, checagem de origem, tradução de erros.
- **Ponta a ponta (Playwright)**: API e painel reais, banco descartável preparado pelo `e2e/prepare.mjs` (cria o banco, aplica migrações com `db:migrate` e cria os admins com `seed:admin`, os comandos reais). CA-01 a CA-09.
- Os testes de ponta a ponta rodam com `pnpm test:e2e` (depois de `pnpm build`), fora do `pnpm check`, como prevê a Fundação; no CI (spec 009) rodam em todo PR que toca o painel.

## Notas para a spec 010 (deploy)

- **IP do cliente**: o painel repassa `X-Forwarded-For` para a API, porque o limite de tentativas de login é por IP; sem isso, todo login contaria contra o IP do painel. A API hoje usa `trustProxy: true`, que confia no primeiro endereço da lista, e esse endereço pode ser forjado pelo navegador. No deploy, o Traefik precisa sobrescrever o cabeçalho e a API precisa confiar só nos saltos conhecidos (Traefik e painel).
- **Mais de uma instância do painel**: o cache do coordenador de renovação passa para o Redis.
