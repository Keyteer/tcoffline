import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Episode, EpisodeDetail, ClinicalNote, SyncStats } from '../types';

const CACHE_PREFIX = 'offline_cache_';
const KEYS = {
  episodes: `${CACHE_PREFIX}episodes`,
  syncStats: `${CACHE_PREFIX}sync_stats`,
  episodeTypes: `${CACHE_PREFIX}episode_types`,
  locations: (tipo: string) => `${CACHE_PREFIX}locations_${tipo}`,
  episodeDetail: (id: number) => `${CACHE_PREFIX}episode_${id}`,
  clinicalNotes: (episodeId: number) => `${CACHE_PREFIX}notes_${episodeId}`,
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

async function setCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

async function getCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const entry: CacheEntry<T> = JSON.parse(raw);
  return entry.data;
}

export const offlineCache = {
  // Episodes list
  async setEpisodes(episodes: Episode[]): Promise<void> {
    await setCache(KEYS.episodes, episodes);
  },
  async getEpisodes(): Promise<Episode[] | null> {
    return getCache<Episode[]>(KEYS.episodes);
  },

  // Episode detail
  async setEpisodeDetail(id: number, detail: EpisodeDetail): Promise<void> {
    await setCache(KEYS.episodeDetail(id), detail);
  },
  async getEpisodeDetail(id: number): Promise<EpisodeDetail | null> {
    return getCache<EpisodeDetail>(KEYS.episodeDetail(id));
  },

  // Clinical notes
  async setClinicalNotes(episodeId: number, notes: ClinicalNote[]): Promise<void> {
    await setCache(KEYS.clinicalNotes(episodeId), notes);
  },
  async getClinicalNotes(episodeId: number): Promise<ClinicalNote[] | null> {
    return getCache<ClinicalNote[]>(KEYS.clinicalNotes(episodeId));
  },

  // Sync stats
  async setSyncStats(stats: SyncStats): Promise<void> {
    await setCache(KEYS.syncStats, stats);
  },
  async getSyncStats(): Promise<SyncStats | null> {
    return getCache<SyncStats>(KEYS.syncStats);
  },

  // Episode types
  async setEpisodeTypes(types: string[]): Promise<void> {
    await setCache(KEYS.episodeTypes, types);
  },
  async getEpisodeTypes(): Promise<string[] | null> {
    return getCache<string[]>(KEYS.episodeTypes);
  },

  // Locations
  async setLocations(tipo: string, locations: string[]): Promise<void> {
    await setCache(KEYS.locations(tipo), locations);
  },
  async getLocations(tipo: string): Promise<string[] | null> {
    return getCache<string[]>(KEYS.locations(tipo));
  },

  // Clear all cached data
  async clearAll(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  },
};
