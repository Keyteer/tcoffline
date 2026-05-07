import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Episode, EpisodeDetail, ClinicalNote, SyncStats } from '../types';

// Persistent on-device store of clinical data fetched from the hospital server.
// Authoritative while the device is offline; refreshed by store-first reads.
const LOCAL_STORE_PREFIX = 'local_store_';
const KEYS = {
  episodes: `${LOCAL_STORE_PREFIX}episodes`,
  syncStats: `${LOCAL_STORE_PREFIX}sync_stats`,
  episodeTypes: `${LOCAL_STORE_PREFIX}episode_types`,
  locations: (tipo: string) => `${LOCAL_STORE_PREFIX}locations_${tipo}`,
  episodeDetail: (id: number) => `${LOCAL_STORE_PREFIX}episode_${id}`,
  clinicalNotes: (episodeId: number) => `${LOCAL_STORE_PREFIX}notes_${episodeId}`,
  lastDeviceSendAt: `${LOCAL_STORE_PREFIX}last_device_send_at`,
};

interface StoreEntry<T> {
  data: T;
  timestamp: number;
}

async function setStore<T>(key: string, data: T): Promise<void> {
  const entry: StoreEntry<T> = { data, timestamp: Date.now() };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

async function getStore<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const entry: StoreEntry<T> = JSON.parse(raw);
  return entry.data;
}

export const localStore = {
  // Episodes list
  async setEpisodes(episodes: Episode[]): Promise<void> {
    await setStore(KEYS.episodes, episodes);
  },
  async getEpisodes(): Promise<Episode[] | null> {
    return getStore<Episode[]>(KEYS.episodes);
  },

  // Episode detail
  async setEpisodeDetail(id: number, detail: EpisodeDetail): Promise<void> {
    await setStore(KEYS.episodeDetail(id), detail);
  },
  async getEpisodeDetail(id: number): Promise<EpisodeDetail | null> {
    return getStore<EpisodeDetail>(KEYS.episodeDetail(id));
  },

  // Clinical notes
  async setClinicalNotes(episodeId: number, notes: ClinicalNote[]): Promise<void> {
    await setStore(KEYS.clinicalNotes(episodeId), notes);
  },
  async getClinicalNotes(episodeId: number): Promise<ClinicalNote[] | null> {
    return getStore<ClinicalNote[]>(KEYS.clinicalNotes(episodeId));
  },

  // Sync stats
  async setSyncStats(stats: SyncStats): Promise<void> {
    await setStore(KEYS.syncStats, stats);
  },
  async getSyncStats(): Promise<SyncStats | null> {
    return getStore<SyncStats>(KEYS.syncStats);
  },

  // Episode types
  async setEpisodeTypes(types: string[]): Promise<void> {
    await setStore(KEYS.episodeTypes, types);
  },
  async getEpisodeTypes(): Promise<string[] | null> {
    return getStore<string[]>(KEYS.episodeTypes);
  },

  // Locations
  async setLocations(tipo: string, locations: string[]): Promise<void> {
    await setStore(KEYS.locations(tipo), locations);
  },
  async getLocations(tipo: string): Promise<string[] | null> {
    return getStore<string[]>(KEYS.locations(tipo));
  },

  // Last successful device→hospital-server mutation timestamp (ms epoch).
  // Stamped by api.ts on every successful POST that originates a new
  // clinical record (episode / note). Read by ConnectivityContext to drive
  // the SyncPipeline "sent X ago" caption on the App→Local link.
  async setLastDeviceSendAt(ts: number): Promise<void> {
    await setStore(KEYS.lastDeviceSendAt, ts);
  },
  async getLastDeviceSendAt(): Promise<number | null> {
    return getStore<number>(KEYS.lastDeviceSendAt);
  },

  // Clear all stored data
  async clearAll(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const storeKeys = allKeys.filter((k) => k.startsWith(LOCAL_STORE_PREFIX));
    if (storeKeys.length > 0) {
      await AsyncStorage.multiRemove(storeKeys);
    }
  },
};
