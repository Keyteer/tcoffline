import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '../lib/api';
import { offlineCache } from '../lib/offlineCache';
import { mutationQueue } from '../lib/mutationQueue';
import { CONNECTIVITY_POLL_INTERVAL } from '../config/env';
import type { PendingMutation } from '../lib/mutationQueue';
import type { EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';

interface ConnectivityContextType {
  isBackendReachable: boolean;
  pendingMutations: number;
  lastCheck: Date | null;
  /** Increments every time the offline mutation queue is drained against the
   *  backend. UI surfaces (e.g. the episodes list) can subscribe to this to
   *  refresh themselves immediately when local-only items become real. */
  lastReplayAt: number;
  checkNow: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);


export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isBackendReachable, setIsBackendReachable] = useState(true);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [lastReplayAt, setLastReplayAt] = useState(0);
  const wasOffline = useRef(false);
  const isReplaying = useRef(false);
  const pendingMutationsRef = useRef(0);

  useEffect(() => {
    pendingMutationsRef.current = pendingMutations;
  }, [pendingMutations]);

  const hasPreCached = useRef(false);
  const preCacheInFlight = useRef(false);

  /**
   * Eagerly fetch & store the form-data needed to create episodes/notes
   * (episode types and the locations for every type). This MUST run as soon
   * as the device can talk to the backend, independently of any user action
   * or connectivity state changes — because once it's stored, the user can
   * keep creating episodes and notes through any subsequent outage.
   *
   * Strategy:
   *  - Fire on mount (regardless of perceived backend state).
   *  - Use the `onUpdate` callback of each store-first getter to capture the
   *    *fresh* network response (the direct return value would be the empty
   *    cache fallback).
   *  - Mark `hasPreCached.current` true only when types AND every location
   *    list have actually been written to storage. Otherwise leave it false
   *    so the next health-check tick retries.
   */
  const preCacheFormData = useCallback(async () => {
    if (preCacheInFlight.current) return;
    preCacheInFlight.current = true;
    try {
      const captureFresh = <T,>(
        run: (onUpdate: (fresh: T) => void) => Promise<T>,
        timeoutMs = 10000,
      ): Promise<T | null> =>
        new Promise<T | null>((resolve) => {
          let done = false;
          const finish = (v: T | null) => { if (!done) { done = true; resolve(v); } };
          const timer = setTimeout(() => finish(null), timeoutMs);
          run((fresh) => { clearTimeout(timer); finish(fresh); }).catch(() => finish(null));
        });

      // Episodes list is nice-to-have, but types/locations are required.
      captureFresh<unknown[]>((cb) => api.getEpisodes({}, cb as (d: unknown[]) => void) as Promise<unknown[]>);

      const types = await captureFresh<string[]>((cb) => api.getUniqueEpisodeTypes(cb));
      if (!types || types.length === 0) return; // retry next tick

      const results = await Promise.all(
        types.map((tipo) => captureFresh<string[]>((cb) => api.getUniqueLocations(tipo, cb))),
      );
      const allOk = results.every((r) => r !== null);
      if (allOk) hasPreCached.current = true;
    } finally {
      preCacheInFlight.current = false;
    }
  }, []);

  const replayQueue = useCallback(async () => {
    if (isReplaying.current) return;
    isReplaying.current = true;
    let replayedAny = false;

    try {
      // Reload the queue between iterations so that side effects from one
      // mutation (e.g. createEpisode retargeting child notes) are reflected
      // before we replay the next entry. Without this, retargeted notes are
      // replayed with their stale in-memory negative episodeId, get skipped,
      // and then deleted by remove() — silently dropping the user's data.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const pending = await mutationQueue.getAll();
        if (pending.length === 0) break;
        const mutation = pending[0];
        try {
          await replayMutation(mutation);
          await mutationQueue.remove(mutation.id);
          replayedAny = true;
        } catch {
          // Stop replaying on first failure — backend may have gone down again
          break;
        }
      }
    } finally {
      isReplaying.current = false;
      const count = await mutationQueue.count();
      setPendingMutations(count);
      if (replayedAny) setLastReplayAt(Date.now());
    }
  }, []);

  const checkBackend = useCallback(async () => {
    try {
      await api.getHealth();
      const nowOnline = true;
      const wasJustOffline = wasOffline.current;
      setIsBackendReachable(nowOnline);
      setLastCheck(new Date());
      wasOffline.current = false;

      // Re-attempt pre-cache on every successful health check until the
      // critical form-data is fully stored. This is independent of user
      // actions and runs as soon as the backend is reachable for the first
      // time, on every reconnect, and on every retry after a partial fetch.
      if (!hasPreCached.current) {
        preCacheFormData().then(() => {
          if (hasPreCached.current) setLastReplayAt(Date.now());
        });
      } else if (wasJustOffline) {
        // After a real offline→online transition, refresh the form-data so
        // newly added types/locations on the server reach the device.
        preCacheFormData().then(() => setLastReplayAt(Date.now()));
      }

      // Always try to drain the queue if anything is pending and we're online.
      // This handles the case where mutations were enqueued but the
      // offline→online transition was missed (e.g. app restart with pending items).
      const pending = await mutationQueue.count();
      if (pending > 0) {
        replayQueue();
      } else if (pending !== pendingMutationsRef.current) {
        setPendingMutations(pending);
      }
    } catch {
      setIsBackendReachable(false);
      wasOffline.current = true;
      setLastCheck(new Date());
    }
  }, [replayQueue, preCacheFormData]);

  const checkNow = useCallback(async () => {
    await checkBackend();
  }, [checkBackend]);

  // Initial check + polling
  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, CONNECTIVITY_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkBackend]);

  // Check on app foreground
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        checkBackend();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [checkBackend]);

  // Load pending count on mount
  useEffect(() => {
    mutationQueue.count().then(setPendingMutations);
  }, []);

  // Eager form-data warm-up. Runs on mount independently of any other state:
  //   1. If types are already in local storage, mark pre-cache satisfied so
  //      subsequent health checks don't refetch unnecessarily.
  //   2. Always fire one immediate pre-cache attempt so the app starts
  //      pulling required data the moment it boots, even before the first
  //      health-check tick completes.
  useEffect(() => {
    (async () => {
      try {
        const storedTypes = await offlineCache.getEpisodeTypes();
        if (storedTypes && storedTypes.length > 0) {
          // We at least have types stored — treat as cached; checkBackend
          // will still run preCacheFormData on the first true offline→online
          // transition to refresh.
          hasPreCached.current = true;
        }
      } catch { /* ignore */ }
      preCacheFormData().then(() => {
        if (hasPreCached.current) setLastReplayAt(Date.now());
      });
    })();
  }, [preCacheFormData]);

  return (
    <ConnectivityContext.Provider value={{ isBackendReachable, pendingMutations, lastCheck, lastReplayAt, checkNow }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (context === undefined) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
}

async function replayMutation(mutation: PendingMutation): Promise<void> {
  switch (mutation.type) {
    case 'createEpisode': {
      const payload = mutation.payload as EpisodeCreateRequest;
      const created = await api.createEpisode(payload);
      // Re-target any queued notes that were attached to this still-local
      // episode so they can post against the real backend id.
      await mutationQueue.retargetNotesForLocalEpisode(payload.num_episodio, created.id);
      break;
    }
    case 'createNote':
      if (mutation.episodeId !== undefined && mutation.episodeId >= 0) {
        await api.createClinicalNote(mutation.episodeId, mutation.payload as ClinicalNoteCreateRequest);
      }
      // If episodeId is still negative, the parent createEpisode hasn't
      // replayed yet — leave this note in the queue; the parent's success
      // path will retarget it on the next pass.
      break;
  }
}
