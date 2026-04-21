import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  setServerUrl,
  testConnection,
  getServerUrlSync,
} from '../lib/serverConfig';
import { auth } from '../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ServerDiscovery'>;
  route: RouteProp<RootStackParamList, 'ServerDiscovery'>;
};

export function ServerDiscoveryScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const d = t.serverDiscovery;
  const skipAutoConnect = route.params?.skipAutoConnect === true;

  const [serverUrl, setUrl] = useState(getServerUrlSync());
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [autoTrying, setAutoTrying] = useState(true);
  const [autoFailed, setAutoFailed] = useState(false);
  const hasStoredCredentials = auth.isAuthenticated();

  // Pulse animation while auto-trying
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (autoTrying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [autoTrying]);

  // On mount, try the current/default URL automatically (skip if user navigated here to change)
  useEffect(() => {
    if (skipAutoConnect) {
      setAutoTrying(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const ok = await testConnection(getServerUrlSync());
      if (cancelled) return;
      setAutoTrying(false);
      if (ok) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      } else {
        setAutoFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleConnect = async () => {
    if (!serverUrl.trim()) return;
    setError('');
    setIsTesting(true);

    let url = serverUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }
    if (!/:\d+/.test(url.replace(/^https?:\/\//, ''))) {
      url = `${url}:8000`;
    }

    try {
      const ok = await testConnection(url);
      if (!ok) {
        setError(d.connectionFailed);
        setIsTesting(false);
        return;
      }

      await setServerUrl(url);
      setIsTesting(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch {
      setError(d.connectionFailed);
      setIsTesting(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 32 },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryLight ?? colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    icon: { fontSize: 36 },
    title: { fontSize: 24, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 8,
    },
    hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 16 },
    errorBox: {
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: { fontSize: 14, color: colors.error },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
    tryingBox: {
      alignItems: 'center',
      marginBottom: 24,
    },
    tryingText: { marginTop: 10, fontSize: 14, color: colors.textSecondary },
    offlineButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
    },
    offlineButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14, textAlign: 'center' },
  });

  if (autoTrying) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.icon}>📡</Text>
        </Animated.View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
        <Text style={styles.tryingText}>
          {d.tryingDefault} {getServerUrlSync()}
        </Text>
      </View>
    );
  }

  if (autoFailed) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📡</Text>
        </View>
        <Text style={[styles.title, { textAlign: 'center', marginTop: 12 }]}>{d.title}</Text>
        <Text style={[styles.subtitle, { marginTop: 8, marginBottom: 28 }]}>
          {d.connectionFailed}
        </Text>
        <TouchableOpacity
          style={[styles.button, { width: '100%' }]}
          onPress={() => setAutoFailed(false)}
        >
          <Text style={styles.buttonText}>{d.changeServer}</Text>
        </TouchableOpacity>
        {hasStoredCredentials && (
          <TouchableOpacity
            style={[styles.offlineButton, { width: '100%', marginTop: 12 }]}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Episodes' }] })}
          >
            <Text style={styles.offlineButtonText}>{d.resumeLastConnection}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>📡</Text>
          </View>
          <Text style={styles.title}>{d.title}</Text>
          <Text style={styles.subtitle}>{d.subtitle}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{d.serverAddress}</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={(text) => {
              setUrl(text);
              setError('');
            }}
            placeholder={d.manualPlaceholder}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>{d.manualHint}</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (isTesting || !serverUrl.trim()) && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={isTesting || !serverUrl.trim()}
          >
            {isTesting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>{d.testAndConnect}</Text>
            )}
          </TouchableOpacity>

          {hasStoredCredentials && (
            <TouchableOpacity
              style={[styles.offlineButton, { marginTop: 12 }]}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Episodes' }] })}
            >
              <Text style={styles.offlineButtonText}>{d.resumeLastConnection}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
