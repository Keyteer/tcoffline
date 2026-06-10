import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { api } from '../../lib/api';
import { auth } from '../../lib/auth';
import type { User } from '../../types';
import { makeTabStyles } from './tabStyles';

interface Props {
  user: User;
  visible: boolean;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export function SettingsTab({ user, visible, onClose, onUserUpdated }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [nombre, setNombre] = useState(user.nombre || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableReadOnlyMode, setEnableReadOnlyMode] = useState(true);
  const [enableNewEpisodeButton, setEnableNewEpisodeButton] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (visible) {
      setNombre(user.nombre || '');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
      api.getSystemSettings().then(s => {
        setEnableReadOnlyMode(s.enable_read_only_mode);
        setEnableNewEpisodeButton(s.enable_new_episode_button);
      }).catch(() => {});
    }
  }, [visible]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (password && password !== confirmPassword) {
      setError(t.userSettings.passwordsNoMatch);
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: { password?: string; nombre?: string } = {};
      let hasUserChanges = false;
      let hasSystemChanges = false;

      if (password) { updateData.password = password; hasUserChanges = true; }
      if (nombre !== (user.nombre || '')) { updateData.nombre = nombre; hasUserChanges = true; }

      if (user.is_admin) {
        const currentSettings = await api.getSystemSettings();
        if (
          enableReadOnlyMode !== currentSettings.enable_read_only_mode ||
          enableNewEpisodeButton !== currentSettings.enable_new_episode_button
        ) {
          hasSystemChanges = true;
        }
      }

      if (!hasUserChanges && !hasSystemChanges) {
        setError(t.userSettings.noChanges);
        setIsSubmitting(false);
        return;
      }

      if (hasUserChanges) {
        const updatedUser = await api.updateCurrentUser(updateData);
        auth.updateUser(updatedUser);
        onUserUpdated(updatedUser);
      }

      if (hasSystemChanges) {
        await api.updateSystemSettings({
          enable_read_only_mode: enableReadOnlyMode,
          enable_new_episode_button: enableNewEpisodeButton,
        });
      }

      setSuccess(t.userSettings.saveSuccess);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || t.userSettings.saveError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const base = makeTabStyles(colors);
  const styles = StyleSheet.create({
    adminSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
      marginTop: 8,
    },
    adminSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
    readOnlyBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      backgroundColor: colors.warningLight,
      borderRadius: 10,
    },
    readOnlyLabel: { fontSize: 13, fontWeight: '500', color: colors.warning },
    readOnlyHint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  });

  return (
    <>
      <Text style={base.label}>{t.userSettings.usernameLabel}</Text>
      <TextInput
        style={[base.input, base.inputDisabled]}
        value={user.username}
        editable={false}
      />

      <Text style={base.label}>{t.userSettings.fullNameLabel}</Text>
      <TextInput
        style={base.input}
        value={nombre}
        onChangeText={setNombre}
        placeholder={t.userSettings.fullNamePlaceholder}
        placeholderTextColor={colors.textTertiary}
        editable={!isSubmitting}
      />
      <Text style={base.hint}>{t.userSettings.fullNameHint}</Text>

      <Text style={base.label}>{t.userSettings.newPasswordLabel}</Text>
      <TextInput
        style={base.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t.userSettings.newPasswordPlaceholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        editable={!isSubmitting}
      />

      <Text style={base.label}>{t.userSettings.confirmPasswordLabel}</Text>
      <TextInput
        style={base.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t.userSettings.confirmPasswordPlaceholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        editable={!isSubmitting}
      />

      {user.is_admin && (
        <View style={styles.adminSection}>
          <Text style={styles.adminSectionTitle}>{t.systemSettings.sectionTitle}</Text>
          <View style={styles.readOnlyBox}>
            <Switch
              value={enableReadOnlyMode}
              onValueChange={setEnableReadOnlyMode}
              disabled={isSubmitting}
              trackColor={{ false: colors.border, true: colors.warning }}
              thumbColor="#FFF"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.readOnlyLabel}>{t.systemSettings.readOnlyModeLabel}</Text>
              <Text style={styles.readOnlyHint}>{t.systemSettings.readOnlyModeDesc}</Text>
            </View>
          </View>
          <View style={[styles.readOnlyBox, { marginTop: 12 }]}>
            <Switch
              value={enableNewEpisodeButton}
              onValueChange={setEnableNewEpisodeButton}
              disabled={isSubmitting}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.readOnlyLabel}>{t.systemSettings.newEpisodeButtonLabel}</Text>
              <Text style={styles.readOnlyHint}>{t.systemSettings.newEpisodeButtonDesc}</Text>
            </View>
          </View>
        </View>
      )}

      {error !== '' && (
        <View style={[base.errorBox, { marginTop: 12 }]}>
          <Text style={base.errorText}>{error}</Text>
        </View>
      )}
      {success !== '' && (
        <View style={[base.successBox, { marginTop: 12 }]}>
          <Text style={base.successText}>{success}</Text>
        </View>
      )}

      <View style={base.buttonRow}>
        <TouchableOpacity style={base.cancelButton} onPress={onClose} disabled={isSubmitting}>
          <Text style={base.cancelButtonText}>{t.common.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[base.saveButton, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={base.saveButtonText}>{t.common.save}</Text>}
        </TouchableOpacity>
      </View>
      <View style={{ height: 30 }} />
    </>
  );
}
