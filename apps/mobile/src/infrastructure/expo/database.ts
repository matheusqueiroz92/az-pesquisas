import * as Crypto from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { v7 as uuidv7 } from 'uuid';

import { openEncryptedDatabase } from '../encrypted-database';
import type { OpenedDatabase, SqlDatabase } from '../encrypted-database';
import { getOrCreateDatabaseKey } from '../secure-storage';
import { expoSecureKeyValue } from './secure-key-value';

const DATABASE_NAME = 'az-pesquisas.db';

/** expo-sqlite's database seen through the SqlDatabase port. */
const adapt = (db: SQLiteDatabase): SqlDatabase => ({
  execAsync: (sql) => db.execAsync(sql),
  runAsync: (sql, params) => db.runAsync(sql, [...params]),
  getFirstAsync: (sql) => db.getFirstAsync(sql),
  withTransactionAsync: (task) => db.withTransactionAsync(task),
  closeAsync: () => db.closeAsync(),
});

export const openAppDatabase = (): Promise<OpenedDatabase> =>
  openEncryptedDatabase({
    open: async () => adapt(await openDatabaseAsync(DATABASE_NAME)),
    getKey: () => getOrCreateDatabaseKey(expoSecureKeyValue, (size) => Crypto.getRandomBytes(size)),
    newInstallationId: () => uuidv7({ random: Crypto.getRandomBytes(16) }),
    now: () => new Date().toISOString(),
  });
