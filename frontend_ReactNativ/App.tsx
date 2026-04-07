import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableFreeze } from 'react-native-screens';

// Disable react-freeze to avoid React 19 "async Client Component" false positive
enableFreeze(false);

import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './src/contexts/LanguageContext';
import { UserProvider } from './src/contexts/UserContext';
import { auth } from './src/lib/auth';
import { api, setOnUnauthorized } from './src/lib/api';
import { getServerUrlSync } from './src/lib/serverConfig';

import { LoginScreen } from './src/screens/LoginScreen';
import { EpisodesScreen } from './src/screens/EpisodesScreen';
import { NewEpisodeScreen } from './src/screens/NewEpisodeScreen';
import { ClinicalNoteScreen } from './src/screens/ClinicalNoteScreen';

import type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Initialize auth cache from secure storage
        await auth.init();

        // Check backend health
        await api.getHealth();
        setBackendAvailable(true);
        setError(null);

        // Check if user is already authenticated
        setIsAuthenticated(auth.isAuthenticated());
      } catch (err) {
        setBackendAvailable(false);
        setError(err instanceof Error ? err.message : 'Backend no disponible');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [retryCount]);

  // Set up unauthorized callback to redirect to login
  useEffect(() => {
    setOnUnauthorized(() => {
      setIsAuthenticated(false);
    });
  }, []);

  if (isLoading) {
    return (
      <View style={[loadingStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[loadingStyles.text, { color: colors.textSecondary }]}>
          Conectando con el servidor...
        </Text>
      </View>
    );
  }

  if (!backendAvailable) {
    return (
      <View style={[loadingStyles.container, { backgroundColor: colors.background }]}>
        <View style={[loadingStyles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>⚠️</Text>
          <Text style={[loadingStyles.errorTitle, { color: colors.text }]}>
            Backend No Disponible
          </Text>
          <Text style={[loadingStyles.errorSubtitle, { color: colors.textSecondary }]}>
            No se puede conectar con el servidor en {getServerUrlSync()}
          </Text>

          <View style={[loadingStyles.hintBox, { backgroundColor: colors.warningLight, borderColor: colors.warningBorder }]}>
            <Text style={[loadingStyles.hintTitle, { color: colors.warning }]}>
              ¿Por qué veo esto?
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
              La aplicación requiere que el backend Python esté corriendo.
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Ejecute: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
            </Text>
          </View>

          {error && (
            <View style={[loadingStyles.errorMsgBox, { backgroundColor: colors.errorLight, borderColor: colors.errorBorder }]}>
              <Text style={{ fontSize: 12, color: colors.error }}>Error: {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[loadingStyles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setIsLoading(true);
              setRetryCount(prev => prev + 1);
            }}
          >
            <Text style={loadingStyles.retryButtonText}>Reintentar Conexión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <UserProvider>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'Episodes' : 'Login'}
        screenOptions={{ headerShown: false, freezeOnBlur: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Episodes" component={EpisodesScreen} />
        <Stack.Screen name="NewEpisode" component={NewEpisodeScreen} />
        <Stack.Screen name="ClinicalNote" component={ClinicalNoteScreen} />
      </Stack.Navigator>
    </UserProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 15,
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  hintBox: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMsgBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  retryButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
