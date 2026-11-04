# ADR-0009 — App em Expo com SQLite criptografado

- Status: aceita
- Data: 2026-11-03

## Contexto

O app roda em tablets Android da empresa e, como reserva, em iPhones da equipe. Precisa funcionar dias sem internet e guarda opinião política e localização. A equipe não tem Mac.

## Decisão

- Expo com development build e expo-router.
- `expo-sqlite` com SQLCipher; chave aleatória por instalação guardada no SecureStore.
- Drizzle sobre o SQLite, mesma linguagem de consulta da API.
- Builds Android e iOS pelo EAS (sem Mac); correções de JavaScript por EAS Update.

## Consequências

- Tablet perdido não expõe dados legíveis.
- Distribuição: lojas oficiais (App Store como app não listado; Google Play com conta de organização) e APK direto como contingência.
