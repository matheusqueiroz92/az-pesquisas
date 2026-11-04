import type { Database } from '../../../shared/database/database.js';
import { createTransactionRunner } from '../../../shared/database/transaction-context.js';
import { newId } from '../../../shared/ids.js';
import type { IdentityDeps } from '../application/identity-deps.js';
import type { Mailer } from '../application/ports.js';
import {
  drizzleAuditLog,
  drizzleOrganizationRepository,
  drizzlePasswordResetRepository,
  drizzleSessionRepository,
  drizzleUserRepository,
} from './drizzle-repositories.js';
import {
  argon2PasswordHasher,
  createJoseAccessTokenIssuer,
  createPgAuthLookup,
  cryptoTokenGenerator,
} from './security-adapters.js';

export const createIdentityDeps = (options: {
  database: Database;
  jwtSecret: string;
  panelUrl: string;
  mailer: Mailer;
  clock?: IdentityDeps['clock'];
}): IdentityDeps => ({
  users: drizzleUserRepository,
  sessions: drizzleSessionRepository,
  passwordResets: drizzlePasswordResetRepository,
  organizations: drizzleOrganizationRepository,
  lookup: createPgAuthLookup(options.database),
  tx: createTransactionRunner(options.database),
  audit: drizzleAuditLog,
  hasher: argon2PasswordHasher,
  tokens: cryptoTokenGenerator,
  accessTokens: createJoseAccessTokenIssuer(options.jwtSecret),
  mailer: options.mailer,
  clock: options.clock ?? { now: () => new Date() },
  ids: { next: newId },
  settings: { panelUrl: options.panelUrl },
});
