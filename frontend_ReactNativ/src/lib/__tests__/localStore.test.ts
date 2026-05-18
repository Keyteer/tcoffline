import { localStore } from '../localStore';
import { installInMemoryAsyncStorage } from './_inMemoryStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

let store: Map<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  store = installInMemoryAsyncStorage();
});

describe('localStore', () => {
  describe('episodes list', () => {
    it('round-trips an episodes list', async () => {
      const eps = [{ id: 1, num_episodio: 'E1' }, { id: 2, num_episodio: 'E2' }] as any;
      await localStore.setEpisodes(eps);
      expect(await localStore.getEpisodes()).toEqual(eps);
    });

    it('returns null when nothing is stored', async () => {
      expect(await localStore.getEpisodes()).toBeNull();
    });

    it('wraps stored data with a timestamp envelope', async () => {
      await localStore.setEpisodes([] as any);
      const raw = await AsyncStorage.getItem('local_store_episodes');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('timestamp');
      expect(typeof parsed.timestamp).toBe('number');
    });
  });

  describe('episode detail', () => {
    it('stores detail per id, isolated from list', async () => {
      const detail = { id: 7, num_episodio: 'E7', notes: [] } as any;
      await localStore.setEpisodeDetail(7, detail);
      expect(await localStore.getEpisodeDetail(7)).toEqual(detail);
      expect(await localStore.getEpisodeDetail(99)).toBeNull();
      expect(await localStore.getEpisodes()).toBeNull();
    });
  });

  describe('clinical notes', () => {
    it('stores notes per episode id', async () => {
      const notes = [{ id: 1, note_text: 'A' }] as any;
      await localStore.setClinicalNotes(5, notes);
      expect(await localStore.getClinicalNotes(5)).toEqual(notes);
      expect(await localStore.getClinicalNotes(6)).toBeNull();
    });
  });

  describe('sync stats / episode types / locations', () => {
    it('stores sync stats', async () => {
      const stats = { pending_events: 3 } as any;
      await localStore.setSyncStats(stats);
      expect(await localStore.getSyncStats()).toEqual(stats);
    });

    it('stores episode types', async () => {
      await localStore.setEpisodeTypes(['Ambulatorio', 'Hospitalizado']);
      expect(await localStore.getEpisodeTypes()).toEqual([
        'Ambulatorio',
        'Hospitalizado',
      ]);
    });

    it('stores locations keyed by tipo', async () => {
      await localStore.setLocations('UCI', ['101', '102']);
      await localStore.setLocations('Urgencias', ['Box 1']);
      expect(await localStore.getLocations('UCI')).toEqual(['101', '102']);
      expect(await localStore.getLocations('Urgencias')).toEqual(['Box 1']);
      expect(await localStore.getLocations('Ambulatorio')).toBeNull();
    });
  });

  describe('lastDeviceSendAt', () => {
    it('round-trips a timestamp', async () => {
      await localStore.setLastDeviceSendAt(1_700_000_000_000);
      expect(await localStore.getLastDeviceSendAt()).toBe(1_700_000_000_000);
    });
  });

  describe('clearAll', () => {
    it('removes only local_store_* keys', async () => {
      await localStore.setEpisodes([] as any);
      await localStore.setSyncStats({ x: 1 } as any);
      await AsyncStorage.setItem('other_key', 'keep me');
      await AsyncStorage.setItem('outbox_queue', '[]');

      await localStore.clearAll();

      expect(store.has('local_store_episodes')).toBe(false);
      expect(store.has('local_store_sync_stats')).toBe(false);
      expect(store.get('other_key')).toBe('keep me');
      expect(store.get('outbox_queue')).toBe('[]');
    });

    it('is a no-op when nothing is stored', async () => {
      await expect(localStore.clearAll()).resolves.toBeUndefined();
    });
  });
});
