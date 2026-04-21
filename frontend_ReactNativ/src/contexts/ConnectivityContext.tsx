import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '../lib/api';
import { mutationQueue } from '../lib/mutationQueue';
import type { PendingMutation } from '../lib/mutationQueue';
import type { EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';

interface ConnectivityContextType {
  isBackendReachable: boolean;
  pendingMutations: number;
  lastCheck: Date | null;
  checkNow: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

const POLL_INTERVAL = 10000; // 10 seconds

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isBackendReachable, setIsBackendReachable] = useState(true);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const wasOffline = useRef(false);
  const isReplaying = useRef(false);

  const hasPreCached = useRef(false);

  const preCacheFormData = useCallback(async () => {
    try {
      // These API calls automatically cache their responses in offlineCache
      const types = await api.getUniqueEpisodeTypes();
      // Pre-cache locations for each episode type
      await Promise.all(types.map((tipo) => api.getUniqueLocations(tipo)));
    } catch {
      // best-effort — don't block on failure
    }
  }, []);

  const replayQueue = useCallback(async () => {
    if (isReplaying.current) return;
    isReplaying.current = true;

    try {
      const pending = await mutationQueue.getAll();
      for (const mutation of pending) {
        try {
          await replayMutation(mutation);
          await mutationQueue.remove(mutation.id);
        } catch {
          // Stop replaying on first failure — backend may have gone down again
          break;
        }
      }
    } finally {
      isReplaying.current = false;
      const count = await mutationQueue.count();
      setPendingMutations(count);
    }
  }, []);

  const checkBackend = useCallback(async () => {
    try {
      await api.getHealth();
      const nowOnline = true;
      setIsBackendReachable(nowOnline);
      setLastCheck(new Date());

      // Went from offline → online: replay queue and pre-cache form data
      if (wasOffline.current && nowOnline) {
        wasOffline.current = false;
        replayQueue();
        preCacheFormData();
      }
    } catch {
      setIsBackendReachable(false);
      wasOffline.current = true;
      setLastCheck(new Date());
    }
  }, [replayQueue]);

  const checkNow = useCallback(async () => {
    await checkBackend();
  }, [checkBackend]);

  // Initial check + polling
  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, POLL_INTERVAL);
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

  return (
    <ConnectivityContext.Provider value={{ isBackendReachable, pendingMutations, lastCheck, checkNow }}>
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
    case 'createEpisode':
      await api.createEpisode(mutation.payload as EpisodeCreateRequest);
      break;
    case 'createNote':
      if (mutation.episodeId !== undefined) {
        await api.createClinicalNote(mutation.episodeId, mutation.payload as ClinicalNoteCreateRequest);
      }
      break;
  }
}
