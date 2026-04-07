import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { User } from '../types';

const ACCESS_TOKEN_KEY = 'trakcare_access_token';
const REFRESH_TOKEN_KEY = 'trakcare_refresh_token';
const USER_KEY = 'trakcare_user';

// Web fallback using localStorage
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export interface StoredUser {
  username: string;
  role: string;
}

// In-memory cache for synchronous access
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedUser: StoredUser | null = null;

export const auth = {
  async init(): Promise<void> {
    cachedAccessToken = await storage.getItem(ACCESS_TOKEN_KEY);
    cachedRefreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
    const userStr = await storage.getItem(USER_KEY);
    cachedUser = userStr ? JSON.parse(userStr) : null;
  },

  getAccessToken(): string | null {
    return cachedAccessToken;
  },

  getRefreshToken(): string | null {
    return cachedRefreshToken;
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    cachedAccessToken = accessToken;
    cachedRefreshToken = refreshToken;
    await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async removeTokens(): Promise<void> {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    await storage.removeItem(ACCESS_TOKEN_KEY);
    await storage.removeItem(REFRESH_TOKEN_KEY);
  },

  getAuthHeader(): string | null {
    const token = this.getAccessToken();
    if (token) return `Bearer ${token}`;
    return null;
  },

  getUser(): StoredUser | null {
    return cachedUser;
  },

  async setUser(user: StoredUser): Promise<void> {
    cachedUser = user;
    await storage.setItem(USER_KEY, JSON.stringify(user));
  },

  async updateUser(user: User): Promise<void> {
    const storedUser = {
      username: user.username,
      role: user.role,
    };
    cachedUser = storedUser;
    await storage.setItem(USER_KEY, JSON.stringify(storedUser));
  },

  async removeUser(): Promise<void> {
    cachedUser = null;
    await storage.removeItem(USER_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  async logout(): Promise<void> {
    await this.removeTokens();
    await this.removeUser();
  },
};
