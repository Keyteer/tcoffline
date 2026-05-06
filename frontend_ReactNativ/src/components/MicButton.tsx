import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, View, Image } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

const micIcon = require('../../assets/Microfone.png');

export type MicButtonMode = 'replace' | 'append';

interface MicButtonProps {
  /**
   * Called whenever a transcript chunk is available.
   * `isFinal` is true when the recognizer reports the final result.
   * The component already takes care of `mode` (append/replace) — consumers
   * receive the resulting text they should write into the field.
   */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Current value of the target field, used for `mode: 'append'`. */
  value?: string;
  mode?: MicButtonMode;
  /** Override the auto-detected language (defaults to es-CL/en-US). */
  lang?: string;
  continuous?: boolean;
  interim?: boolean;
  disabled?: boolean;
  size?: number;
  /** Optional callback invoked with the live interim transcript (for previewing). */
  onInterim?: (text: string) => void;
}

export function MicButton({
  onTranscript,
  value = '',
  mode = 'append',
  lang,
  continuous = false,
  interim = true,
  disabled = false,
  size = 32,
  onInterim,
}: MicButtonProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const speech = useSpeechRecognition();
  const baseValueRef = useRef<string>(value);

  // Surface interim transcripts to the parent if requested.
  useEffect(() => {
    if (onInterim) onInterim(speech.interimTranscript);
  }, [speech.interimTranscript, onInterim]);

  // Forward final transcript chunks to the consumer.
  useEffect(() => {
    if (!speech.transcript) return;
    if (mode === 'replace') {
      onTranscript(speech.transcript.trim(), true);
    } else {
      const base = baseValueRef.current ?? '';
      const sep = base && !base.endsWith(' ') ? ' ' : '';
      onTranscript(`${base}${sep}${speech.transcript.trim()}`.trim(), true);
    }
    // We intentionally only react to changes in the transcript itself,
    // since `value` is a moving target that would otherwise re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.transcript]);

  const isUnsupported = !speech.isSupported || speech.state === 'unsupported';
  const isListening = speech.state === 'listening' || speech.state === 'requesting';
  const hasError = speech.state === 'error';

  const handlePress = async () => {
    if (disabled || isUnsupported) return;
    if (isListening) {
      speech.stop();
      return;
    }
    baseValueRef.current = value;
    speech.reset();
    await speech.start({ lang, continuous, interim });
  };

  const iconTint = isListening
    ? colors.primaryDark
    : hasError
      ? colors.errorLight
      : isUnsupported
        ? colors.textTertiary
        : colors.primary;

  const accessibilityLabel = isUnsupported
    ? t.speech.unsupported
    : isListening
      ? t.speech.stop
      : t.speech.start;

  const accessibilityHint = hasError
    ? speech.error === 'not-allowed'
      ? t.speech.permissionDenied
      : t.speech.errorGeneric
    : undefined;

  const styles = StyleSheet.create({
    wrapper: { alignItems: 'center', justifyContent: 'center' },
    button: {
      width: size / 2,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      opacity: disabled || isUnsupported ? 0.4 : isListening ? 0.75 : 1,
    },
    icon: {
      width: size,
      height: size,
      tintColor: iconTint,
      resizeMode: 'contain',
    },
    pulseDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
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
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || isUnsupported, busy: isListening }}
        style={styles.button}
        onPress={handlePress}
        disabled={disabled || isUnsupported}
      >
        <Image source={micIcon} style={styles.icon} />
        {isListening ? <View style={styles.pulseDot} /> : null}
      </TouchableOpacity>
    </View>
  );
}
