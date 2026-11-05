# Design 008 — Esqueleto do app de campo

## Pilha

Expo SDK 58 (React Native 0.88), expo-router, `expo-sqlite` com SQLCipher, `expo-secure-store`, `expo-crypto`. Development build (SQLCipher não roda no Expo Go). Contratos e cores vêm de `packages/contracts` e `packages/design-tokens`.

## Camadas (`apps/mobile/src`)

| Pasta                | Conteúdo                                                                                                                 | Pode importar                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `domain/`            | `Session`, papéis que entram no app, regras de expiração                                                                 | `@az-pesquisas/core`, `contracts` |
| `application/`       | Casos de uso (`signIn`, `restoreSession`, `getAccessToken`, `signOut`) e portas (`AuthGateway`, `SessionStore`, `Clock`) | `domain`, `core`, `contracts`     |
| `infrastructure/`    | `HttpAuthGateway` (fetch + Zod), `SecureSessionStore`, `openEncryptedDatabase`, chave do banco                           | tudo acima + Expo                 |
| `ui/`                | Telas, componentes, tema (tokens), textos pt-BR, composição (`services.ts`)                                              | `application`, `domain`, tema     |
| `app/` (raiz do app) | Rotas do expo-router; arquivos finos que só exportam telas de `src/ui`                                                   | `src/ui`                          |

## Sessão

```
abrir app ─> restoreSession() ─> tokens no SecureStore? ─ não ─> Entrar
                                     │ sim
                                     └──> telas internas (mesmo offline, mesmo token vencido)

chamada à API ─> getAccessToken() ─> token válido? ─ sim ─> usa
                                       │ não
                                       └─> refresh único (in-flight compartilhado)
                                             ├ ok ─> salva par novo
                                             ├ recusado (400/401) ─> apaga tokens ─> Entrar
                                             └ sem rede ─> erro "offline" (sessão continua)
```

O app é um processo só: o single-flight é uma promessa em memória (no painel era um mapa por token com cache de 30 s, porque várias abas usavam cookies antigos).

## Banco criptografado

1. `getOrCreateDatabaseKey()`: 32 bytes de `expo-crypto`, em hex, no SecureStore com `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
2. `openDatabaseAsync('az-pesquisas.db')` → `PRAGMA key = "x'<hex>'"` (chave bruta, sem PBKDF2: já tem entropia total) como **primeiro** comando.
3. `PRAGMA cipher_version`: vazio → fecha e lança `DATABASE_NOT_ENCRYPTED` (falha fechada).
4. `PRAGMA journal_mode = WAL`; migrações por `user_version` dentro de `withExclusiveTransactionAsync`.

A ordem e a falha fechada são testadas com um banco falso (a porta `SqlDatabase`), porque o SQLCipher só existe no aparelho. Drizzle entra junto com as primeiras tabelas de verdade (F1).

## Testes

- Vitest em `domain`, `application` e nas partes puras de `infrastructure` (gateway HTTP com fetch falso, abertura do banco com banco falso), cobertura mínima de 90%.
- `expo export --platform android` no CI garante que o bundle monta (imports, Metro no monorepo).
- Verificação manual no emulador (CA-01 a CA-04), roteiro no README.

## Roteiro manual no emulador (CA-01 a CA-04)

1. Painel: crie um Pesquisador. App: entre com senha errada (erro genérico), depois com a certa (Pesquisas).
2. Entre com o admin do seed: "Este aplicativo é para pesquisadores e coordenadores…".
3. Logado, ative o modo avião no emulador, feche e abra o app: abre direto em Pesquisas. Conta mostra "Criptografado (SQLCipher …)".
4. Desative o modo avião; no painel, desative o pesquisador. Quando o app precisar renovar (15 min ou mais), ele volta ao login. Na F0 nada no app chama a API depois do login, então este passo fica coberto pelo teste automático e volta ao roteiro na F1 (sincronização).

## Notas

- `android/` e `ios/` são gerados (`expo prebuild`) e ficam fora do Git.
- O _debug build_ aceita HTTP (`usesCleartextTraffic` só no manifesto de debug); o build de produção, não (regra 16).
- Testes: `domain`, `application`, `infrastructure` (menos `infrastructure/expo/`, que só liga as bibliotecas) e a tradução de erros do login, com 90% de cobertura.
