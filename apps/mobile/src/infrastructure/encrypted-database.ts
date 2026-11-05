import { MIGRATIONS } from './migrations';
import type { MigrationContext } from './migrations';
import type { SqlDatabase } from './sql-database';

export type { SqlDatabase } from './sql-database';

export class DatabaseNotEncryptedError extends Error {
  constructor() {
    super('SQLCipher is not available in this build: refusing to store data unencrypted');
    this.name = 'DatabaseNotEncryptedError';
  }
}

export interface OpenedDatabase<D extends SqlDatabase = SqlDatabase> {
  readonly db: D;
  readonly cipherVersion: string;
  readonly schemaVersion: number;
}

const HEX_KEY = /^[0-9a-f]{64}$/;

/**
 * Spec 008, rules 1-3. Order matters:
 * 1. `PRAGMA key` with the raw 256-bit key, before anything else;
 * 2. `PRAGMA cipher_version`: empty means plain SQLite, so close and fail (a build
 *    without SQLCipher silently ignores the key and would write plaintext);
 * 3. WAL, then pending migrations in one exclusive transaction.
 */
export const openEncryptedDatabase = async <D extends SqlDatabase>(
  deps: {
    open: () => Promise<D>;
    getKey: () => Promise<string>;
  } & MigrationContext,
): Promise<OpenedDatabase<D>> => {
  const key = await deps.getKey();
  if (!HEX_KEY.test(key)) {
    throw new Error('Database key is not 64 hex characters');
  }
  const db = await deps.open();
  await db.execAsync(`PRAGMA key = "x'${key}'"`);

  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) {
    await db.closeAsync();
    throw new DatabaseNotEncryptedError();
  }

  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > MIGRATIONS.length) {
    throw new Error(`Local database is newer (v${current}) than this app (v${MIGRATIONS.length})`);
  }
  if (current < MIGRATIONS.length) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const migrate of MIGRATIONS.slice(current)) {
        await migrate(txn, deps);
      }
      await txn.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
    });
  }
  return { db, cipherVersion: cipher.cipher_version, schemaVersion: MIGRATIONS.length };
};
