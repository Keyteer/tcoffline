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
import { API_REQUEST_TIMEOUT, HEALTH_CHECK_TIMEOUT } from '../config/env';

export class APIError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'APIError';
  }
}


/**
 * fetch wrapper with timeout via AbortController.
 * In release builds, the OS network stack can hang ~75s on unreachable hosts;
 * an explicit timeout is required to surface failures fast and trigger cache fallback.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = API_REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Store-first (stale-while-revalidate) helper.
 *
 * `cacheGet` must return a non-null value (even an empty array/object) to
 * serve as the immediate result when the device has nothing stored yet.
 * The network fetch always runs in the background; `onUpdate` is called
 * when fresh data arrives so the UI can re-render without blocking.
 * Network / timeout errors during the background revalidation are swallowed
 * — the local store value remains authoritative until the server responds.
 */
async function cacheFirst<T>(
  fetcher: () => Promise<T>,
  cacheGet: () => Promise<T>,
  cacheSet: (data: T) => Promise<void>,
  onUpdate?: (data: T) => void
): Promise<T> {
  const stored = await cacheGet();
  // Always return stored data immediately — fire network refresh in background.
  fetcher()
    .then(async (fresh) => {
      try { await cacheSet(fresh); } catch { /* ignore */ }
      if (onUpdate) {
        try { onUpdate(fresh); } catch { /* ignore */ }
      }
    })
    .catch(() => { /* offline / timeout — keep local store */ });
  return stored;
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
    const response = await fetchWithTimeout(`${baseUrl}/auth/refresh`, {
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

  let response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
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
      response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
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
    const loginResponse = await fetchWithTimeout(`${baseUrl}/auth/login`, {
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

  async getEpisodes(
    params?: { type?: string; skip?: number; limit?: number },
    onUpdate?: (data: Episode[]) => void
  ): Promise<Episode[]> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const fetcher = async (): Promise<Episode[]> => {
      const response = await fetchWithAuth(`/episodes${query}`);
      return response.json();
    };
    // Only the unfiltered list is stored/served from the local store.
    const isCacheable = !params?.type && !params?.skip;
    if (!isCacheable) {
      return fetcher();
    }
    return cacheFirst(
      fetcher,
      async () => (await offlineCache.getEpisodes()) ?? [],
      (d) => offlineCache.setEpisodes(d),
      onUpdate,
    );
  },

  async getEpisode(id: number, onUpdate?: (data: EpisodeDetail) => void): Promise<EpisodeDetail> {
    return cacheFirst(
      async () => {
        const response = await fetchWithAuth(`/episodes/${id}`);
        return response.json() as Promise<EpisodeDetail>;
      },
      // Store-first with a secondary fallback to the episodes list, so an
      // episode that has never been opened (no detail entry yet) still loads
      // instantly from the list. Returns an empty-data shell as last resort
      // so the screen always renders immediately.
      async () => {
        const detail = await offlineCache.getEpisodeDetail(id);
        if (detail) return detail;
        const list = await offlineCache.getEpisodes();
        const match = list?.find((e) => e.id === id);
        return match
          ? { ...match, data: {} as EpisodeDetail['data'] }
          : { id, mrn: '', num_episodio: '', data_json: '', created_at: '', updated_at: '', synced_flag: false, pending_notes_count: 0, data: {} as EpisodeDetail['data'] };
      },
      (d) => offlineCache.setEpisodeDetail(id, d),
      onUpdate,
    );
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

  async getClinicalNotes(
    episodeId: number,
    onUpdate?: (data: ClinicalNote[]) => void
  ): Promise<ClinicalNote[]> {
    return cacheFirst(
      async () => {
        const response = await fetchWithAuth(`/episodes/${episodeId}/notes`);
        return response.json() as Promise<ClinicalNote[]>;
      },
      // Always return something immediately — empty array when nothing is stored
      // yet. The background fetch populates the store when the server responds.
      async () => (await offlineCache.getClinicalNotes(episodeId)) ?? [],
      (d) => offlineCache.setClinicalNotes(episodeId, d),
      onUpdate,
    );
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const response = await fetchWithAuth('/sync/status');
    return response.json();
  },

  async getSyncStats(onUpdate?: (data: SyncStats) => void): Promise<SyncStats | null> {
    const stored = await offlineCache.getSyncStats();
    // Fire background refresh; call onUpdate when fresh data arrives.
    fetchWithAuth('/sync/stats')
      .then((r) => r.json() as Promise<SyncStats>)
      .then(async (fresh) => {
        await offlineCache.setSyncStats(fresh).catch(() => {});
        onUpdate?.(fresh);
      })
      .catch(() => {});
    return stored;
  },

  async triggerSync(): Promise<{ message: string }> {
    const response = await fetchWithAuth('/sync/trigger', {
      method: 'POST',
    });
    return response.json();
  },

  async getHealth(): Promise<HealthResponse> {
    const baseUrl = await getBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/health`, {}, HEALTH_CHECK_TIMEOUT);
    if (!response.ok) {
      throw new APIError(response.status, 'Health check failed');
    }
    return response.json();
  },

  async getCentralHealth(): Promise<{ status: string; central_url: string }> {
    const baseUrl = await getBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/health/central`, {}, HEALTH_CHECK_TIMEOUT);
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

  async getUniqueLocations(
    tipo?: string,
    onUpdate?: (data: string[]) => void
  ): Promise<string[]> {
    const queryParams = new URLSearchParams();
    if (tipo) queryParams.append('tipo', tipo);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const fetcher = async (): Promise<string[]> => {
      const response = await fetchWithAuth(`/episodes/locations/unique${query}`);
      return response.json();
    };
    if (!tipo) {
      // No cache scope without a tipo — go straight to network
      return fetcher();
    }
    return cacheFirst(
      fetcher,
      async () => (await offlineCache.getLocations(tipo)) ?? [],
      (d) => offlineCache.setLocations(tipo, d),
      onUpdate,
    );
  },

  async getUniqueEpisodeTypes(onUpdate?: (data: string[]) => void): Promise<string[]> {
    return cacheFirst(
      async () => {
        const response = await fetchWithAuth('/episodes/types/unique');
        return response.json() as Promise<string[]>;
      },
      async () => (await offlineCache.getEpisodeTypes()) ?? [],
      (d) => offlineCache.setEpisodeTypes(d),
      onUpdate,
    );
  },
};
