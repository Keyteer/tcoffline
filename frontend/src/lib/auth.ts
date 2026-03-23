import type { User } from '../types';

const CREDENTIALS_KEY = 'trakcare_credentials';
const USER_KEY = 'trakcare_user';

export interface StoredUser {
  username: string;
  role: string;
}

export interface StoredCredentials {
  username: string;
  password: string;
}

export const auth = {
  getCredentials(): StoredCredentials | null {
    const creds = localStorage.getItem(CREDENTIALS_KEY);
    return creds ? JSON.parse(creds) : null;
  },

  setCredentials(username: string, password: string): void {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
  },

  removeCredentials(): void {
    localStorage.removeItem(CREDENTIALS_KEY);
  },

  getAuthHeader(): string | null {
    const creds = this.getCredentials();
    if (!creds) return null;
    const encoded = btoa(`${creds.username}:${creds.password}`);
    return `Basic ${encoded}`;
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
    return !!this.getCredentials();
  },

  logout(): void {
    this.removeCredentials();
    this.removeUser();
    sessionStorage.clear();
  }
};
