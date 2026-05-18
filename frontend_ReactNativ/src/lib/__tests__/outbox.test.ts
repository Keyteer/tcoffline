import { outbox } from '../outbox';
import { installInMemoryAsyncStorage } from './_inMemoryStorage';

beforeEach(() => {
  jest.clearAllMocks();
  installInMemoryAsyncStorage();
});

describe('outbox', () => {
  describe('enqueue / getAll / count', () => {
    it('assigns id and timestamp on enqueue', async () => {
      const entry = await outbox.enqueue({
        type: 'createEpisode',
        payload: { num_episodio: 'E1' } as any,
      });
      expect(entry.id).toMatch(/^\d+_[a-z0-9]+$/);
      expect(typeof entry.timestamp).toBe('number');
      expect(entry.type).toBe('createEpisode');
      expect(await outbox.count()).toBe(1);
    });

    it('preserves insertion order', async () => {
      await outbox.enqueue({ type: 'createEpisode', payload: { n: 1 } as any });
      await outbox.enqueue({ type: 'createNote',    payload: { n: 2 } as any, episodeId: 5 });
      const all = await outbox.getAll();
      expect(all.map((e) => (e.payload as any).n)).toEqual([1, 2]);
    });

    it('generates unique ids for rapid back-to-back enqueues', async () => {
      const e1 = await outbox.enqueue({ type: 'createNote', payload: {} as any, episodeId: 1 });
      const e2 = await outbox.enqueue({ type: 'createNote', payload: {} as any, episodeId: 1 });
      expect(e1.id).not.toBe(e2.id);
    });
  });

  describe('remove / clear', () => {
    it('removes a single entry by id', async () => {
      const a = await outbox.enqueue({ type: 'createEpisode', payload: {} as any });
      const b = await outbox.enqueue({ type: 'createEpisode', payload: {} as any });
      await outbox.remove(a.id);
      const remaining = await outbox.getAll();
      expect(remaining.map((e) => e.id)).toEqual([b.id]);
    });

    it('clear empties the queue', async () => {
      await outbox.enqueue({ type: 'createEpisode', payload: {} as any });
      await outbox.enqueue({ type: 'createNote', payload: {} as any, episodeId: 1 });
      await outbox.clear();
      expect(await outbox.count()).toBe(0);
    });
  });

  describe('local episode pseudo-id', () => {
    it('returns negative of timestamp', async () => {
      const entry = await outbox.enqueue({
        type: 'createEpisode',
        payload: { num_episodio: 'OFFE-1' } as any,
      });
      expect(outbox.localEpisodePseudoId(entry)).toBe(-entry.timestamp);
    });

    it('findLocalEpisode locates a queued createEpisode by pseudo-id', async () => {
      const entry = await outbox.enqueue({
        type: 'createEpisode',
        payload: { num_episodio: 'OFFE-2' } as any,
      });
      const pseudo = outbox.localEpisodePseudoId(entry);
      const found = await outbox.findLocalEpisode(pseudo);
      expect(found?.id).toBe(entry.id);
    });

    it('findLocalEpisode returns null for unknown pseudo-id', async () => {
      expect(await outbox.findLocalEpisode(-999)).toBeNull();
    });
  });

  describe('getPendingNotesForEpisode', () => {
    it('matches by numeric episodeId', async () => {
      await outbox.enqueue({ type: 'createNote', payload: {} as any, episodeId: 1 });
      await outbox.enqueue({ type: 'createNote', payload: {} as any, episodeId: 2 });
      const pending = await outbox.getPendingNotesForEpisode(1);
      expect(pending).toHaveLength(1);
      expect(pending[0].episodeId).toBe(1);
    });

    it('matches by localEpisodeKey when episode is still queued', async () => {
      await outbox.enqueue({
        type: 'createNote',
        payload: {} as any,
        localEpisodeKey: 'OFFE-NEW',
      });
      const pending = await outbox.getPendingNotesForEpisode(-1, 'OFFE-NEW');
      expect(pending).toHaveLength(1);
    });

    it('ignores createEpisode entries', async () => {
      await outbox.enqueue({ type: 'createEpisode', payload: {} as any });
      expect(await outbox.getPendingNotesForEpisode(1)).toEqual([]);
    });
  });

  describe('retargetNotesForLocalEpisode', () => {
    it('rewrites localEpisodeKey notes to real id', async () => {
      await outbox.enqueue({
        type: 'createNote',
        payload: { note_text: 'a' } as any,
        localEpisodeKey: 'OFFE-X',
      });
      await outbox.enqueue({
        type: 'createNote',
        payload: { note_text: 'b' } as any,
        localEpisodeKey: 'OFFE-X',
      });
      // Unrelated entry — must remain untouched
      await outbox.enqueue({
        type: 'createNote',
        payload: { note_text: 'c' } as any,
        localEpisodeKey: 'OFFE-Y',
      });

      await outbox.retargetNotesForLocalEpisode('OFFE-X', 42);

      const all = await outbox.getAll();
      const x = all.filter((e) => (e.payload as any).note_text !== 'c');
      const y = all.find((e) => (e.payload as any).note_text === 'c');
      for (const e of x) {
        expect(e.episodeId).toBe(42);
        expect(e.localEpisodeKey).toBeUndefined();
      }
      expect(y?.episodeId).toBeUndefined();
      expect(y?.localEpisodeKey).toBe('OFFE-Y');
    });

    it('is a no-op when no entries match', async () => {
      await outbox.enqueue({
        type: 'createNote',
        payload: {} as any,
        localEpisodeKey: 'OFFE-A',
      });
      await outbox.retargetNotesForLocalEpisode('OFFE-NONE', 99);
      const all = await outbox.getAll();
      expect(all[0].localEpisodeKey).toBe('OFFE-A');
      expect(all[0].episodeId).toBeUndefined();
    });
  });
});
