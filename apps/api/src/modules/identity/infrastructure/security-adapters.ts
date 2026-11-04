import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ROLES } from '@az-pesquisas/contracts';
import type { Role } from '@az-pesquisas/contracts';
import { hash, verify } from '@node-rs/argon2';
import { jwtVerify, SignJWT } from 'jose';

import type { Database } from '../../../shared/database/database.js';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  AuthLookup,
  Mailer,
  PasswordHasher,
  TokenGenerator,
} from '../application/ports.js';

/**
 * Argon2id with the OWASP baseline (19 MiB, 2 iterations, 1 lane). Argon2id is the
 * library default (its enum is a const enum, not importable under verbatimModuleSyntax);
 * test/identity-db.db.test.ts asserts the stored hash starts with $argon2id$.
 */
export const argon2PasswordHasher: PasswordHasher = {
  hash: (password) =>
    hash(password, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    }),
  verify: async (passwordHash, password) => {
    try {
      return await verify(passwordHash, password);
    } catch {
      // A malformed hash in the database must read as "wrong password", never crash login.
      return false;
    }
  },
};

/** 32 random bytes (256 bits) as base64url; stored only as SHA-256 hex. */
export const cryptoTokenGenerator: TokenGenerator = {
  generate: () => randomBytes(32).toString('base64url'),
  hash: (token) => createHash('sha256').update(token).digest('hex'),
};

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const ISSUER = 'az-pesquisas';
const AUDIENCE = 'az-pesquisas-api';

const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

export const createJoseAccessTokenIssuer = (secret: string): AccessTokenIssuer => {
  const key = new TextEncoder().encode(secret);

  return {
    issue: async (claims: AccessTokenClaims, now: Date) => {
      const issuedAt = Math.floor(now.getTime() / 1000);
      const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;
      const token = await new SignJWT({
        org: claims.organizationId,
        role: claims.role,
        sid: claims.sessionId,
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(claims.userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(key);
      return { token, expiresAt: new Date(expiresAt * 1000) };
    },

    verify: async (token) => {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: ISSUER,
          audience: AUDIENCE,
          algorithms: ['HS256'],
        });
        const { sub, org, role, sid } = payload;
        if (typeof sub !== 'string' || typeof org !== 'string' || typeof sid !== 'string') {
          return undefined;
        }
        if (!isRole(role)) {
          return undefined;
        }
        return { userId: sub, organizationId: org, role, sessionId: sid };
      } catch {
        return undefined;
      }
    },
  };
};

/**
 * Local development only: writes each e-mail to a file in `dir` instead of
 * sending it. Tokens never go to logs (AGENTS.md rule 10). SMTP: spec 010.
 */
export const createFileMailer = (dir: string): Mailer => ({
  send: async (message) => {
    await mkdir(dir, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}.txt`;
    await writeFile(
      join(dir, name),
      `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
  },
});

/** Calls the three SECURITY DEFINER functions of migration 0003 (ids only). */
export const createPgAuthLookup = (database: Database): AuthLookup => ({
  findUserByEmail: (email) =>
    database.withoutTenant(async (client) => {
      const { rows } = await client.query<{ user_id: string; organization_id: string }>(
        'SELECT user_id, organization_id FROM auth_find_user_by_email($1)',
        [email],
      );
      const row = rows[0];
      return row && { userId: row.user_id, organizationId: row.organization_id };
    }),
  findSessionByTokenHash: (tokenHash) =>
    database.withoutTenant(async (client) => {
      const { rows } = await client.query<{ session_id: string; organization_id: string }>(
        'SELECT session_id, organization_id FROM auth_find_session_by_token_hash($1)',
        [tokenHash],
      );
      const row = rows[0];
      return row && { sessionId: row.session_id, organizationId: row.organization_id };
    }),
  findPasswordResetByTokenHash: (tokenHash) =>
    database.withoutTenant(async (client) => {
      const { rows } = await client.query<{ reset_id: string; organization_id: string }>(
        'SELECT reset_id, organization_id FROM auth_find_password_reset_by_token_hash($1)',
        [tokenHash],
      );
      const row = rows[0];
      return row && { resetId: row.reset_id, organizationId: row.organization_id };
    }),
});
