import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';

const QUEUE_KEY = 'offline_mutation_queue';

export type MutationType = 'createEpisode' | 'createNote';

export interface PendingMutation {
  id: string;
  type: MutationType;
  timestamp: number;
  payload: EpisodeCreateRequest | ClinicalNoteCreateRequest;
  /** For createNote, the episode ID to attach the note to */
  episodeId?: number;
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
};
