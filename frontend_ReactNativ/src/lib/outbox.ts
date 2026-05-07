import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';

// Device-side outbox: pending mutations awaiting upload to the hospital server.
// Mirrors the hospital server's own outbox concept (which forwards to the
// central HIS over HL7), so the same name is used on both sides of the pipeline.
const OUTBOX_KEY = 'outbox_queue';

export type OutboxOperation = 'createEpisode' | 'createNote';

export interface OutboxEntry {
  id: string;
  type: OutboxOperation;
  timestamp: number;
  payload: EpisodeCreateRequest | ClinicalNoteCreateRequest;
  /** For createNote, the episode ID to attach the note to. May be a negative
   *  pseudo-id while the parent episode itself is still queued locally. */
  episodeId?: number;
  /** For createNote attached to a still-local episode: the `num_episodio` of
   *  the parent createEpisode entry. After the parent createEpisode replays,
   *  matching notes are re-targeted to the real hospital-server episode id. */
  localEpisodeKey?: string;
}

async function loadOutbox(): Promise<OutboxEntry[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveOutbox(entries: OutboxEntry[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

export const outbox = {
  async enqueue(entry: Omit<OutboxEntry, 'id' | 'timestamp'>): Promise<OutboxEntry> {
    const entries = await loadOutbox();
    const newEntry: OutboxEntry = {
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };
    entries.push(newEntry);
    await saveOutbox(entries);
    return newEntry;
  },

  async getAll(): Promise<OutboxEntry[]> {
    return loadOutbox();
  },

  async remove(id: string): Promise<void> {
    const entries = await loadOutbox();
    await saveOutbox(entries.filter((m) => m.id !== id));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(OUTBOX_KEY);
  },

  async count(): Promise<number> {
    const entries = await loadOutbox();
    return entries.length;
  },

  /** Pseudo-id used by the UI for episodes that exist only in the outbox.
   *  Negative so it can never collide with a real hospital-server id. */
  localEpisodePseudoId(m: OutboxEntry): number {
    return -m.timestamp;
  },

  /** Look up a queued createEpisode by the pseudo-id used in the UI. */
  async findLocalEpisode(pseudoId: number): Promise<OutboxEntry | null> {
    const entries = await loadOutbox();
    return (
      entries.find(
        (m) => m.type === 'createEpisode' && -m.timestamp === pseudoId,
      ) ?? null
    );
  },

  /** Notes queued against a particular episode (real id or local pseudo-id). */
  async getPendingNotesForEpisode(
    episodeId: number,
    localEpisodeKey?: string,
  ): Promise<OutboxEntry[]> {
    const entries = await loadOutbox();
    return entries.filter((m) => {
      if (m.type !== 'createNote') return false;
      if (m.episodeId === episodeId) return true;
      if (localEpisodeKey && m.localEpisodeKey === localEpisodeKey) return true;
      return false;
    });
  },

  /** Re-target queued notes whose parent episode just got a real
   *  hospital-server id. */
  async retargetNotesForLocalEpisode(
    localEpisodeKey: string,
    realEpisodeId: number,
  ): Promise<void> {
    const entries = await loadOutbox();
    let changed = false;
    for (const m of entries) {
      if (m.type === 'createNote' && m.localEpisodeKey === localEpisodeKey) {
        m.episodeId = realEpisodeId;
        m.localEpisodeKey = undefined;
        changed = true;
      }
    }
    if (changed) await saveOutbox(entries);
  },
};
