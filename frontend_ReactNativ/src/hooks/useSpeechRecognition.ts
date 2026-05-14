import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

export type SpeechState = 'idle' | 'requesting' | 'listening' | 'error' | 'unsupported';

export interface SpeechStartOptions {
  lang?: string;
  continuous?: boolean;
  interim?: boolean;
  /**
   * When true, this session is not aborted by `stopActiveSpeechRecognition()`
   * (used by the screen-level tap-anywhere handler). The hands-free
   * command mic uses this so the user can tap fields/pickers while
   * continuing to dictate.
   */
  protectFromExternalStop?: boolean;
}

export interface UseSpeechRecognitionResult {
  state: SpeechState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  start: (opts?: SpeechStartOptions) => Promise<void>;
  stop: () => void;
  abort: () => void;
  reset: () => void;
}

type UnsubscribeFn = () => void;

/**
 * Module-level handle to the currently active speech-recognition session.
 * Only one MicButton can be listening at a time: when a new session starts
 * (or the user taps anywhere else), the previous one is aborted.
 */
let activeSession: { abort: () => void; protectedFromExternal?: boolean; isActive?: boolean } | null = null;
/**
 * Incremented each time a new session starts. Used by the deferred iOS
 * cleanup to bail out if a new session supersedes the current one before
 * the zero-timeout fires (prevents cleaning up the new session's listeners).
 */
let sessionGen = 0;

/**
 * Aborts whichever speech-recognition session is currently running, if any.
 * Safe to call from anywhere (e.g. a screen-level tap handler) and a no-op
 * when nothing is active. Sessions started with `protectFromExternalStop`
 * are left untouched (the command mic uses this).
 */
export function stopActiveSpeechRecognition(): void {
  const current = activeSession;
  if (!current) return;
  if (current.protectedFromExternal) return;
  activeSession = null;
  try {
    current.abort();
  } catch {
    // ignore
  }
}

/**
 * Lazily resolves the expo-speech-recognition module so the app degrades
 * gracefully when the native module is missing (e.g. Expo Go, web bundlers
 * without the polyfill, or test environments).
 */
function loadModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition');
  } catch {
    return null;
  }
}

