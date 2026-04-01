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
  HealthResponse,
  SystemSettings
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class APIError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'APIError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    auth.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeader = auth.getAuthHeader();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  if (response.status === 401) {
    auth.logout();
    window.location.href = '/login';
    throw new APIError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }

    const message = errorData.detail || `HTTP ${response.status}`;
    throw new APIError(response.status, message, errorData);
  }

  return response;
}

export const api = {
  async verifyCredentials(credentials: LoginRequest): Promise<User> {
    // Authenticate via JWT login endpoint
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
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
    auth.setTokens(tokenData.access_token, tokenData.refresh_token);

    // Fetch the current user profile with the new token
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
    const response = await fetchWithAuth(`/episodes${query}`);
    return response.json();
  },

  async getEpisode(id: number): Promise<EpisodeDetail> {
    const response = await fetchWithAuth(`/episodes/${id}`);
    return response.json();
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
    const response = await fetchWithAuth(`/episodes/${episodeId}/notes`);
    return response.json();
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const response = await fetchWithAuth('/sync/status');
    return response.json();
  },

  async getSyncStats(): Promise<import('../types').SyncStats> {
    const response = await fetchWithAuth('/sync/stats');
    return response.json();
  },

  async triggerSync(): Promise<{ message: string }> {
    const response = await fetchWithAuth('/sync/trigger', {
      method: 'POST',
    });
    return response.json();
  },

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new APIError(response.status, 'Health check failed');
    }
    return response.json();
  },

  async getCentralHealth(): Promise<{ status: string; central_url: string }> {
    const response = await fetch(`${API_BASE_URL}/health/central`);
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
    const response = await fetchWithAuth(`/episodes/locations/unique${query}`);
    return response.json();
  },

  async getUniqueEpisodeTypes(): Promise<string[]> {
    const response = await fetchWithAuth('/episodes/types/unique');
    return response.json();
  },
};
