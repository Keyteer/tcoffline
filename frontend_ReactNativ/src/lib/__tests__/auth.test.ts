import * as SecureStore from 'expo-secure-store';
import { auth } from '../auth';

beforeEach(async () => {
  jest.clearAllMocks();
  await auth.logout();
});

describe('auth', () => {
  describe('init', () => {
    it('loads token and user from storage into cache', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce(JSON.stringify({ username: 'doc', role: 'user' }));

      await auth.init();

      expect(auth.getAccessToken()).toBe('access-token-123');
      expect(auth.getUser()).toEqual({ username: 'doc', role: 'user' });
    });

    it('handles empty storage gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      await auth.init();

      expect(auth.getAccessToken()).toBeNull();
      expect(auth.getUser()).toBeNull();
    });
  });

  describe('setToken / removeTokens', () => {
    it('stores and retrieves the access token', async () => {
      await auth.setToken('at');

      expect(auth.getAccessToken()).toBe('at');
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('clears the token on removeTokens', async () => {
      await auth.setToken('at');
      await auth.removeTokens();

      expect(auth.getAccessToken()).toBeNull();
    });
  });

  describe('getAuthHeader', () => {
    it('returns Bearer header when token exists', async () => {
      await auth.setToken('my-token');
      expect(auth.getAuthHeader()).toBe('Bearer my-token');
    });

    it('returns null when no token', () => {
      expect(auth.getAuthHeader()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token is set', async () => {
      await auth.setToken('tok');
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
      await auth.setToken('t');
      await auth.setUser({ username: 'x', role: 'user' });

      await auth.logout();

      expect(auth.getAccessToken()).toBeNull();
      expect(auth.getUser()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });
  });
});
