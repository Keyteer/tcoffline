import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getServerUrl,
  getServerUrlSync,
  setServerUrl,
  clearServerUrl,
  hasStoredServerUrl,
  loadServerUrl,
  testConnection,
} from '../serverConfig';

beforeEach(async () => {
  jest.clearAllMocks();
  // Reset the cached url by clearing
  await clearServerUrl();
});

describe('serverConfig', () => {
  describe('getServerUrl', () => {
    it('returns default when nothing is stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const url = await getServerUrl();
      expect(url).toMatch(/^http/);
    });

    it('returns stored URL', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('http://192.168.1.100:8000');
      const url = await loadServerUrl();
      expect(url).toBe('http://192.168.1.100:8000');
      // After loading, sync access should also work
      expect(getServerUrlSync()).toBe('http://192.168.1.100:8000');
    });
  });

  describe('setServerUrl', () => {
    it('stores URL and strips trailing slashes', async () => {
      await setServerUrl('http://10.0.0.1:8000///');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.any(String),
        'http://10.0.0.1:8000',
      );
      expect(getServerUrlSync()).toBe('http://10.0.0.1:8000');
    });
  });

  describe('clearServerUrl', () => {
    it('resets cached URL', async () => {
      await setServerUrl('http://custom:8000');
      await clearServerUrl();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('hasStoredServerUrl', () => {
    it('returns false when no custom URL', () => {
      expect(hasStoredServerUrl()).toBe(false);
    });

    it('returns true after storing custom URL', async () => {
      await setServerUrl('http://custom:9000');
      expect(hasStoredServerUrl()).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('returns true when /health returns ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      const result = await testConnection('http://localhost:8000');
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/health',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('returns false on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const result = await testConnection('http://bad-host:8000');
      expect(result).toBe(false);
    });

    it('returns false when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      const result = await testConnection('http://localhost:8000');
      expect(result).toBe(false);
    });
  });
});
