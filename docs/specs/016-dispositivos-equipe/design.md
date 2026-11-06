# Design 016 — Dispositivos e equipe

## Contratos

- `packages/contracts/src/devices.ts`: painel (geração de código, status da vinculação, lista, renomear, equipe da pesquisa).
- O app usa os contratos da spec 006 em `sync.ts`: `PairDeviceRequest`, `PairDeviceResponse`, `HeartbeatRequest`, `HeartbeatResponse`. O token do aparelho vai em `Authorization: Bearer`.
- Erros novos: `DEVICE_NOT_FOUND`, `DEVICE_REVOKED`, `PAIRING_NOT_FOUND`, `PAIRING_CODE_INVALID`, `DEVICE_TOKEN_INVALID`, `INTERVIEWER_NOT_FOUND`, `SURVEY_NOT_ASSIGNABLE`.

## Contexto `devices` (API)

- Domínio: `Device` (parear, renomear, revogar, `touch` no heartbeat) e `Pairing` (`status(now)`, `consume`).
- Casos de uso: `createPairing` (até 5 tentativas de código livre), `getPairing`, `pairDevice` (público), `listDevices`, `renameDevice`, `revokeDevice` (também tira o aparelho das equipes), `heartbeat`, `getSurveyTeam`, `updateSurveyTeam`.
- Portas: `Secrets` (sha256 + código aleatório), `CrossTenantLookup` (funções SECURITY DEFINER), `SurveyDirectory` e `PeopleDirectory` (diretórios públicos dos contextos `surveys` e `identity`), `AuditAction`.
- Rotas do painel (`devices.manage`): `GET /v1/devices`, `POST /v1/devices/pairings`, `GET /v1/devices/pairings/:id`, `PATCH /v1/devices/:id`, `POST /v1/devices/:id/revoke`, `GET|PUT /v1/surveys/:id/team`.
- Rotas do app (públicas, com limite): `POST /v1/devices/pair` (10/min), `POST /v1/device/heartbeat` (60/min, Bearer).

## Banco

- Migração 0011: `devices`, `device_pairings`, `survey_devices`, `survey_interviewers`, com FKs compostas `(organization_id, x_id)`.
- Migração 0012: checks, RLS nas 4 tabelas, `devices_find_pending_pairing(text)` e `devices_find_by_token_hash(text)`. O app ainda não tem organização quando pareia ou manda heartbeat, então a busca cruza empresas por função que devolve só ids, com `search_path` fixo.
- Guardamos só hashes do código e do token. Índice único parcial no hash do código enquanto não consumido.

## Painel

- `/dispositivos`: tabela, diálogo de vinculação que consulta o status a cada 3 s, renomear e revogar.
- `/pesquisas/[id]/equipe`: duas listas de marcação (aparelhos ativos e pesquisadores ativos). Travada para pesquisa encerrada ou arquivada.

## App

- `DeviceService` (aplicação): `pair` normaliza o código, chama o gateway e guarda o resultado no SecureStore (`az.device.v1`); `check` manda o heartbeat e, com 401, esquece o aparelho.
- Sessão: sem aparelho vinculado o app abre em `vincular`; vinculado e sem login, em `entrar`. Revogado no painel → volta para `vincular` na próxima abertura com internet.
