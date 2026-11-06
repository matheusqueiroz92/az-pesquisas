import type { PairError } from '../application/device-service';
import { t } from './i18n';

/** Rule 4 of spec 016: wrong, expired and used codes look the same. */
export const pairMessage = (error: PairError): string => {
  switch (error.kind) {
    case 'invalid-code':
      return t.pair.invalidCode;
    case 'rate-limited':
      return t.pair.rateLimited;
    case 'offline':
      return t.pair.offline;
    case 'server':
      return t.pair.server;
  }
};
