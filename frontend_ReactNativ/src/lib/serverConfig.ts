import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SERVER_URL, CONNECTION_TEST_TIMEOUT } from '../config/env';

const SERVER_URL_KEY = 'trakcare_server_url';
/** Key that records which default URL was active when the user last saved nothing. */
const SERVER_URL_DEFAULT_SNAPSHOT_KEY = 'trakcare_server_url_default_snapshot';

let cachedServerUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  if (stored) {
    // If the stored URL was never explicitly set by the user (it equals the
    // snapshot of the default from the previous build), discard it so the
    // current EXPO_PUBLIC_SERVER_URL takes effect automatically.
    const snapshot = await AsyncStorage.getItem(SERVER_URL_DEFAULT_SNAPSHOT_KEY);
    if (snapshot && stored === snapshot && stored !== DEFAULT_SERVER_URL) {
      await AsyncStorage.removeItem(SERVER_URL_KEY);
      await AsyncStorage.removeItem(SERVER_URL_DEFAULT_SNAPSHOT_KEY);
      cachedServerUrl = DEFAULT_SERVER_URL;
    } else {
      cachedServerUrl = stored;
    }
  } else {
    cachedServerUrl = DEFAULT_SERVER_URL;
  }
  return cachedServerUrl as string;
}

/** Synchronous access to the cached URL (returns default if not yet loaded) */
export function getServerUrlSync(): string {
  return cachedServerUrl || DEFAULT_SERVER_URL;
}

export async function setServerUrl(url: string): Promise<void> {
  // Remove trailing slash
  const normalized = url.replace(/\/+$/, '');
  cachedServerUrl = normalized;
  await AsyncStorage.setItem(SERVER_URL_KEY, normalized);
  // Clear the default-snapshot so this explicit URL is never auto-discarded
  await AsyncStorage.removeItem(SERVER_URL_DEFAULT_SNAPSHOT_KEY);
}

export async function clearServerUrl(): Promise<void> {
  cachedServerUrl = null;
  await AsyncStorage.removeItem(SERVER_URL_KEY);
}

export function hasStoredServerUrl(): boolean {
  return cachedServerUrl !== null && cachedServerUrl !== DEFAULT_SERVER_URL;
}

export async function loadServerUrl(): Promise<string> {
  return getServerUrl();
}

export async function testConnection(url: string): Promise<boolean> {
  try {
    const normalized = url.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT);
    const response = await fetch(`${normalized}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
