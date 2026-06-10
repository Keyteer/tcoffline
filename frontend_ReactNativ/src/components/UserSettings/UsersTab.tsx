import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { X } from 'react-native-feather';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { api } from '../../lib/api';
import type { User } from '../../types';
import { makeTabStyles } from './tabStyles';
import { PAGE_SIZE } from '../../config/env';

interface Props {
  visible: boolean;
  onRegisterScrollHandler?: (handler: ((event: any) => void) | null) => void;
}

export function UsersTab({ visible, onRegisterScrollHandler }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [users, setUsers] = useState<User[]>([]);
  const [usersQuery, setUsersQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (visible) {
      loadUsers();
      setUsersQuery('');
      setVisibleCount(PAGE_SIZE);
      setShowCreateUser(false);
      setNewUsername('');
      setNewPassword('');
      setNewNombre('');
      setNewIsAdmin(false);
      setError('');
      setSuccess('');
    }
  }, [visible]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [usersQuery]);

  const loadUsers = async () => {
    try {
      const list = await api.listUsers();
      setUsers(list);
    } catch { /* ignore — not available offline */ }
  };

  const filteredUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.username || '').toLowerCase().includes(q) || (u.nombre || '').toLowerCase().includes(q)
    );
  }, [users, usersQuery]);

  const visibleUsers = filteredUsers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredUsers.length;

  const handleUsersScroll = (event: any) => {
    if (!hasMore) return;
    if (!event?.nativeEvent) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
    if (nearBottom) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredUsers.length));
    }
  };

  useEffect(() => {
    onRegisterScrollHandler?.(handleUsersScroll);
    return () => onRegisterScrollHandler?.(null);
  }, [onRegisterScrollHandler, hasMore, filteredUsers.length]);

  const cancelCreate = () => {
    setShowCreateUser(false);
    setNewUsername('');
    setNewPassword('');
    setNewNombre('');
    setNewIsAdmin(false);
    setError('');
  };

  const handleCreateUser = async () => {
    setError('');
    setSuccess('');
    if (!newUsername || !newPassword) {
      setError(t.userSettings.credentialsRequired);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createUser({
        username: newUsername,
        password: newPassword,
        nombre: newNombre || undefined,
        is_admin: newIsAdmin,
      });
      setSuccess(t.userSettings.createUserSuccess);
      cancelCreate();
      loadUsers();
    } catch (err: any) {
      setError(err.message || t.userSettings.createUserError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const base = makeTabStyles(colors);
  const styles = StyleSheet.create({
    userCard: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userName: { fontWeight: '600', color: colors.text, fontSize: 14 },
    adminBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    adminBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
    userNombre: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    userStatus: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    createUserForm: {
      padding: 16,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      borderRadius: 12,
      marginBottom: 12,
    },
    createUserHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    createUserTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      marginBottom: 12,
    },
    switchLabel: { fontSize: 13, fontWeight: '500', color: colors.text },
    switchHint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  });

  return (
    <>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
        {t.userSettings.systemUsersTitle}
      </Text>

      {/* Create user button / form — at TOP */}
      {!showCreateUser ? (
        <TouchableOpacity
          style={[base.saveButton, { marginBottom: 12 }]}
          onPress={() => setShowCreateUser(true)}
        >
          <Text style={base.saveButtonText}>{t.userSettings.createUserButton}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.createUserForm}>
          <View style={styles.createUserHeader}>
            <Text style={styles.createUserTitle}>{t.userSettings.newUserTitle}</Text>
            <TouchableOpacity onPress={cancelCreate}>
              <X width={22} height={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={base.label}>{t.userSettings.usernameLabel}</Text>
          <TextInput
            style={base.input}
            value={newUsername}
            onChangeText={setNewUsername}
            placeholder={t.userSettings.newUsernamePlaceholder}
            placeholderTextColor={colors.textTertiary}
            editable={!isSubmitting}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={base.label}>{t.login.password}</Text>
          <TextInput
            style={base.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t.login.password}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            editable={!isSubmitting}
          />

          <Text style={base.label}>{t.userSettings.fullNameLabel}</Text>
          <TextInput
            style={base.input}
            value={newNombre}
            onChangeText={setNewNombre}
            placeholder={t.userSettings.newFullNamePlaceholder}
            placeholderTextColor={colors.textTertiary}
            editable={!isSubmitting}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t.userSettings.isAdminLabel}</Text>
              <Text style={styles.switchHint}>{t.userSettings.isAdminHint}</Text>
            </View>
            <Switch
              value={newIsAdmin}
              onValueChange={setNewIsAdmin}
              disabled={isSubmitting}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          {error !== '' && (
            <View style={base.errorBox}>
              <Text style={base.errorText}>{error}</Text>
            </View>
          )}
          {success !== '' && (
            <View style={base.successBox}>
              <Text style={base.successText}>{success}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[base.saveButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleCreateUser}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={base.saveButtonText}>{t.userSettings.createUserSubmitButton}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <TextInput
        style={[base.input, { marginBottom: 12 }]}
        value={usersQuery}
        onChangeText={setUsersQuery}
        placeholder={t.userSettings.userSearchPlaceholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* User list */}
      <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
        {visibleUsers.length === 0 ? (
          <View style={styles.userCard}>
            <Text style={styles.userStatus}>{t.userSettings.noUsersFound}</Text>
          </View>
        ) : (
          visibleUsers.map(u => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userRow}>
                <Text style={styles.userName}>{u.username}</Text>
                {u.is_admin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>{t.userSettings.adminBadge}</Text>
                  </View>
                )}
              </View>
              {u.nombre ? <Text style={styles.userNombre}>{u.nombre}</Text> : null}
              <Text style={styles.userStatus}>
                {t.userSettings.statusLabel}: {u.active ? t.userSettings.statusActive : t.userSettings.statusInactive}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={[base.hint, { marginTop: 8 }]}>
        {visibleUsers.length}/{filteredUsers.length}
      </Text>

      <View style={{ height: 30 }} />
    </>
  );
}
