# Design 005 — Identidade e acesso

- Papel: Domain Architect
- Spec: [spec.md](./spec.md)
- Precisa de aprovação humana? Sim (segurança, contratos e migração).

## O problema do login com RLS

Para achar o usuário pelo e-mail, a API ainda não sabe a organização, e o RLS esconde todas as linhas. A solução é uma exceção estreita e auditável: três funções `SECURITY DEFINER` (donas: `az_owner`) que devolvem **só identificadores**:

| Função                                  | Recebe                          | Devolve                         |
| --------------------------------------- | ------------------------------- | ------------------------------- |
| `auth_find_user_by_email(email)`        | e-mail normalizado              | `user_id`, `organization_id`    |
| `auth_find_session_by_token_hash(hash)` | SHA-256 do refresh token        | `session_id`, `organization_id` |
| `auth_find_reset_by_token_hash(hash)`   | SHA-256 do token de redefinição | `token_id`, `organization_id`   |

Com o `organization_id` em mãos, o caso de uso entra em `runWithTenant()` e carrega o resto **pelo caminho normal, com RLS**. Nenhum hash de senha nem dado pessoal sai dessas funções. `EXECUTE` é revogado de `PUBLIC` e concedido só a `az_app`; `search_path` fixo.

## Modelo (contexto `identity`)

```
domain/
  email.ts                 # objeto de valor: normaliza e valida
  user.ts                  # agregado User
  session.ts               # agregado Session (refresh token com rotação)
  password-reset.ts        # agregado PasswordReset
  role.ts                  # reexporta Role e can() de contracts
  errors.ts
  *.repository.ts          # portas
application/
  ports.ts                 # PasswordHasher, AccessTokenIssuer, TokenGenerator, Clock, Mailer,
                           # AuthLookup, TransactionRunner, AuditLog
  commands/  login, refresh-session, logout, request-password-reset,
             confirm-password-reset, change-password, create-user, update-user,
             create-organization-with-admin
  queries/   get-me, list-users, get-user
infrastructure/
  schema.ts                # users, sessions, password_resets, audit_logs
  drizzle-*.repository.ts
  argon2-password-hasher.ts, jose-access-token-issuer.ts, crypto-token-generator.ts,
  file-mailer.ts, pg-auth-lookup.ts, drizzle-audit-log.ts
presentation/
  auth.controller.ts, users.controller.ts
  auth.guard.ts            # valida o JWT, preenche request.actor
  tenant.interceptor.ts    # roda o handler dentro de runWithTenant(actor.organizationId)
  require-permission.ts    # decorator + checagem pela matriz
  domain-error.mapper.ts   # erro de domínio -> HttpException { code, detail }
```

### Agregado `User`

- `User.register({ id, organizationId, name, email, role, passwordHash, now })`
- `user.verifyLoginAllowed(now)`: recusa se `disabled` ou `lockedUntil > now`.
- `user.recordFailedLogin(now)`: incrementa; na 5ª falha seguida define `lockedUntil = now + 15 min` e devolve o evento `AccountLocked`.
- `user.recordSuccessfulLogin(now)`: zera o contador, `lastLoginAt = now`.
- `user.changePassword(hash, now)`, `user.rename()`, `user.changeRole(role, actor)`, `user.disable(actor)`, `user.enable()`.
- Invariantes 6 da spec (admin não se desativa nem se rebaixa) ficam no agregado.

### Agregado `Session`

- `Session.start({ id, organizationId, userId, familyId, tokenHash, now, ttl })`
- `session.rotate(newTokenHash, now)`: só se ativa e não vencida; marca `rotatedAt`, devolve a próxima sessão da mesma família.
- Uso de uma sessão já rotacionada → `RefreshTokenReused`: o caso de uso revoga a família toda.

### Transações sem Drizzle na aplicação

A camada `application` não pode importar Drizzle (regra 3). Ela recebe uma porta `TransactionRunner.run(work)`; a implementação abre `withTenantTransaction` e guarda o `tx` num AsyncLocalStorage, de onde os repositórios Drizzle o leem. Repositório chamado fora de uma transação lança erro.

## Contratos (`packages/contracts`, novo pacote)

