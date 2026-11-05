import { describe, expect, it, vi } from 'vitest';

import { DatabaseNotEncryptedError, openEncryptedDatabase } from './encrypted-database';
import type { SqlDatabase } from './encrypted-database';
import { MIGRATIONS } from './migrations';

const KEY = 'a'.repeat(64);

/** Records every statement; answers the PRAGMAs the opener asks. */
const fakeDatabase = (options: { cipher?: boolean; userVersion?: number } = {}) => {
  const log: string[] = [];
  let userVersion = options.userVersion ?? 0;
  const db: SqlDatabase = {
    execAsync: vi.fn((sql: string) => {
      log.push(sql.trim());
      const set = /PRAGMA user_version = (\d+)/.exec(sql);
      if (set?.[1]) {
        userVersion = Number(set[1]);
      }
      return Promise.resolve();
    }),
    getFirstAsync: vi.fn((sql: string): Promise<unknown> => {
      log.push(sql.trim());
      if (sql.includes('cipher_version')) {
        return Promise.resolve(options.cipher === false ? null : { cipher_version: '4.6.1' });
      }
      if (sql.includes('user_version')) {
        return Promise.resolve({ user_version: userVersion });
      }
      return Promise.resolve(null);
    }) as SqlDatabase['getFirstAsync'],
    runAsync: vi.fn((sql: string) => {
      log.push(sql.trim());
      return Promise.resolve();
    }),
    withExclusiveTransactionAsync: vi.fn(async (task: (txn: SqlDatabase) => Promise<void>) => {
      log.push('BEGIN');
      await task(db);
      log.push('COMMIT');
    }),
    closeAsync: vi.fn(() => Promise.resolve()),
  };
  return { db, log };
};

const open = (db: SqlDatabase) =>
  openEncryptedDatabase({
    open: () => Promise.resolve(db),
    getKey: () => Promise.resolve(KEY),
    newInstallationId: () => '0190a5c4-0000-7000-8000-00000000abcd',
    now: () => '2026-11-05T12:00:00.000Z',
  });

describe('openEncryptedDatabase (spec 008, rules 1-3)', () => {
  it('sends the raw key as the very first statement', async () => {
    const { db, log } = fakeDatabase();
    await open(db);
    expect(log[0]).toBe(`PRAGMA key = "x'${KEY}'"`);
  });

  it('fails closed when the binary has no SQLCipher (CA-05)', async () => {
    const { db } = fakeDatabase({ cipher: false });
    await expect(open(db)).rejects.toBeInstanceOf(DatabaseNotEncryptedError);
    expect(db.closeAsync).toHaveBeenCalled();
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('never puts the key in the error', async () => {
    const { db } = fakeDatabase({ cipher: false });
    const error = await open(db).catch((e: unknown) => e);
    expect((error as Error).message).not.toContain(KEY);
  });

  it('turns on WAL and applies every migration in one transaction, recording the version', async () => {
    const { db, log } = fakeDatabase();
    const result = await open(db);
    expect(log).toContain('PRAGMA journal_mode = WAL');
    const begin = log.indexOf('BEGIN');
    expect(begin).toBeGreaterThan(log.indexOf('PRAGMA journal_mode = WAL'));
    expect(log.slice(begin)).toContain(`PRAGMA user_version = ${MIGRATIONS.length}`);
    expect(log.indexOf('COMMIT')).toBeGreaterThan(begin);
    expect(result.cipherVersion).toBe('4.6.1');
    expect(result.schemaVersion).toBe(MIGRATIONS.length);
  });

  it('records the installation once, on the first migration', async () => {
    const { db } = fakeDatabase();
    await open(db);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO installation'), [
      '0190a5c4-0000-7000-8000-00000000abcd',
      '2026-11-05T12:00:00.000Z',
    ]);
  });

  it('skips migrations already applied', async () => {
    const { db } = fakeDatabase({ userVersion: MIGRATIONS.length });
    await open(db);
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('refuses a database newer than this app (downgrade)', async () => {
    const { db } = fakeDatabase({ userVersion: MIGRATIONS.length + 1 });
    await expect(open(db)).rejects.toThrow('newer');
  });

  it('refuses a malformed key before touching the database', async () => {
    const { db } = fakeDatabase();
    await expect(
      openEncryptedDatabase({
        open: () => Promise.resolve(db),
        getKey: () => Promise.resolve("x'; DROP"),
        newInstallationId: () => 'id',
        now: () => 'now',
      }),
    ).rejects.toThrow('key');
    expect(db.execAsync).not.toHaveBeenCalled();
  });
});