function detectWebSupport(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function detectInitialSupport(mod: any | null): boolean {
  if (!mod) return Platform.OS === 'web' ? detectWebSupport() : false;
  try {
    if (typeof mod.ExpoSpeechRecognitionModule?.isRecognitionAvailable === 'function') {
      return Boolean(mod.ExpoSpeechRecognitionModule.isRecognitionAvailable());
    }
  } catch {
    // ignore
  }
  return Platform.OS === 'web' ? detectWebSupport() : false;
}

function defaultLangFor(language: string): string {
  return language === 'es' ? 'es-CL' : 'en-US';
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const { language } = useLanguage();
  const moduleRef = useRef<any | null>(null);
  if (moduleRef.current === null) {
    moduleRef.current = loadModule();
  }
  const mod = moduleRef.current;

  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState<boolean>(() => detectInitialSupport(mod));

  const listenersRef = useRef<UnsubscribeFn[]>([]);
  const isMountedRef = useRef(true);
  /** Accumulated final transcript chunks for the current session. */
  const finalChunksRef = useRef('');
  /** Last received interim transcript (used to promote to final on iOS). */
  const currentInterimRef = useRef('');

  const cleanupListeners = useCallback(() => {
    for (const off of listenersRef.current) {
      try {
        off();
      } catch {
        // ignore
      }
    }
    listenersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupListeners();
      if (mod?.ExpoSpeechRecognitionModule) {
        try {
          mod.ExpoSpeechRecognitionModule.abort();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    finalChunksRef.current = '';
    currentInterimRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setState('idle');
  }, []);

  const stop = useCallback(() => {
    if (!mod?.ExpoSpeechRecognitionModule) return;
    try {
      mod.ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
  }, [mod]);

  const abort = useCallback(() => {
    if (!mod?.ExpoSpeechRecognitionModule) return;
    try {
      mod.ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
  }, [mod]);

  const start = useCallback(
    async (opts: SpeechStartOptions = {}) => {
      if (!mod?.ExpoSpeechRecognitionModule) {
        setState('unsupported');
        setError('unsupported');
        return;
      }
      const Module = mod.ExpoSpeechRecognitionModule;

      if (!isSupported) {
        setState('unsupported');
        setError('unsupported');
        return;
      }

      // Abort any other in-flight session so only one mic is ever active.
      // We bypass the protection flag here because starting a new session
      // explicitly supersedes any previous one.
      const prev = activeSession;
      activeSession = null;
      // Increment before abort so any deferred cleanup from the old session
      // bails out and does not remove this new session's listeners.
      const myGen = ++sessionGen;
      if (prev) {
        try { prev.abort(); } catch { /* ignore */ }
      }

      setError(null);
      setTranscript('');
      setInterimTranscript('');
      setState('requesting');

      try {
        const perm = await Module.requestPermissionsAsync();
        if (!perm?.granted) {
          if (!isMountedRef.current) return;
          setError('not-allowed');
          setState('error');
          return;
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
        return;
      }

      cleanupListeners();
      // Reset per-session accumulators.
      finalChunksRef.current = '';
      currentInterimRef.current = '';

      const addListener = (event: string, cb: (e: any) => void) => {
        try {
          const sub = Module.addListener(event, cb);
          if (sub && typeof sub.remove === 'function') {
            listenersRef.current.push(() => sub.remove());
          }
        } catch {
          // ignore
        }
      };

      // Register ourselves as the active session so other MicButtons (or a
      // screen-level tap handler) can abort us by calling
      // `stopActiveSpeechRecognition()`. The handler resets our own state to
      // `idle` immediately so the MicButton UI stops showing the listening
      // indicator even if the native `end`/`error` event arrives later (or
      // not at all, which can happen on some Android engines after abort).
      const sessionHandle = {
        isActive: true,
        protectedFromExternal: opts.protectFromExternalStop === true,
        abort: () => {
          sessionHandle.isActive = false;
          try {
            Module.abort();
          } catch {
            // ignore
          }
          cleanupListeners();
          if (!isMountedRef.current) return;
          setInterimTranscript('');
          setState((prev) => (prev === 'error' ? prev : 'idle'));
        },
      };
      activeSession = sessionHandle;

      addListener('start', () => {
        if (!isMountedRef.current) return;
        setState('listening');
      });

      addListener('result', (event: any) => {
        if (!sessionHandle.isActive) return; // guard against stale post-end events
        if (!isMountedRef.current) return;
        const text: string = event?.results?.[0]?.transcript ?? '';
        if (event?.isFinal) {
          finalChunksRef.current = (finalChunksRef.current
            ? finalChunksRef.current + ' '
            : '') + text;
          setTranscript(finalChunksRef.current);
          setInterimTranscript('');
          currentInterimRef.current = '';
        } else {
          currentInterimRef.current = text;
          setInterimTranscript(text);
        }
      });

      addListener('error', (event: any) => {
        if (!isMountedRef.current) return;
        const code = event?.error || event?.code || 'unknown';
        if (code === 'aborted' || code === 'no-speech') {
          // benign — leave any captured transcript intact
          return;
        }
        setError(String(code));
        setState('error');
      });

      addListener('end', () => {
        if (activeSession === sessionHandle) activeSession = null;
        if (!isMountedRef.current) {
          sessionHandle.isActive = false;
          cleanupListeners();
          return;
        }
        // iOS non-continuous: 'end' fires before the final 'result' event.
        // Promote the last interim to final as a fallback for the case where
        // 'result(isFinal)' has not yet arrived.
        if (Platform.OS === 'ios' && currentInterimRef.current) {
          const promoted = (finalChunksRef.current
            ? finalChunksRef.current + ' '
            : '') + currentInterimRef.current;
          finalChunksRef.current = promoted;
          setTranscript(promoted);
        }
        currentInterimRef.current = '';
        setInterimTranscript('');
        setState((prev) => (prev === 'error' ? prev : 'idle'));
        // Defer listener cleanup by one JS turn on iOS so that a 'result'
        // event already dispatched by native (but not yet processed by JS)
        // can still fire. The generation counter prevents this from touching
        // a new session's listeners if start() is called within the timeout.
        if (Platform.OS === 'ios') {
          setTimeout(() => {
            if (sessionGen !== myGen) return; // new session started, bail
            sessionHandle.isActive = false;
            cleanupListeners();
          }, 0);
        } else {
          sessionHandle.isActive = false;
          cleanupListeners();
        }
      });

      try {
        Module.start({
          lang: opts.lang ?? defaultLangFor(language),
          interimResults: opts.interim ?? true,
          continuous: opts.continuous ?? false,
          maxAlternatives: 1,
        });
      } catch (e) {
        if (!isMountedRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
        cleanupListeners();
        if (activeSession === sessionHandle) activeSession = null;
      }
    },
    [mod, isSupported, language, cleanupListeners],
  );

  return {
    state,
    transcript,
    interimTranscript,
    error,
    isSupported,
    start,
    stop,
    abort,
    reset,
  };
}
