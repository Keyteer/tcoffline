import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
import { ConnectivityProvider } from './src/contexts/ConnectivityContext';
import { auth } from './src/lib/auth';
import { api, setOnUnauthorized } from './src/lib/api';
import { loadServerUrl } from './src/lib/serverConfig';

import { ServerDiscoveryScreen } from './src/screens/ServerDiscoveryScreen';
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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Load stored server URL first
        await loadServerUrl();

        // Initialize auth cache from secure storage
        await auth.init();

        // Check backend health
        try {
          await api.getHealth();
          setBackendAvailable(true);
        } catch {
          setBackendAvailable(false);
        }

        // Check if user is already authenticated
        setIsAuthenticated(auth.isAuthenticated());
      } catch {
        setBackendAvailable(false);
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

  // Determine the initial route based on connectivity and auth state
  // If backend is down, always show ServerDiscovery (which offers "Resume last connection" if credentials exist)
  const initialRoute = !backendAvailable
    ? 'ServerDiscovery'
    : isAuthenticated
      ? 'Episodes'
      : 'Login';

  return (
    <ConnectivityProvider>
      <UserProvider>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, freezeOnBlur: false }}
        >
          <Stack.Screen name="ServerDiscovery" component={ServerDiscoveryScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Episodes" component={EpisodesScreen} />
          <Stack.Screen name="NewEpisode" component={NewEpisodeScreen} />
          <Stack.Screen name="ClinicalNote" component={ClinicalNoteScreen} />
        </Stack.Navigator>
      </UserProvider>
    </ConnectivityProvider>
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
});
