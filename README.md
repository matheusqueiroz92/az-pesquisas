# AZ Pesquisas

Sistema de pesquisas de campo da AZ Pesquisas: painel web, API e app Android/iOS que coleta entrevistas offline.

> Antes de qualquer contribuição, leia o [AGENTS.md](./AGENTS.md).

## Requisitos

- Node.js 22.12 ou superior (`.nvmrc`)
- pnpm 10.28 ou superior (`npm install -g pnpm@10`). `corepack enable` também funciona, mas no Windows exige o terminal aberto como administrador
- Docker Desktop rodando (banco local e testes de banco)

## Primeiros passos

```bash
pnpm install
pnpm db:up        # Postgres + PostGIS em Docker, porta 5433
pnpm check        # os testes de banco usam o Postgres do db:up
```

## Rodar a API localmente

```bash
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm db:migrate
pnpm seed:admin   # primeira organização e admin (ajuste SEED_* no .env)
pnpm build
pnpm --filter @az-pesquisas/api dev
# http://localhost:3000/health/live
```

## Rodar o painel localmente

Com a API rodando (seção acima):

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @az-pesquisas/web dev
# http://localhost:3001 — entre com o admin do seed:admin
```

O link de "esqueci a senha" não sai por e-mail no ambiente local: ele fica num arquivo `.txt` em `apps/api/.mail/`.

## Rodar o app de campo no Android (Android Studio)

O app usa banco criptografado (SQLCipher), que não roda no Expo Go: ele é instalado como _development build_.

**Uma vez só, no Windows:**

1. Instale o [Android Studio](https://developer.android.com/studio). No primeiro assistente, aceite o SDK padrão.
2. Em _More Actions › SDK Manager_, confirme: _Android SDK Platform_ mais recente, _Android SDK Build-Tools_ e _Android SDK Platform-Tools_.
3. Em _More Actions › Virtual Device Manager_, crie um emulador (sugestão: _Pixel Tablet_, que lembra os tablets de campo).
4. Variáveis de ambiente do usuário (Painel de Controle › Variáveis de ambiente):
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
   - Acrescente ao `Path`: `%ANDROID_HOME%\platform-tools` e `%ANDROID_HOME%\emulator`
5. Se o build reclamar de caminho longo ("Filename longer than 260 characters"), ative caminhos longos no Windows (PowerShell como administrador): `New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force` e reinicie.

**Para rodar:**

```powershell
# com a API no ar (seção "Rodar a API localmente") e o emulador aberto
pnpm build
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @az-pesquisas/mobile android   # 1ª vez compila o app nativo (demora); instala e abre
```

Nas vezes seguintes, com o app já instalado: `pnpm --filter @az-pesquisas/mobile start` e abra o app no emulador. Mudou algo nativo (`app.config.ts`, módulo novo)? Rode `android` de novo.

Entre com um usuário de papel **Pesquisador** ou **Coordenador** criado no painel.

**Tablet ou celular por cabo USB:** ative _Opções do desenvolvedor › Depuração USB_, conecte, rode `adb reverse tcp:3000 tcp:3000` e troque no `apps/mobile/.env` para `EXPO_PUBLIC_API_URL=http://localhost:3000`.

## Testes de ponta a ponta (painel)

Usam a API e o painel de verdade, num banco descartável (`az_e2e`) no mesmo Postgres do `db:up`.

```bash
pnpm --filter @az-pesquisas/web exec playwright install chromium   # só na primeira vez
pnpm build
pnpm test:e2e
```

## Estrutura

| Pasta                    | Conteúdo                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `apps/`                  | `api` (NestJS), `web` (Next.js), `mobile` (Expo) — criados nas specs 003, 007 e 008 |
| `packages/core`          | Código de domínio puro compartilhado (`Result`, motor do questionário)              |
| `packages/design-tokens` | Design system: cores AZ, tipografia, paleta de gráficos, símbolo AZ                 |
| `packages/config`        | TypeScript, ESLint e Prettier compartilhados                                        |
| `docs/adr`               | Decisões de arquitetura                                                             |
| `docs/specs`             | Uma pasta por funcionalidade (spec, design, tasks)                                  |
| `docs/templates`         | Modelos de spec, design e tasks                                                     |
| `infra/`                 | Docker Compose e scripts de operação                                                |

## Scripts

| Comando                        | O que faz                                                  |
| ------------------------------ | ---------------------------------------------------------- |
| `pnpm check`                   | Formatação, lint, tipos, regras de arquitetura e testes    |
| `pnpm test:e2e`                | Testes de ponta a ponta do painel (depois de `pnpm build`) |
| `pnpm test`                    | Testes de todos os pacotes                                 |
| `pnpm lint` / `pnpm typecheck` | Lint e checagem de tipos via Turborepo                     |
| `pnpm depcruise`               | Regras de dependência entre camadas e módulos              |
| `pnpm format`                  | Formata o repositório com Prettier                         |
