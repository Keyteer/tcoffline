import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { auth } from '../auth';

// Reset the in-memory cache before each test
beforeEach(async () => {
  jest.clearAllMocks();
  // Logout to clear the in-memory cache
  await auth.logout();
});

describe('auth', () => {
  describe('init', () => {
    it('loads tokens from storage into cache', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('access-token-123')  // ACCESS_TOKEN_KEY
        .mockResolvedValueOnce('refresh-token-456')  // REFRESH_TOKEN_KEY
        .mockResolvedValueOnce(JSON.stringify({ username: 'doc', role: 'user' }));  // USER_KEY

      await auth.init();

      expect(auth.getAccessToken()).toBe('access-token-123');
      expect(auth.getRefreshToken()).toBe('refresh-token-456');
      expect(auth.getUser()).toEqual({ username: 'doc', role: 'user' });
    });

    it('handles empty storage gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      await auth.init();

      expect(auth.getAccessToken()).toBeNull();
      expect(auth.getRefreshToken()).toBeNull();
      expect(auth.getUser()).toBeNull();
    });
  });

  describe('setTokens / removeTokens', () => {
    it('stores and retrieves tokens', async () => {
      await auth.setTokens('at', 'rt');

      expect(auth.getAccessToken()).toBe('at');
      expect(auth.getRefreshToken()).toBe('rt');
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    });

    it('clears tokens on removeTokens', async () => {
      await auth.setTokens('at', 'rt');
      await auth.removeTokens();

      expect(auth.getAccessToken()).toBeNull();
      expect(auth.getRefreshToken()).toBeNull();
    });
  });

  describe('getAuthHeader', () => {
    it('returns Bearer header when token exists', async () => {
      await auth.setTokens('my-token', 'refresh');
      expect(auth.getAuthHeader()).toBe('Bearer my-token');
    });

    it('returns null when no token', () => {
      expect(auth.getAuthHeader()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token is set', async () => {
      await auth.setTokens('tok', 'ref');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('returns false when no token', () => {
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('user management', () => {
    it('stores and retrieves user', async () => {
      await auth.setUser({ username: 'doc', role: 'admin' });
      expect(auth.getUser()).toEqual({ username: 'doc', role: 'admin' });
    });

    it('clears user on removeUser', async () => {
      await auth.setUser({ username: 'doc', role: 'user' });
      await auth.removeUser();
      expect(auth.getUser()).toBeNull();
    });

    it('updateUser maps User to StoredUser', async () => {
      await auth.updateUser({
        id: 1,
        username: 'updated',
        role: 'user',
        active: true,
        is_admin: false,
        updated_at: '2026-01-01',
      } as any);
      expect(auth.getUser()).toEqual({ username: 'updated', role: 'user' });
    });
  });

  describe('logout', () => {
    it('clears everything', async () => {
      await auth.setTokens('t', 'r');
      await auth.setUser({ username: 'x', role: 'user' });

      await auth.logout();

      expect(auth.getAccessToken()).toBeNull();
      expect(auth.getRefreshToken()).toBeNull();
      expect(auth.getUser()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });
  });
});
