import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '../lib/api';
import { localStore } from '../lib/localStore';
import { outbox } from '../lib/outbox';
import { CONNECTIVITY_POLL_INTERVAL } from '../config/env';
import type { OutboxEntry } from '../lib/outbox';
import type { EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';

interface ConnectivityContextType {
  isBackendReachable: boolean;
  /** Number of entries in the device-side outbox awaiting upload to the
   *  hospital server. */
  pendingOutbox: number;
  lastCheck: Date | null;
  /** Timestamp (ms epoch) of the moment link1 transitioned online→offline.
   *  null when link1 is currently up or has never been observed offline. */
  lastBackendLossAt: number | null;
  /** Timestamp (ms epoch) of the last successful POST originated by THIS
   *  device against the hospital server (createEpisode / createClinicalNote).
   *  Persisted in the local store so it survives app restarts. */
  lastDeviceSendAt: number | null;
  /** Increments every time the device-side outbox is drained against the
   *  hospital server. UI surfaces (e.g. the episodes list) can subscribe to
   *  this to refresh themselves immediately when local-only items become
   *  real. */
  lastReplayAt: number;
  checkNow: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);


export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isBackendReachable, setIsBackendReachable] = useState(true);
  const [pendingOutbox, setPendingOutbox] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [lastReplayAt, setLastReplayAt] = useState(0);
  const [lastBackendLossAt, setLastBackendLossAt] = useState<number | null>(null);
  const [lastDeviceSendAt, setLastDeviceSendAt] = useState<number | null>(null);
  const wasOffline = useRef(false);
  const isReplaying = useRef(false);
  const pendingOutboxRef = useRef(0);

  useEffect(() => {
    pendingOutboxRef.current = pendingOutbox;
  }, [pendingOutbox]);

  const hasPrefilledStore = useRef(false);
  const prefillInFlight = useRef(false);

  /**
   * Eagerly fetch & store the form-data needed to create episodes/notes
   * (episode types and the locations for every type). This MUST run as soon
   * as the device can talk to the hospital server, independently of any user
   * action or connectivity state changes — because once it's stored, the user
   * can keep creating episodes and notes through any subsequent outage.
   *
   * Strategy:
   *  - Fire on mount (regardless of perceived hospital-server state).
   *  - Use the `onUpdate` callback of each store-first getter to capture the
   *    *fresh* network response (the direct return value would be the empty
   *    local-store fallback).
   *  - Mark `hasPrefilledStore.current` true only when types AND every
   *    location list have actually been written to the local store. Otherwise
   *    leave it false so the next health-check tick retries.
   */
  const prefillLocalStore = useCallback(async () => {
    if (prefillInFlight.current) return;
    prefillInFlight.current = true;
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
      if (allOk) hasPrefilledStore.current = true;
    } finally {
      prefillInFlight.current = false;
    }
  }, []);

  const replayOutbox = useCallback(async () => {
    if (isReplaying.current) return;
    isReplaying.current = true;
    let replayedAny = false;

    try {
      // Reload the outbox between iterations so that side effects from one
      // entry (e.g. createEpisode retargeting child notes) are reflected
      // before we replay the next entry. Without this, retargeted notes are
      // replayed with their stale in-memory negative episodeId, get skipped,
      // and then deleted by remove() — silently dropping the user's data.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const pending = await outbox.getAll();
        if (pending.length === 0) break;
        const entry = pending[0];
        try {
          await replayOutboxEntry(entry);
          await outbox.remove(entry.id);
          replayedAny = true;
        } catch {
          // Stop replaying on first failure — hospital server may have gone
          // down again
          break;
        }
      }
    } finally {
      isReplaying.current = false;
      const count = await outbox.count();
      setPendingOutbox(count);
      if (replayedAny) {
        setLastReplayAt(Date.now());
        // Immediately surface the updated send timestamp — don't wait for the
        // next health-check tick, which could be 30 s away.
        localStore.getLastDeviceSendAt().then(setLastDeviceSendAt);
      }
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
      // Link1 is up — clear any stale loss timestamp.
      setLastBackendLossAt(null);

      // Re-attempt local-store prefill on every successful health check until
      // the critical form-data is fully stored. This is independent of user
      // actions and runs as soon as the hospital server is reachable for the
      // first time, on every reconnect, and on every retry after a partial
      // fetch.
      if (!hasPrefilledStore.current) {
        prefillLocalStore().then(() => {
          if (hasPrefilledStore.current) setLastReplayAt(Date.now());
        });
      } else if (wasJustOffline) {
        // After a real offline→online transition, refresh the form-data so
        // newly added types/locations on the hospital server reach the device.
        prefillLocalStore().then(() => setLastReplayAt(Date.now()));
      }

      // Always try to drain the outbox if anything is pending and we're
      // online. This handles the case where entries were enqueued but the
      // offline→online transition was missed (e.g. app restart with pending
      // items).
      const pending = await outbox.count();
      if (pending > 0) {
        replayOutbox();
      } else if (pending !== pendingOutboxRef.current) {
        setPendingOutbox(pending);
      }

      // Refresh the device→local send timestamp from the local store on
      // every health-check tick (cheap AsyncStorage read).
      localStore.getLastDeviceSendAt().then((ts) => setLastDeviceSendAt(ts));
    } catch {
      setIsBackendReachable(false);
      // Stamp the loss time only on the actual online→offline edge to avoid
      // resetting it on every failed poll while we stay offline.
      if (!wasOffline.current) setLastBackendLossAt(Date.now());
      wasOffline.current = true;
      setLastCheck(new Date());
    }
  }, [replayOutbox, prefillLocalStore]);

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

  // Load pending count and last device-send timestamp on mount
  useEffect(() => {
    outbox.count().then(setPendingOutbox);
    localStore.getLastDeviceSendAt().then(setLastDeviceSendAt);
  }, []);

  // Eager form-data warm-up. Runs on mount independently of any other state:
  //   1. If types are already in the local store, mark prefill satisfied so
  //      subsequent health checks don't refetch unnecessarily.
  //   2. Always fire one immediate prefill attempt so the app starts pulling
  //      required data the moment it boots, even before the first
  //      health-check tick completes.
  useEffect(() => {
    (async () => {
      try {
        const storedTypes = await localStore.getEpisodeTypes();
        if (storedTypes && storedTypes.length > 0) {
          // We at least have types stored — treat as prefilled; checkBackend
          // will still run prefillLocalStore on the first true offline→online
          // transition to refresh.
          hasPrefilledStore.current = true;
        }
      } catch { /* ignore */ }
      prefillLocalStore().then(() => {
        if (hasPrefilledStore.current) setLastReplayAt(Date.now());
      });
    })();
  }, [prefillLocalStore]);

  return (
    <ConnectivityContext.Provider value={{ isBackendReachable, pendingOutbox, lastCheck, lastReplayAt, lastBackendLossAt, lastDeviceSendAt, checkNow }}>
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

async function replayOutboxEntry(entry: OutboxEntry): Promise<void> {
  switch (entry.type) {
    case 'createEpisode': {
      const payload = entry.payload as EpisodeCreateRequest;
      const created = await api.createEpisode(payload);
      // Re-target any queued notes that were attached to this still-local
      // episode so they can post against the real hospital-server id.
      await outbox.retargetNotesForLocalEpisode(payload.num_episodio, created.id);
      break;
    }
    case 'createNote':
      if (entry.episodeId !== undefined && entry.episodeId >= 0) {
        await api.createClinicalNote(entry.episodeId, entry.payload as ClinicalNoteCreateRequest);
      }
      // If episodeId is still negative, the parent createEpisode hasn't
      // replayed yet — leave this note in the outbox; the parent's success
      // path will retarget it on the next pass.
      break;
  }
}
