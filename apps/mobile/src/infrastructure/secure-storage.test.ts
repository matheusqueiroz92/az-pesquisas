import { describe, expect, it, vi } from 'vitest';

import {
  createSecureDeviceStore,
  createSecureSessionStore,
  DATABASE_KEY,
  DEVICE_KEY,
  getOrCreateDatabaseKey,
  SESSION_KEY,
} from './secure-storage';
import type { SecureKeyValue } from './secure-storage';

const memoryKv = (
  initial: Record<string, string> = {},
): SecureKeyValue & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (k) => Promise.resolve(data.get(k) ?? null),
    set: (k, v) => {
      data.set(k, v);
      return Promise.resolve();
    },
    remove: (k) => {
      data.delete(k);
      return Promise.resolve();
    },
  };
};

const SESSION = {
  accessToken: 'at',
  accessTokenExpiresAt: '2026-11-05T12:15:00.000Z',
  refreshToken: 'rt',
  refreshTokenExpiresAt: '2026-12-05T12:00:00.000Z',
  user: {
    id: '0190a5c4-0000-7000-8000-000000000001',
    organizationId: '0190a5c4-0000-7000-8000-000000000002',
    name: 'Paula',
    email: 'paula@az.test',
    role: 'interviewer' as const,
  },
};

describe('SecureSessionStore', () => {
  it('saves, loads and clears the session', async () => {
    const kv = memoryKv();
    const store = createSecureSessionStore(kv);
    expect(await store.load()).toBeNull();
    await store.save(SESSION);
    expect(await store.load()).toEqual(SESSION);
    await store.clear();
    expect(kv.data.has(SESSION_KEY)).toBe(false);
  });

  it('drops a corrupt or outdated entry instead of trusting it', async () => {
    for (const bad of ['{not json', JSON.stringify({ accessToken: 'only' })]) {
      const kv = memoryKv({ [SESSION_KEY]: bad });
      expect(await createSecureSessionStore(kv).load()).toBeNull();
      expect(kv.data.has(SESSION_KEY)).toBe(false);
    }
  });
});

const DEVICE = {
  deviceId: '0190a5c4-0000-7000-8000-000000000003',
  deviceToken: 'd'.repeat(43),
  organization: { id: '0190a5c4-0000-7000-8000-000000000002', name: 'Instituto AZ' },
};

describe('SecureDeviceStore', () => {
  it('saves, loads and clears the pairing', async () => {
    const kv = memoryKv();
    const store = createSecureDeviceStore(kv);
    expect(await store.load()).toBeNull();
    await store.save(DEVICE);
    expect(await store.load()).toEqual(DEVICE);
    await store.clear();
    expect(kv.data.has(DEVICE_KEY)).toBe(false);
  });

  it('drops a corrupt entry: the app asks for a new code', async () => {
    for (const bad of ['{not json', JSON.stringify({ deviceId: 'x' })]) {
      const kv = memoryKv({ [DEVICE_KEY]: bad });
      expect(await createSecureDeviceStore(kv).load()).toBeNull();
      expect(kv.data.has(DEVICE_KEY)).toBe(false);
    }
  });
});

describe('getOrCreateDatabaseKey', () => {
  it('creates 256 random bits as 64 hex characters, once', async () => {
    const kv = memoryKv();
    const random = vi.fn((size: number) => new Uint8Array(size).fill(0xab));
    const first = await getOrCreateDatabaseKey(kv, random);
    expect(first).toBe('ab'.repeat(32));
    expect(random).toHaveBeenCalledWith(32);
    expect(await getOrCreateDatabaseKey(kv, random)).toBe(first);
    expect(random).toHaveBeenCalledTimes(1);
    expect(kv.data.get(DATABASE_KEY)).toBe(first);
  });

  it('pads small bytes with a leading zero', async () => {
    const key = await getOrCreateDatabaseKey(memoryKv(), (size) => new Uint8Array(size).fill(0x05));
    expect(key).toBe('05'.repeat(32));
  });
});
