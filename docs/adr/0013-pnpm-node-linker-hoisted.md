# ADR-0013 — `node_modules` plano no pnpm (`nodeLinker: hoisted`)

- Status: aceita
- Data: 2026-11-05
- Complementa: [ADR-0011](./0011-versoes-de-ferramentas.md) (pnpm 10)

## Contexto

O pnpm, por padrão, monta o `node_modules` com links para a pasta `.pnpm` (no Windows, _junctions_). Na primeira compilação do app no Android (spec 008), no PC de desenvolvimento com Windows, o build nativo do `expo-sqlite` (CMake + Ninja) entrou em loop até falhar com `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. É um problema conhecido de módulos React Native com C++ no Windows quando instalados com o layout de links do pnpm; os caminhos longos de `.pnpm` também se aproximam do limite de 260 caracteres do Windows. A correção indicada pelo Expo e pelas bibliotecas afetadas é o layout plano.

## Decisão

`nodeLinker: hoisted` em `pnpm-workspace.yaml`, para o repositório inteiro (o pnpm não permite um layout por pacote). O lockfile não muda; continuam valendo o pnpm 10, os workspaces e o `--frozen-lockfile`.

## Consequências

- O app compila no Windows; caminhos de `node_modules` ficam curtos.
- Perde-se o isolamento estrito do pnpm: um pacote consegue importar uma dependência que não declarou (_phantom dependency_) sem erro na instalação. Mitigação: o ESLint e o TypeScript de cada pacote continuam resolvendo a partir do próprio `package.json`, e o `pnpm check` em clone limpo (e na CI, spec 009) pega o que faltar declarar.
- Versões diferentes do mesmo pacote convivem: o React do app (19.3.0, exigido pelo Expo) fica em `apps/mobile/node_modules`, o do painel na raiz.
- Quem já tinha o repositório precisa apagar todos os `node_modules` e rodar `pnpm install` de novo (README).
- Com o layout plano, o _autolinking_ do Expo passou a compilar dependências opcionais do `expo-router` que o app não usa (`react-native-reanimated`, `react-native-worklets`), e o C++ delas estourou o limite de caminho do Ninja do NDK no Windows (`ninja: error: mkdir(...)`). Elas ficam fora do build nativo em `apps/mobile/react-native.config.js`; quem for usar uma delas remove a linha (e precisa de Ninja 1.12+ ou do repositório num caminho curto no Windows).
- Validado em Linux: `pnpm check`, build, e2e do painel, `expo export` e `expo prebuild` do app.
