import { describe, expect, it } from 'vitest';

import { t } from './i18n';
import { signInMessage } from './sign-in-message';

describe('signInMessage', () => {
  it.each([
    [{ kind: 'offline' } as const, t.errors.offline],
    [{ kind: 'server', status: 503 } as const, t.errors.server],
    [{ kind: 'role-not-allowed' } as const, t.errors.roleNotAllowed],
    [
      { kind: 'rejected', status: 401, code: 'INVALID_CREDENTIALS' } as const,
      t.errors.invalidCredentials,
    ],
    [
      { kind: 'rejected', status: 400, code: 'VALIDATION_FAILED' } as const,
      t.errors.invalidCredentials,
    ],
    [{ kind: 'rejected', status: 429, code: undefined } as const, t.errors.rateLimited],
    [{ kind: 'rejected', status: 403, code: 'FORBIDDEN' } as const, t.errors.generic],
  ])('%o', (error, message) => {
    expect(signInMessage(error)).toBe(message);
  });
});