- `auth.ts`: `LoginRequest`, `RefreshRequest`, `TokenResponse`, `MeResponse`, `PasswordResetRequest`, `PasswordResetConfirm`, `ChangePasswordRequest`.
- `users.ts`: `CreateUserRequest`, `UpdateUserRequest`, `UserView`, `UserListResponse`.
- `permissions.ts`: `ROLES`, `PERMISSIONS`, matriz `ROLE_PERMISSIONS`, `can(role, permission)`.
- `errors.ts`: `ERROR_CODES` (todos os `code` que a API pode devolver).

## API

| Método | Rota                              | Acesso                      | Resposta               |
| ------ | --------------------------------- | --------------------------- | ---------------------- |
| POST   | `/v1/auth/login`                  | público, 10/min por IP      | 200 `TokenResponse`    |
| POST   | `/v1/auth/refresh`                | público                     | 200 `TokenResponse`    |
| POST   | `/v1/auth/logout`                 | público (com refresh token) | 204                    |
| GET    | `/v1/auth/me`                     | logado                      | 200 `MeResponse`       |
| POST   | `/v1/auth/password`               | logado                      | 204                    |
| POST   | `/v1/auth/password-reset`         | público, 5/min por IP       | 202                    |
| POST   | `/v1/auth/password-reset/confirm` | público                     | 204                    |
| GET    | `/v1/users`                       | `users.manage`              | 200 `UserListResponse` |
| POST   | `/v1/users`                       | `users.manage`              | 201 `UserView`         |
| GET    | `/v1/users/{id}`                  | `users.manage`              | 200 `UserView`         |
| PATCH  | `/v1/users/{id}`                  | `users.manage`              | 200 `UserView`         |

Tokens vão no corpo da resposta: quem guarda em cookie httpOnly é o BFF do painel (spec 007). O access token vem em `Authorization: Bearer`.

**JWT**: HS256 com `JWT_SECRET` (mínimo 32 caracteres), `iss = az-pesquisas`, `aud = az-pesquisas-api`, claims `sub` (usuário), `org`, `role`, `sid` (sessão). Sem estado: revogar a sessão impede o refresh, e o access token já emitido expira em até 15 min. Aceitável para o painel; reavaliar se surgir necessidade de corte imediato.

## Banco

| Tabela            | Destaques                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `users`           | `email` com índice único global; `role`, `status`, `failed_login_attempts`, `locked_until`, `last_login_at`      |
| `sessions`        | `family_id`, `token_hash` único, `expires_at`, `rotated_at`, `revoked_at`                                        |
| `password_resets` | `token_hash` único, `expires_at`, `used_at`                                                                      |
| `audit_logs`      | `actor_user_id` nulo, `action`, `entity`, `entity_id`, `metadata jsonb`; `REVOKE UPDATE, DELETE ... FROM az_app` |

Todas com `organization_id`, RLS e política `tenant_isolation` (a trava da spec 004 cobre).

## Configuração nova

`JWT_SECRET` (obrigatória, ≥ 32 caracteres), `PANEL_URL` (padrão `http://localhost:3001`, usado no link de redefinição), `MAIL_DIR` (padrão `.mail`, onde o `FileMailer` grava e-mails no ambiente local).

## Riscos e decisões

- **E-mail único global** impede a mesma pessoa em dois institutos com o mesmo e-mail. Para o SaaS, resolve-se depois com seleção de organização no login; hoje simplifica tudo.
- **Mensagem genérica no bloqueio**: o usuário bloqueado não sabe que foi bloqueado. É o preço de não confirmar quais e-mails existem; o painel mostra "Se você errou a senha várias vezes, aguarde 15 minutos".
- **Renovações simultâneas com o mesmo refresh token** (duas abas do painel ao mesmo tempo): a segunda é tratada como reuso e a sessão inteira é revogada. Isso é o comportamento seguro e está coberto por teste. Consequência para a spec 007: o BFF do painel precisa fazer a renovação uma por vez por navegador (_single-flight_). Se isso não bastar, avaliar uma janela de tolerância de poucos segundos num ADR.
- **Envio de e-mail em produção** depende do adaptador SMTP (antes do deploy, spec 010).
