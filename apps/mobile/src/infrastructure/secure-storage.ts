import { TokenResponse } from '@az-pesquisas/contracts';

import type { SessionStore } from '../application/ports';
import type { Session } from '../domain/session';

/** The SecureStore, as a port (Keychain on iOS, Keystore-backed on Android). */
export interface SecureKeyValue {
  readonly get: (key: string) => Promise<string | null>;
  readonly set: (key: string, value: string) => Promise<void>;
  readonly remove: (key: string) => Promise<void>;
}

export const SESSION_KEY = 'az.session.v1';
export const DATABASE_KEY = 'az.db-key.v1';

/** Session in the SecureStore (rule 5). A corrupt or outdated entry is dropped, not trusted. */
export const createSecureSessionStore = (kv: SecureKeyValue): SessionStore => ({
  load: async () => {
    const raw = await kv.get(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    try {
      return TokenResponse.parse(JSON.parse(raw));
    } catch {
      await kv.remove(SESSION_KEY);
      return null;
    }
  },
  save: (session: Session) => kv.set(SESSION_KEY, JSON.stringify(session)),
  clear: () => kv.remove(SESSION_KEY),
});

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Rule 1: 256 random bits per installation, created once, kept only in the SecureStore. */
export const getOrCreateDatabaseKey = async (
  kv: SecureKeyValue,
  randomBytes: (size: number) => Uint8Array,
): Promise<string> => {
  const existing = await kv.get(DATABASE_KEY);
  if (existing !== null) {
    return existing;
  }
  const key = toHex(randomBytes(32));
  await kv.set(DATABASE_KEY, key);
  return key;
};
