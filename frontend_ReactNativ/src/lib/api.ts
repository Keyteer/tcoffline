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
import { localStore } from './localStore';
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
 * an explicit timeout is required to surface failures fast and trigger local-store fallback.
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
 * `storeGet` must return a non-null value (even an empty array/object) to
 * serve as the immediate result when the device has nothing stored yet.
 * The network fetch always runs in the background; `onUpdate` is called
 * when fresh data arrives so the UI can re-render without blocking.
 * Network / timeout errors during the background revalidation are swallowed
 * — the local store value remains authoritative until the server responds.
 */
async function storeFirst<T>(
  fetcher: () => Promise<T>,
  storeGet: () => Promise<T>,
  storeSet: (data: T) => Promise<void>,
  onUpdate?: (data: T) => void
): Promise<T> {
  const stored = await storeGet();
  // Always return stored data immediately — fire network refresh in background.
  fetcher()
    .then(async (fresh) => {
      try { await storeSet(fresh); } catch { /* ignore */ }
      if (onUpdate) {
        try { onUpdate(fresh); } catch { /* ignore */ }
      }
    })
    .catch(() => { /* offline / timeout — keep local store */ });
  return stored;
}

async function getBaseUrl(): Promise<string> {
  return await getServerUrl();
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

  const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

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
    const formBody = new URLSearchParams();
    formBody.append('username', credentials.username);
    formBody.append('password', credentials.password);
    const loginResponse = await fetchWithTimeout(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json().catch(() => ({ detail: 'Login failed' }));
      throw new APIError(loginResponse.status, error.detail || 'Login failed');
    }

    const tokenData = await loginResponse.json();
    await auth.setToken(tokenData.access_token);

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
    const isStorable = !params?.type && !params?.skip;
    if (!isStorable) {
      return fetcher();
    }
    return storeFirst(
      fetcher,
      async () => (await localStore.getEpisodes()) ?? [],
      (d) => localStore.setEpisodes(d),
      onUpdate,
    );
  },

  async getEpisode(id: number, onUpdate?: (data: EpisodeDetail) => void): Promise<EpisodeDetail> {
    return storeFirst(
      async () => {
        const response = await fetchWithAuth(`/episodes/${id}`);
        return response.json() as Promise<EpisodeDetail>;
      },
      // Store-first with a secondary fallback to the episodes list, so an
      // episode that has never been opened (no detail entry yet) still loads
      // instantly from the list. Returns an empty-data shell as last resort
      // so the screen always renders immediately.
      async () => {
        const detail = await localStore.getEpisodeDetail(id);
        if (detail) return detail;
        const list = await localStore.getEpisodes();
        const match = list?.find((e) => e.id === id);
        return match
          ? { ...match, data: {} as EpisodeDetail['data'] }
          : { id, mrn: '', num_episodio: '', data_json: '', created_at: '', updated_at: '', synced_flag: false, pending_notes_count: 0, data: {} as EpisodeDetail['data'] };
      },
      (d) => localStore.setEpisodeDetail(id, d),
      onUpdate,
    );
  },

  async createEpisode(episode: EpisodeCreateRequest): Promise<Episode> {
    const response = await fetchWithAuth('/episodes', {
      method: 'POST',
      body: JSON.stringify(episode),
    });
    const data = await response.json();
    // Stamp the device→local-server send time so the SyncPipeline can show
    // "sent X ago" on the App→Local link.
    localStore.setLastDeviceSendAt(Date.now()).catch(() => { /* ignore */ });
    return data;
  },

  async createClinicalNote(episodeId: number, note: ClinicalNoteCreateRequest): Promise<ClinicalNote> {
    const response = await fetchWithAuth(`/episodes/${episodeId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note),
    });
    const data = await response.json();
    localStore.setLastDeviceSendAt(Date.now()).catch(() => { /* ignore */ });
    return data;
  },

  async getClinicalNotes(
    episodeId: number,
    onUpdate?: (data: ClinicalNote[]) => void
  ): Promise<ClinicalNote[]> {
    return storeFirst(
      async () => {
        const response = await fetchWithAuth(`/episodes/${episodeId}/notes`);
        return response.json() as Promise<ClinicalNote[]>;
      },
      // Always return something immediately — empty array when nothing is stored
      // yet. The background fetch populates the store when the server responds.
      async () => (await localStore.getClinicalNotes(episodeId)) ?? [],
      (d) => localStore.setClinicalNotes(episodeId, d),
      onUpdate,
    );
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const response = await fetchWithAuth('/sync/status');
    return response.json();
  },

  async getSyncStats(onUpdate?: (data: SyncStats) => void): Promise<SyncStats | null> {
    const stored = await localStore.getSyncStats();
    // Fire background refresh; call onUpdate when fresh data arrives.
    fetchWithAuth('/sync/stats')
      .then((r) => r.json() as Promise<SyncStats>)
      .then(async (fresh) => {
        await localStore.setSyncStats(fresh).catch(() => {});
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
    const response = await fetchWithAuth('/health/central');
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
      // No store scope without a tipo — go straight to network
      return fetcher();
    }
    return storeFirst(
      fetcher,
      async () => (await localStore.getLocations(tipo)) ?? [],
      (d) => localStore.setLocations(tipo, d),
      onUpdate,
    );
  },

  async getUniqueEpisodeTypes(onUpdate?: (data: string[]) => void): Promise<string[]> {
    return storeFirst(
      async () => {
        const response = await fetchWithAuth('/episodes/types/unique');
        return response.json() as Promise<string[]>;
      },
      async () => (await localStore.getEpisodeTypes()) ?? [],
      (d) => localStore.setEpisodeTypes(d),
      onUpdate,
    );
  },
};
