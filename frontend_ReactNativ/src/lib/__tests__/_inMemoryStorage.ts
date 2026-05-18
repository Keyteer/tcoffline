/**
 * Stateful in-memory AsyncStorage backing for tests.
 *
 * The global mock in `jest.setup.js` returns null for every call. Tests that
 * need real round-trip behaviour (localStore, outbox, api) install this helper
 * in their own `beforeEach`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export function installInMemoryAsyncStorage() {
  const store = new Map<string, string>();

  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(store.has(key) ? store.get(key)! : null),
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  });
  (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
    store.delete(key);
    return Promise.resolve();
  });

  // localStore.clearAll uses these — install only if available on the mock
  (AsyncStorage as any).getAllKeys = jest.fn(() => Promise.resolve(Array.from(store.keys())));
  (AsyncStorage as any).multiRemove = jest.fn((keys: string[]) => {
    keys.forEach((k) => store.delete(k));
    return Promise.resolve();
  });

  return store;
}
