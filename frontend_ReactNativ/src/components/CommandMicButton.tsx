import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Mic } from 'react-native-feather';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseCommandTranscript, type CommandVocab } from '../lib/speechParsers';

interface CommandMicButtonProps<F extends string> {
  /** Vocabulary mapping field id -> spoken aliases. */
  vocab: CommandVocab<F>;
  /** Aliases that mean "advance to the next field" (e.g. "next"). */
  nextAliases?: string[];
  /** Explicit field order for resolving the `next` alias. Defaults to `Object.keys(vocab)`. */
  fieldOrder?: F[];
  /** Called for each parsed `(field, value)` segment as the user speaks. */
  onSegment: (field: F, value: string) => void;
  /** Called whenever the active (last-mentioned) field changes. */
  onActiveFieldChange?: (field: F | null) => void;
  /** Called with the live interim transcript for inline feedback. */
  onInterim?: (text: string) => void;
  lang?: string;
  disabled?: boolean;
  size?: number;
}

export function CommandMicButton<F extends string>({
  vocab,
  nextAliases,
  fieldOrder,
  onSegment,
  onActiveFieldChange,
  onInterim,
  lang,
  disabled = false,
  size = 44,
}: CommandMicButtonProps<F>) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const speech = useSpeechRecognition();

  const lastLenRef = useRef(0);
  const activeFieldRef = useRef<F | null>(null);

  // Refs holding the latest speech values, safe to read inside setTimeout callbacks.
  const latestInterimRef = useRef('');
  const latestTranscriptRef = useRef('');
  useEffect(() => { latestInterimRef.current = speech.interimTranscript; }, [speech.interimTranscript]);
  useEffect(() => { latestTranscriptRef.current = speech.transcript ?? ''; }, [speech.transcript]);

  // Debounce timer: fires 700 ms after the user stops speaking (interim stops changing).
  const interimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forward interim transcripts (raw, unparsed) for visual feedback and start debounce.
  useEffect(() => {
    if (onInterim) onInterim(speech.interimTranscript);

    if (interimDebounceRef.current) {
      clearTimeout(interimDebounceRef.current);
      interimDebounceRef.current = null;
    }
    if (!speech.interimTranscript) return;

    // On iOS, continuous mode never fires result(isFinal) at natural pauses — only
    // at explicit session stop. Process interim as commands after 700 ms of silence
    // so the user doesn't have to press stop after each phrase.
    interimDebounceRef.current = setTimeout(() => {
      interimDebounceRef.current = null;
      const interim = latestInterimRef.current.trim();
      if (!interim) return;

      const finalSoFar = latestTranscriptRef.current;
      const combined = (finalSoFar ? finalSoFar + ' ' : '') + interim;
      const chunk = combined.slice(lastLenRef.current).trim();
      if (!chunk) return;

      lastLenRef.current = combined.length;

      const segments = parseCommandTranscript<F>(chunk, vocab, activeFieldRef.current, {
        nextAliases,
        fieldOrder,
      });
      for (const seg of segments) {
        onSegment(seg.field, seg.value);
        activeFieldRef.current = seg.field;
        onActiveFieldChange?.(seg.field);
      }
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.interimTranscript]);

  // Process newly-arrived final transcript chunks (fallback / catches phrases the
  // debounce missed, e.g. quick speech where session ended before 700 ms elapsed).
  useEffect(() => {
    const full = speech.transcript ?? '';
    if (full.length <= lastLenRef.current) {
      // transcript was reset (e.g. on a fresh start) or already covered by debounce
      lastLenRef.current = full.length;
      return;
    }
    const chunk = full.slice(lastLenRef.current).trim();
    lastLenRef.current = full.length;
    if (!chunk) return;

    const segments = parseCommandTranscript<F>(chunk, vocab, activeFieldRef.current, {
      nextAliases,
      fieldOrder,
    });
    for (const seg of segments) {
      onSegment(seg.field, seg.value);
      activeFieldRef.current = seg.field;
      onActiveFieldChange?.(seg.field);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.transcript]);

  // Reset bookkeeping when the session ends so the next start parses fresh.
  useEffect(() => {
    if (speech.state === 'idle') {
      if (interimDebounceRef.current) {
        clearTimeout(interimDebounceRef.current);
        interimDebounceRef.current = null;
      }
      lastLenRef.current = 0;
    }
  }, [speech.state]);

  const isUnsupported = !speech.isSupported || speech.state === 'unsupported';
  const isListening = speech.state === 'listening' || speech.state === 'requesting';
  const hasError = speech.state === 'error';

  const handlePress = async () => {
    if (disabled || isUnsupported) return;
    if (isListening) {
      speech.stop();
      return;
    }
    activeFieldRef.current = null;
    onActiveFieldChange?.(null);
    speech.reset();
    lastLenRef.current = 0;
    await speech.start({ lang, continuous: true, interim: true, protectFromExternalStop: true });
  };

  const iconTint = isListening
    ? colors.primaryDark
    : hasError
      ? colors.errorLight
      : colors.primary;

  const accessibilityLabel = isUnsupported
    ? t.speech.unsupported
    : isListening
      ? t.speech.command.stop
      : t.speech.command.start;

  const styles = StyleSheet.create({
    wrapper: { alignItems: 'center', justifyContent: 'center' },
    button: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: size / 4,
      opacity: disabled || isUnsupported ? 0.4 : isListening ? 0.75 : 1,
    },
    icon: {
      width: size,
      height: size,
    },
    pulseDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.error,
      borderWidth: 2,
      borderColor: colors.background,
    },
  });

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t.speech.command.hint}
        accessibilityState={{ disabled: disabled || isUnsupported, busy: isListening }}
        style={styles.button}
        onPress={handlePress}
        disabled={disabled || isUnsupported}
      >
        <Mic width={(size * 2) / 3} height={size} color={iconTint} />
        {isListening ? <View style={styles.pulseDot} /> : null}
      </TouchableOpacity>
    </View>
  );
}
