import { createHash } from 'node:crypto';

import { currentOrganizationId } from '../../../../shared/tenancy/tenant-context.js';
import { PasswordReset } from '../../domain/password-reset.js';
import type { PasswordResetSnapshot } from '../../domain/password-reset.js';
import { Session } from '../../domain/session.js';
import type { SessionSnapshot } from '../../domain/session.js';
import { User } from '../../domain/user.js';
import type { UserSnapshot } from '../../domain/user.js';
import type { IdentityDeps } from '../identity-deps.js';
import type { AccessTokenClaims, AuditAction } from '../ports.js';

/**
 * In-memory doubles for the identity ports. Tables are shared Maps; every read
 * filters by the current TenantContext, so the fakes behave like RLS does.
 */
interface Row {
  readonly organizationId: string;
}

class Table<S extends Row & { id: string }> {
  rows = new Map<string, S>();

  visible(): S[] {
    const org = currentOrganizationId();
    return [...this.rows.values()].filter((r) => r.organizationId === org);
  }

  get(id: string): S | undefined {
    const row = this.rows.get(id);
    return row && row.organizationId === currentOrganizationId() ? row : undefined;
  }

  put(row: S): void {
    if (row.organizationId !== currentOrganizationId()) {
      throw new Error('fake RLS: row of another organization');
    }
    this.rows.set(row.id, row);
  }
}

export interface AuditEntry {
  organizationId: string;
  action: AuditAction;
  actorUserId: string | null;
  entityId: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export const createFakes = (options: { now?: Date } = {}) => {
  let now = options.now ?? new Date('2026-11-04T12:00:00Z');
  let idCounter = 0;
  let tokenCounter = 0;

  const users = new Table<UserSnapshot>();
  const sessions = new Table<SessionSnapshot>();
  const resets = new Table<PasswordResetSnapshot>();
  const organizations = new Map<string, { id: string; name: string; slug: string }>();
  const auditEntries: AuditEntry[] = [];
  const sentMail: { to: string; subject: string; text: string }[] = [];
  const hashCalls = { verify: 0 };

  const sha = (value: string) => createHash('sha256').update(value).digest('hex');

  const deps: IdentityDeps = {
    users: {
      findById: (id) => {
        const row = users.get(id);
        return Promise.resolve(row ? User.fromSnapshot(row) : undefined);
      },
      list: () => Promise.resolve(users.visible().map((r) => User.fromSnapshot(r))),
      add: (user) => {
        users.put(user.toSnapshot());
        return Promise.resolve();
      },
      save: (user) => {
        users.put(user.toSnapshot());
        return Promise.resolve();
      },
    },
    sessions: {
      findById: (id) => {
        const row = sessions.get(id);
        return Promise.resolve(row ? Session.fromSnapshot(row) : undefined);
      },
      add: (session) => {
        sessions.put(session.toSnapshot());
        return Promise.resolve();
      },
      save: (session) => {
        sessions.put(session.toSnapshot());
        return Promise.resolve();
      },
      revokeFamily: (familyId, at) => {
        for (const row of sessions.visible().filter((s) => s.familyId === familyId)) {
          sessions.put({ ...row, revokedAt: row.revokedAt ?? at });
        }
        return Promise.resolve();
      },
      revokeAllForUser: (userId, at, opts) => {
        for (const row of sessions.visible().filter((s) => s.userId === userId)) {
          if (row.familyId !== opts?.exceptFamilyId) {
            sessions.put({ ...row, revokedAt: row.revokedAt ?? at });
          }
        }
        return Promise.resolve();
      },
    },
    passwordResets: {
      findById: (id) => {
        const row = resets.get(id);
        return Promise.resolve(row ? PasswordReset.fromSnapshot(row) : undefined);
      },
      add: (reset) => {
        resets.put(reset.toSnapshot());
        return Promise.resolve();
      },
      save: (reset) => {
        resets.put(reset.toSnapshot());
        return Promise.resolve();
      },
    },
    organizations: {
      add: (org) => {
        organizations.set(org.id, { id: org.id, name: org.name, slug: org.slug });
        return Promise.resolve();
      },
    },
    lookup: {
      findUserByEmail: (email) => {
        const row = [...users.rows.values()].find((u) => u.email === email);
        return Promise.resolve(row && { userId: row.id, organizationId: row.organizationId });
      },
      findSessionByTokenHash: (hash) => {
        const row = [...sessions.rows.values()].find((s) => s.tokenHash === hash);
        return Promise.resolve(row && { sessionId: row.id, organizationId: row.organizationId });
      },
      findPasswordResetByTokenHash: (hash) => {
        const row = [...resets.rows.values()].find((r) => r.tokenHash === hash);
        return Promise.resolve(row && { resetId: row.id, organizationId: row.organizationId });
      },
    },
    tx: {
      // Commits unless the work throws, like a real transaction.
      run: async (work) => {
        currentOrganizationId();
        const backup = {
          users: new Map(users.rows),
          sessions: new Map(sessions.rows),
          resets: new Map(resets.rows),
        };
        const auditLength = auditEntries.length;
        try {
          return await work();
        } catch (error) {
          users.rows = backup.users;
          sessions.rows = backup.sessions;
          resets.rows = backup.resets;
          auditEntries.length = auditLength;
          throw error;
        }
      },
    },
    audit: {
      record: (entry) => {
        auditEntries.push({ organizationId: currentOrganizationId(), ...entry });
        return Promise.resolve();
      },
    },
    hasher: {
      hash: (password) => Promise.resolve(`hashed:${password}`),
      verify: (hash, password) => {
        hashCalls.verify += 1;
        return Promise.resolve(hash === `hashed:${password}`);
      },
    },
    tokens: {
      generate: () => {
        tokenCounter += 1;
        return `token-${String(tokenCounter).padStart(40, '0')}`;
      },
      hash: sha,
    },
    accessTokens: {
      issue: (claims: AccessTokenClaims, at: Date) =>
        Promise.resolve({
          token: `jwt:${JSON.stringify(claims)}`,
          expiresAt: new Date(at.getTime() + 15 * 60 * 1000),
        }),
      verify: (token) =>
        Promise.resolve(
          token.startsWith('jwt:') ? (JSON.parse(token.slice(4)) as AccessTokenClaims) : undefined,
        ),
    },
    mailer: {
      send: (message) => {
        sentMail.push(message);
        return Promise.resolve();
      },
    },
    clock: { now: () => now },
    ids: {
      next: () => {
        idCounter += 1;
        return `0193a000-0000-7000-8000-${String(idCounter).padStart(12, '0')}`;
      },
    },
    settings: { panelUrl: 'https://painel.example.com' },
  };

  return {
    deps,
    tables: { users, sessions, resets, organizations },
    auditEntries,
    sentMail,
    hashCalls,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};

export type Fakes = ReturnType<typeof createFakes>;
