# Design 009 — CI

Um arquivo: `.github/workflows/ci.yml`, quatro _jobs_ em paralelo.

| Job             | O que roda                                                | Serviços                                                                                                                    |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `check`         | `pnpm install --frozen-lockfile` → `pnpm check`           | Postgres 17 + PostGIS na porta 5433 (`TEST_DATABASE_ADMIN_URL`). Cada arquivo de teste cria o próprio banco, como no local. |
| `e2e`           | `pnpm build` → Chromium do Playwright → `pnpm test:e2e`   | O mesmo Postgres. `e2e/prepare.mjs` cria `az_e2e` com `db:migrate` e `seed:admin` reais.                                    |
| `mobile-bundle` | `pnpm build` (pacotes) → `expo export --platform android` | —                                                                                                                           |
| `commits`       | `commitlint --from <base> --to <head>`                    | — (só em `pull_request`)                                                                                                    |

- `concurrency` por branch, com `cancel-in-progress`.
- Cache do pnpm pelo `actions/setup-node` (`cache: pnpm`).
- Versões: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v5` (a v6 saiu há dias), `actions/upload-artifact@v7`.
- O Postgres do serviço não roda o `init.sh` do compose: os testes fazem o próprio bootstrap (roles, extensões) com o mesmo SQL de `infra/db`, sob o advisory lock.

## Proteção da branch (manual, uma vez)

GitHub › Settings › Branches › Add rule para `main`: exigir PR, exigir as verificações `check`, `e2e`, `mobile-bundle` e `commits`, e exigir branch atualizada. Passo a passo no README.
