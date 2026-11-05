import Constants from 'expo-constants';

import { createSessionService } from '../application/session-service';
import { createHttpAuthGateway } from '../infrastructure/http-auth-gateway';
import { createSecureSessionStore } from '../infrastructure/secure-storage';
import { expoSecureKeyValue } from '../infrastructure/expo/secure-key-value';

/**
 * Composition root: the only place where screens meet infrastructure.
 * Rule 16: the API address is fixed at build time. 10.0.2.2 is the developer's
 * PC as seen from the Android emulator.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export const sessionService = createSessionService({
  gateway: createHttpAuthGateway({ apiUrl: API_URL, fetch: (url, init) => fetch(url, init) }),
  store: createSecureSessionStore(expoSecureKeyValue),
  clock: { now: () => Date.now() },
});

export { openAppDatabase } from '../infrastructure/expo/database';
