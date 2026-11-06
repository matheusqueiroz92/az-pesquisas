import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createDeviceService } from '../application/device-service';
import type { DeviceInfo } from '../application/device-service';
import { createSessionService } from '../application/session-service';
import { createHttpAuthGateway } from '../infrastructure/http-auth-gateway';
import { createHttpDeviceGateway } from '../infrastructure/http-device-gateway';
import {
  createSecureDeviceStore,
  createSecureSessionStore,
} from '../infrastructure/secure-storage';
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

const constants = Platform.constants as {
  readonly Brand?: string;
  readonly Model?: string;
  readonly interfaceIdiom?: string;
};

/** What the API records about this device when it is paired (spec 016 rule 3). */
const deviceInfo: DeviceInfo = {
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  model:
    Platform.OS === 'ios'
      ? constants.interfaceIdiom === 'pad'
        ? 'iPad'
        : 'iPhone'
      : [constants.Brand, constants.Model].filter(Boolean).join(' ') || 'Android',
  osVersion: String(Platform.Version),
  appVersion: APP_VERSION,
};

export const deviceService = createDeviceService({
  gateway: createHttpDeviceGateway({ apiUrl: API_URL, fetch: (url, init) => fetch(url, init) }),
  store: createSecureDeviceStore(expoSecureKeyValue),
  info: deviceInfo,
});

export { openAppDatabase } from '../infrastructure/expo/database';
