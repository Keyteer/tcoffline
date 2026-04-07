import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'trakcare_server_url';
const DEFAULT_SERVER_URL = 'http://localhost:8000';

let cachedServerUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  cachedServerUrl = stored || DEFAULT_SERVER_URL;
  return cachedServerUrl;
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
}

export async function testConnection(url: string): Promise<boolean> {
  try {
    const normalized = url.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${normalized}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
