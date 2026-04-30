import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

export type SpeechState = 'idle' | 'requesting' | 'listening' | 'error' | 'unsupported';

export interface SpeechStartOptions {
  lang?: string;
  continuous?: boolean;
  interim?: boolean;
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
let activeSession: { abort: () => void } | null = null;

/**
 * Aborts whichever speech-recognition session is currently running, if any.
 * Safe to call from anywhere (e.g. a screen-level tap handler) and a no-op
 * when nothing is active.
 */
export function stopActiveSpeechRecognition(): void {
  const current = activeSession;
  activeSession = null;
  if (!current) return;
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
      stopActiveSpeechRecognition();

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
      const finalChunksRef = { current: '' };

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
        abort: () => {
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
        if (!isMountedRef.current) return;
        const text: string = event?.results?.[0]?.transcript ?? '';
        if (event?.isFinal) {
          finalChunksRef.current = (finalChunksRef.current
            ? finalChunksRef.current + ' '
            : '') + text;
          setTranscript(finalChunksRef.current);
          setInterimTranscript('');
        } else {
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
        // Always release native listeners as soon as the session ends so a
        // later session started by another MicButton instance doesn't also
        // deliver events to this hook (which would double-write fields).
        cleanupListeners();
        if (activeSession === sessionHandle) activeSession = null;
        if (!isMountedRef.current) return;
        setInterimTranscript('');
        setState((prev) => (prev === 'error' ? prev : 'idle'));
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
