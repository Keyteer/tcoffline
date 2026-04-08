import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export function LoginScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const { colors } = useTheme();
  const { refreshUser } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setError('');
    setIsLoading(true);

    try {
      const user = await api.verifyCredentials({ username, password });

      await auth.setUser({
        username: user.username,
        role: user.role,
      });

      await refreshUser();

      try {
        const centralHealth = await api.getCentralHealth();
        if (centralHealth.status === 'online') {
          Alert.alert('', t.readOnlyMode.loginAlert);
        }
      } catch {
        // Central not available, that's ok
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Episodes' }],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.login.loginError);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
    },
    errorBox: {
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      backgroundColor: colors.surfaceSecondary,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    demoBox: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    demoTitle: {
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
      fontSize: 13,
    },
    demoText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 13,
    },
    demoBold: {
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    infoButton: {
      position: 'absolute',
      top: 50,
      right: 16,
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      zIndex: 10,
    },
    infoButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    // Sidebar overlay and panel
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
      zIndex: 20,
    },
    sidebar: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 300,
      backgroundColor: colors.card,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      zIndex: 30,
      padding: 24,
    },
    sidebarTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
    },
    sidebarSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    featureCheck: {
      color: colors.primary,
      marginRight: 8,
      fontSize: 14,
    },
    featureText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    typeBadge: {
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      marginBottom: 8,
    },
    typeBadgeText: {
      fontWeight: '500',
      fontSize: 13,
    },
    closeSidebar: {
      alignSelf: 'flex-end',
      padding: 4,
      marginBottom: 8,
    },
    closeSidebarText: {
      fontSize: 22,
      color: colors.textSecondary,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        style={styles.infoButton}
        onPress={() => setSidebarOpen(true)}
      >
        <Text style={styles.infoButtonText}>ℹ</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{t.login.title}</Text>
          <Text style={styles.subtitle}>
            {language === 'es' ? 'Ingrese sus credenciales para continuar' : 'Enter your credentials to continue'}
          </Text>

          <Text style={styles.label}>{t.login.username}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder={language === 'es' ? 'Ingrese su usuario' : 'Enter your username'}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>{t.login.password}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={language === 'es' ? 'Ingrese su contraseña' : 'Enter your password'}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t.login.loginButton}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('ServerDiscovery', { skipAutoConnect: true })}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>{t.serverDiscovery.changeServer}</Text>
          </TouchableOpacity>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>
              {language === 'es' ? 'Credenciales de prueba:' : 'Test credentials:'}
            </Text>
            <Text style={styles.demoText}>
              {language === 'es' ? 'Usuario' : 'User'}: <Text style={styles.demoBold}>admin</Text>
            </Text>
            <Text style={styles.demoText}>
              {language === 'es' ? 'Contraseña' : 'Password'}: <Text style={styles.demoBold}>admin</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {sidebarOpen && (
        <>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setSidebarOpen(false)}
          />
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.closeSidebar} onPress={() => setSidebarOpen(false)}>
                <Text style={styles.closeSidebarText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.sidebarTitle}>TrakCare Offline</Text>
              <Text style={styles.sidebarSubtitle}>Sistema de Contingencia Clínica</Text>

              <Text style={styles.sectionTitle}>Características</Text>
              {[
                'Gestión de episodios en modo offline',
                'Sincronización automática con servidor central',
                'Registro de notas clínicas',
                'Control de pacientes y episodios',
              ].map((feat, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{feat}</Text>
                </View>
              ))}

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Tipos de Episodio</Text>
              {[
                { label: t.episodeTypes['Urgencia'], bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
                { label: t.episodeTypes['Hospitalizado'], bg: '#FAF5FF', border: '#E9D5FF', text: '#6B21A8' },
                { label: t.episodeTypes['Ambulatorio'], bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
                { label: t.episodeTypes['Pabellón'], bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
              ].map((type, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.typeBadge,
                    { backgroundColor: type.bg, borderColor: type.border },
                  ]}
                >
                  <Text style={[styles.typeBadgeText, { color: type.text }]}>{type.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
