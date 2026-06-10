import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { X } from 'react-native-feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { User } from '../../types';
import { SettingsTab } from './SettingsTab';
import { FiltersTab } from './FiltersTab';
import { TextsTab } from './TextsTab';
import { UsersTab } from './UsersTab';
import { SistemaTab } from './SistemaTab';

type TabId = 'settings' | 'filters' | 'texts' | 'users' | 'sistema';

interface UserSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void | Promise<void>;
}

export function UserSettingsModal({ visible, onClose, user, onUserUpdated, onLogout }: UserSettingsModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const [activeTab, setActiveTab] = useState<TabId>('settings');
  const usersScrollHandlerRef = useRef<((event: any) => void) | null>(null);

  const registerUsersScrollHandler = useCallback((handler: ((event: any) => void) | null) => {
    usersScrollHandlerRef.current = handler;
  }, []);

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoutButton: {
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    logoutText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    tabBarWrapper: { borderBottomWidth: 1, borderBottomColor: colors.border },
    tabBar: { flexDirection: 'row', paddingHorizontal: 8 },
    tab: { minWidth: 96, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },
    content: { padding: 16 },
  });

  type TabDef = { id: TabId; label: string };
  const tabs: TabDef[] = [
    { id: 'settings', label: t.userSettings.tabSettings },
    { id: 'filters', label: t.userSettings.tabFilters },
    { id: 'texts', label: t.userSettings.tabTexts },
    ...(user.is_admin
      ? [
          { id: 'users' as TabId, label: t.userSettings.tabUsers },
          { id: 'sistema' as TabId, label: t.userSettings.tabSistema },
        ]
      : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.userSettings.title}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
                <Text style={styles.logoutText}>{t.header.logout}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <X width={22} height={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab bar */}
          <View style={styles.tabBarWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBar}
            >
              {tabs.map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            onScroll={(event) => {
              if (activeTab === 'users' && usersScrollHandlerRef.current) {
                usersScrollHandlerRef.current(event);
              }
            }}
            scrollEventThrottle={16}
          >
            {activeTab === 'settings' && (
              <SettingsTab user={user} visible={visible} onClose={onClose} onUserUpdated={onUserUpdated} />
            )}
            {activeTab === 'filters' && (
              <FiltersTab user={user} visible={visible} onClose={onClose} onUserUpdated={onUserUpdated} />
            )}
            {activeTab === 'texts' && (
              <TextsTab visible={visible} />
            )}
            {activeTab === 'users' && user.is_admin && (
              <UsersTab visible={visible} onRegisterScrollHandler={registerUsersScrollHandler} />
            )}
            {activeTab === 'sistema' && user.is_admin && (
              <SistemaTab visible={visible} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
