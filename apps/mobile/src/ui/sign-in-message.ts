import type { SignInError } from '../application/session-service';
import { t } from './i18n';

/** Rule 4: same generic messages as the panel. */
export const signInMessage = (error: SignInError): string => {
  switch (error.kind) {
    case 'offline':
      return t.errors.offline;
    case 'server':
      return t.errors.server;
    case 'role-not-allowed':
      return t.errors.roleNotAllowed;
    case 'rejected':
      if (error.status === 429 || error.code === 'RATE_LIMITED') {
        return t.errors.rateLimited;
      }
      // 400 (malformed e-mail) and 401 look the same: never reveal which field was wrong.
      return error.status === 400 || error.status === 401
        ? t.errors.invalidCredentials
        : t.errors.generic;
  }
};
