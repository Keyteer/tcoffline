import type { User } from '../types';

const ACCESS_TOKEN_KEY = 'trakcare_access_token';
const REFRESH_TOKEN_KEY = 'trakcare_refresh_token';
const USER_KEY = 'trakcare_user';

// Legacy key — kept only for migration on first load
const LEGACY_CREDENTIALS_KEY = 'trakcare_credentials';

export interface StoredUser {
  username: string;
  role: string;
}

export const auth = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    // Clean up any legacy credentials
    localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
  },

  removeTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  getAuthHeader(): string | null {
    const token = this.getAccessToken();
    if (token) return `Bearer ${token}`;
    return null;
  },

  getUser(): StoredUser | null {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setUser(user: StoredUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  updateUser(user: User): void {
    const storedUser = {
      username: user.username,
      role: user.role
    };
    localStorage.setItem(USER_KEY, JSON.stringify(storedUser));
  },

  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  logout(): void {
    this.removeTokens();
    this.removeUser();
    sessionStorage.clear();
  }
};
