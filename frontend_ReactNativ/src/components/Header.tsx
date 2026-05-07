import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { auth } from '../lib/auth';
import { UserSettingsModal } from './UserSettingsModal';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, any>;
};

export function Header({ navigation }: Props) {
  const { isOnline } = useConnectionStatus();
  const { isBackendReachable } = useConnectivity();
  // 3 estados: offline (sin servidor local) → local (servidor local OK pero
  // central caído) → online (cadena completa). LOCAL usa la paleta warning,
  // igual que los mensajes de "pendientes".
  const connectionState: 'offline' | 'local' | 'online' =
    !isBackendReachable ? 'offline' : !isOnline ? 'local' : 'online';
  const { user: currentUser, updateUser } = useUser();
  const storedUser = auth.getUser();
  const { theme, toggleTheme, colors } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const langButtonRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await auth.logout();
    updateUser(null);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const styles = StyleSheet.create({
    header: {
      backgroundColor: colors.headerBg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: insets.top + 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 28,
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 10,
      gap: 8,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleText: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    statusWrap: { position: 'absolute', right: 0 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeOnline: { backgroundColor: colors.badgeOnlineBg },
    badgeOffline: { backgroundColor: colors.badgeOfflineBg },
    badgeLocal: { backgroundColor: colors.badgeLocalBg },
    badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    badgeOnlineText: { color: colors.badgeOnlineText },
    badgeOfflineText: { color: colors.badgeOfflineText },
    badgeLocalText: { color: colors.badgeLocalText },
    langButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    langText: { fontSize: 12, fontWeight: '700', color: colors.text },
    themeButton: { padding: 8, marginRight: 'auto' },
    themeText: { fontSize: 18 },
    userButton: { paddingHorizontal: 8, paddingVertical: 4 },
    userName: { fontSize: 13, fontWeight: '500', color: colors.text },
    userRole: { fontSize: 11, color: colors.textSecondary },
    // Dropdown
    dropdownOverlay: {
      flex: 1,
    },
    langDropdown: {
      position: 'absolute',
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      width: 60,
    },
    langOption: { paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
    langOptionActive: { backgroundColor: colors.primaryLight },
    langOptionText: { fontWeight: '700', fontSize: 13 },
    langOptionTextActive: { color: colors.primary },
    langOptionTextInactive: { color: colors.text },
  });

  return (
    <>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.titleText}>TrakCare Offline</Text>
          <View style={[styles.left, styles.statusWrap]}>
            <View
              style={[
                styles.badge,
                connectionState === 'online'
                  ? styles.badgeOnline
                  : connectionState === 'local'
                  ? styles.badgeLocal
                  : styles.badgeOffline,
              ]}
            >
              <View
                style={[
                  styles.badgeDot,
                  {
                    backgroundColor:
                      connectionState === 'online'
                        ? '#22C55E'
                        : connectionState === 'local'
                        ? colors.warning
                        : '#EF4444',
                  },
                ]}
              />
              <Text
                style={[
                  styles.badgeText,
                  connectionState === 'online'
                    ? styles.badgeOnlineText
                    : connectionState === 'local'
                    ? styles.badgeLocalText
                    : styles.badgeOfflineText,
                ]}
              >
                {connectionState === 'online'
                  ? 'ONLINE'
                  : connectionState === 'local'
                  ? 'LOCAL'
                  : 'OFFLINE'}
              </Text>
            </View>
          </View>
        </View>

        {storedUser && (
          <View style={styles.bottomRow}>

            <View ref={langButtonRef} collapsable={false}>
              <TouchableOpacity style={styles.langButton} onPress={() => {
                langButtonRef.current?.measureInWindow((x, y, width, height) => {
                  setMenuPosition({ top: y + height + 4, left: x });
                  setShowLanguageMenu(true);
                });
              }}>
                <Text style={styles.langText}>{language.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
              <Text style={styles.themeText}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.userButton} onPress={() => setShowSettings(true)}>
              <Text style={styles.userName}>{storedUser.username}</Text>
              <Text style={styles.userRole}>{storedUser.role}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={showLanguageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageMenu(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageMenu(false)}
        >
          <View style={[styles.langDropdown, { top: menuPosition.top, left: menuPosition.left }]}>
            {(['es', 'en'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, language === lang && styles.langOptionActive]}
                onPress={() => {
                  setLanguage(lang);
                  setShowLanguageMenu(false);
                }}
              >
                <Text
                  style={[
                    styles.langOptionText,
                    language === lang ? styles.langOptionTextActive : styles.langOptionTextInactive,
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {currentUser && (
        <UserSettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          user={currentUser}
          onUserUpdated={(user) => updateUser(user)}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
