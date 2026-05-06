import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';

const QUEUE_KEY = 'offline_mutation_queue';

export type MutationType = 'createEpisode' | 'createNote';

export interface PendingMutation {
  id: string;
  type: MutationType;
  timestamp: number;
  payload: EpisodeCreateRequest | ClinicalNoteCreateRequest;
  /** For createNote, the episode ID to attach the note to. May be a negative
   *  pseudo-id while the parent episode itself is still queued locally. */
  episodeId?: number;
  /** For createNote attached to a still-local episode: the `num_episodio` of
   *  the parent createEpisode mutation. After the parent createEpisode replays,
   *  matching notes are re-targeted to the real backend episode id. */
  localEpisodeKey?: string;
}

async function loadQueue(): Promise<PendingMutation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const mutationQueue = {
  async enqueue(mutation: Omit<PendingMutation, 'id' | 'timestamp'>): Promise<PendingMutation> {
    const queue = await loadQueue();
    const entry: PendingMutation = {
      ...mutation,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };
    queue.push(entry);
    await saveQueue(queue);
    return entry;
  },

  async getAll(): Promise<PendingMutation[]> {
    return loadQueue();
  },

  async remove(id: string): Promise<void> {
    const queue = await loadQueue();
    await saveQueue(queue.filter((m) => m.id !== id));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  async count(): Promise<number> {
    const queue = await loadQueue();
    return queue.length;
  },

  /** Pseudo-id used by the UI for episodes that exist only in the queue.
   *  Negative so it can never collide with a real backend id. */
  localEpisodePseudoId(m: PendingMutation): number {
    return -m.timestamp;
  },

  /** Look up a queued createEpisode by the pseudo-id used in the UI. */
  async findLocalEpisode(pseudoId: number): Promise<PendingMutation | null> {
    const queue = await loadQueue();
    return (
      queue.find(
        (m) => m.type === 'createEpisode' && -m.timestamp === pseudoId,
      ) ?? null
    );
  },

  /** Notes queued against a particular episode (real id or local pseudo-id). */
  async getPendingNotesForEpisode(
    episodeId: number,
    localEpisodeKey?: string,
  ): Promise<PendingMutation[]> {
    const queue = await loadQueue();
    return queue.filter((m) => {
      if (m.type !== 'createNote') return false;
      if (m.episodeId === episodeId) return true;
      if (localEpisodeKey && m.localEpisodeKey === localEpisodeKey) return true;
      return false;
    });
  },

  /** Re-target queued notes whose parent episode just got a real backend id. */
  async retargetNotesForLocalEpisode(
    localEpisodeKey: string,
    realEpisodeId: number,
  ): Promise<void> {
    const queue = await loadQueue();
    let changed = false;
    for (const m of queue) {
      if (m.type === 'createNote' && m.localEpisodeKey === localEpisodeKey) {
        m.episodeId = realEpisodeId;
        m.localEpisodeKey = undefined;
        changed = true;
      }
    }
    if (changed) await saveQueue(queue);
  },
};
