import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
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

  // Forward interim transcripts (raw, unparsed) for visual feedback.
  useEffect(() => {
    if (onInterim) onInterim(speech.interimTranscript);
  }, [speech.interimTranscript, onInterim]);

  // Process newly-arrived final transcript chunks.
  useEffect(() => {
    const full = speech.transcript ?? '';
    if (full.length <= lastLenRef.current) {
      // transcript was reset (e.g. on a fresh start)
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

  const bgColor = isListening
    ? colors.error
    : hasError
      ? colors.errorLight
      : colors.primary;
  const fgColor = isListening || !hasError ? '#FFFFFF' : colors.error;

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
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: bgColor,
      opacity: disabled || isUnsupported ? 0.5 : 1,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    icon: { fontSize: Math.round(size * 0.5), color: fgColor },
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
        <Text style={styles.icon}>{Platform.OS === 'web' ? '🎙️' : '🎙️'}</Text>
        {isListening ? <View style={styles.pulseDot} /> : null}
      </TouchableOpacity>
    </View>
  );
}
