import { describe, expect, it } from 'vitest';

import { t } from './i18n';
import { pairMessage } from './pair-message';

describe('pairMessage', () => {
  it.each([
    [{ kind: 'invalid-code' } as const, t.pair.invalidCode],
    [{ kind: 'rate-limited' } as const, t.pair.rateLimited],
    [{ kind: 'offline' } as const, t.pair.offline],
    [{ kind: 'server' } as const, t.pair.server],
  ])('%o', (error, message) => {
    expect(pairMessage(error)).toBe(message);
  });
});
