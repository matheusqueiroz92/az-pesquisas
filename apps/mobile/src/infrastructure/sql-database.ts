/** The part of expo-sqlite's SQLiteDatabase we use (a port, so it can be tested off-device). */
export interface SqlDatabase {
  readonly execAsync: (sql: string) => Promise<void>;
  readonly runAsync: (sql: string, params: readonly (string | number | null)[]) => Promise<unknown>;
  readonly getFirstAsync: <T>(sql: string) => Promise<T | null>;
  /**
   * A transaction on THIS connection. Never expo-sqlite's withExclusiveTransactionAsync:
   * it opens a new connection, which does not have the SQLCipher key and cannot read
   * the encrypted file (spec 008, found on the first device run).
   */
  readonly withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
  readonly closeAsync: () => Promise<void>;
}
