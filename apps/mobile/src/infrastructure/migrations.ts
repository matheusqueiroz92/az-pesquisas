import type { SqlDatabase } from './sql-database';

export interface MigrationContext {
  readonly newInstallationId: () => string;
  readonly now: () => string;
}

/**
 * Local schema, in order. Index + 1 = the `PRAGMA user_version` after it runs.
 * Never edit an applied migration: add a new one (devices in the field already ran it).
 * Real tables (surveys, interviews) arrive in F1, with Drizzle (ADR-0009).
 */
export const MIGRATIONS: readonly ((db: SqlDatabase, ctx: MigrationContext) => Promise<void>)[] = [
  async (db, ctx) => {
    await db.execAsync(
      'CREATE TABLE installation (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL) STRICT',
    );
    await db.runAsync('INSERT INTO installation (id, created_at) VALUES (?, ?)', [
      ctx.newInstallationId(),
      ctx.now(),
    ]);
  },
];
