import { auth } from './auth';
import type {
  LoginRequest,
  User,
  UserUpdateRequest,
  UserCreateRequest,
  Episode,
  EpisodeDetail,
  EpisodeCreateRequest,
  ClinicalNote,
  ClinicalNoteCreateRequest,
  SyncStatus,
  SyncStats,
  HealthResponse,
  SystemSettings,
} from '../types';
import { getServerUrl } from './serverConfig';
import { offlineCache } from './offlineCache';

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /network|fetch|abort/i.test(err.message)) return true;
  if (err instanceof APIError) return false; // HTTP errors are not network errors
  return err instanceof Error && !/unauthorized|forbidden/i.test(err.message);
}

export class APIError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'APIError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function getBaseUrl(): Promise<string> {
  return await getServerUrl();
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    await auth.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = await getBaseUrl();
  const authHeader = auth.getAuthHeader();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  let response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, attempt a single token refresh and retry
  if (response.status === 401 && auth.getRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false));

    if (refreshed) {
      const newAuthHeader = auth.getAuthHeader();
      if (newAuthHeader) {
        headers['Authorization'] = newAuthHeader;
      }
      response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  if (response.status === 401) {
    await auth.logout();
    onUnauthorized?.();
    throw new APIError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }

    let message: string;
    const detail = errorData.detail;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    } else if (detail) {
      message = JSON.stringify(detail);
    } else {
      message = `HTTP ${response.status}`;
    }
    throw new APIError(response.status, message, errorData);
  }

  return response;
}

export const api = {
  async verifyCredentials(credentials: LoginRequest): Promise<User> {
    const baseUrl = await getBaseUrl();
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json().catch(() => ({ detail: 'Login failed' }));
      throw new APIError(loginResponse.status, error.detail || 'Login failed');
    }

    const tokenData = await loginResponse.json();
    await auth.setTokens(tokenData.access_token, tokenData.refresh_token);

    const userResponse = await fetchWithAuth('/auth/me');
    return userResponse.json();
  },

  async getCurrentUser(): Promise<User> {
    const response = await fetchWithAuth('/auth/me');
    return response.json();
  },

  async updateCurrentUser(data: UserUpdateRequest): Promise<User> {
    const response = await fetchWithAuth('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async getEpisodes(params?: { type?: string; skip?: number; limit?: number }): Promise<Episode[]> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    try {
      const response = await fetchWithAuth(`/episodes${query}`);
      const data: Episode[] = await response.json();
      // Cache the full unfiltered list
      if (!params?.type && !params?.skip) {
        offlineCache.setEpisodes(data);
      }
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await offlineCache.getEpisodes();
        if (cached) return cached;
      }
      throw err;
    }
  },

  async getEpisode(id: number): Promise<EpisodeDetail> {
    try {
      const response = await fetchWithAuth(`/episodes/${id}`);
      const data: EpisodeDetail = await response.json();
      offlineCache.setEpisodeDetail(id, data);
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await offlineCache.getEpisodeDetail(id);
        if (cached) return cached;
      }
      throw err;
    }
  },

  async createEpisode(episode: EpisodeCreateRequest): Promise<Episode> {
    const response = await fetchWithAuth('/episodes', {
      method: 'POST',
      body: JSON.stringify(episode),
    });
    return response.json();
  },

  async createClinicalNote(episodeId: number, note: ClinicalNoteCreateRequest): Promise<ClinicalNote> {
    const response = await fetchWithAuth(`/episodes/${episodeId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note),
    });
    return response.json();
  },

  async getClinicalNotes(episodeId: number): Promise<ClinicalNote[]> {
    try {
      const response = await fetchWithAuth(`/episodes/${episodeId}/notes`);
      const data: ClinicalNote[] = await response.json();
      offlineCache.setClinicalNotes(episodeId, data);
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await offlineCache.getClinicalNotes(episodeId);
        if (cached) return cached;
      }
      throw err;
    }
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const response = await fetchWithAuth('/sync/status');
    return response.json();
  },

  async getSyncStats(): Promise<SyncStats> {
    try {
      const response = await fetchWithAuth('/sync/stats');
      const data: SyncStats = await response.json();
      offlineCache.setSyncStats(data);
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await offlineCache.getSyncStats();
        if (cached) return cached;
      }
      throw err;
    }
  },

  async triggerSync(): Promise<{ message: string }> {
    const response = await fetchWithAuth('/sync/trigger', {
      method: 'POST',
    });
    return response.json();
  },

  async getHealth(): Promise<HealthResponse> {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      throw new APIError(response.status, 'Health check failed');
    }
    return response.json();
  },

  async getCentralHealth(): Promise<{ status: string; central_url: string }> {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/health/central`);
    if (!response.ok) {
      throw new APIError(response.status, 'Central health check failed');
    }
    return response.json();
  },

  async syncFromCentral(): Promise<{ message: string; episodes: Episode[] }> {
    const response = await fetchWithAuth('/sync/from-central', {
      method: 'POST',
    });
    return response.json();
  },

  async getSystemSettings(): Promise<SystemSettings> {
    const response = await fetchWithAuth('/settings');
    return response.json();
  },

  async updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
    const response = await fetchWithAuth('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response.json();
  },

  async createUser(data: UserCreateRequest): Promise<User> {
    const response = await fetchWithAuth('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async listUsers(): Promise<User[]> {
    const response = await fetchWithAuth('/auth/users');
    return response.json();
  },

  async getUniqueLocations(tipo?: string): Promise<string[]> {
    const queryParams = new URLSearchParams();
    if (tipo) queryParams.append('tipo', tipo);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    try {
      const response = await fetchWithAuth(`/episodes/locations/unique${query}`);
      const data: string[] = await response.json();
      if (tipo) offlineCache.setLocations(tipo, data);
      return data;
    } catch (err) {
      if (isNetworkError(err) && tipo) {
        const cached = await offlineCache.getLocations(tipo);
        if (cached) return cached;
      }
      throw err;
    }
  },

  async getUniqueEpisodeTypes(): Promise<string[]> {
    try {
      const response = await fetchWithAuth('/episodes/types/unique');
      const data: string[] = await response.json();
      offlineCache.setEpisodeTypes(data);
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await offlineCache.getEpisodeTypes();
        if (cached) return cached;
      }
      throw err;
    }
  },
};
