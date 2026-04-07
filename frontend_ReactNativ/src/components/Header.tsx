import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
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
  const { user: currentUser, updateUser } = useUser();
  const storedUser = auth.getUser();
  const { theme, toggleTheme, colors } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      paddingTop: 48,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleText: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeOnline: { backgroundColor: colors.badgeOnlineBg },
    badgeOffline: { backgroundColor: colors.badgeOfflineBg },
    badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    badgeOnlineText: { color: colors.badgeOnlineText },
    badgeOfflineText: { color: colors.badgeOfflineText },
    right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    langButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    langText: { fontSize: 12, fontWeight: '700', color: colors.text },
    themeButton: { padding: 8 },
    themeText: { fontSize: 18 },
    userButton: { paddingHorizontal: 8, paddingVertical: 4 },
    userName: { fontSize: 13, fontWeight: '500', color: colors.text },
    userRole: { fontSize: 11, color: colors.textSecondary },
    logoutButton: {
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    logoutText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
    // Dropdown
    dropdownOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 90,
    },
    langDropdown: {
      position: 'absolute',
      top: 90,
      right: 120,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 100,
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
        <View style={styles.left}>
          <Text style={styles.titleText}>TrakCare Offline</Text>
          <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
            <View style={[styles.badgeDot, { backgroundColor: isOnline ? '#22C55E' : '#EF4444' }]} />
            <Text style={[styles.badgeText, isOnline ? styles.badgeOnlineText : styles.badgeOfflineText]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        {storedUser && (
          <View style={styles.right}>
            <TouchableOpacity style={styles.langButton} onPress={() => setShowLanguageMenu(!showLanguageMenu)}>
              <Text style={styles.langText}>{language.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
              <Text style={styles.themeText}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.userButton} onPress={() => setShowSettings(true)}>
              <Text style={styles.userName}>{storedUser.username}</Text>
              <Text style={styles.userRole}>{storedUser.role}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>{t.header.logout}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showLanguageMenu && (
        <>
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowLanguageMenu(false)}
          />
          <View style={styles.langDropdown}>
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
        </>
      )}

      {currentUser && (
        <UserSettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          user={currentUser}
          onUserUpdated={(user) => updateUser(user)}
        />
      )}
    </>
  );
}
