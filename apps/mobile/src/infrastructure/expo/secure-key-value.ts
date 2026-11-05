import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValue } from '../secure-storage';

// Only while the device is unlocked, never migrated to another device or backup (spec 008, rule 1).
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const expoSecureKeyValue: SecureKeyValue = {
  get: (key) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};
