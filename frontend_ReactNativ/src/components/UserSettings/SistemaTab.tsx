import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Eye, EyeOff } from 'react-native-feather';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { api } from '../../lib/api';
import type { SystemConfigResponse } from '../../types';
import { makeTabStyles } from './tabStyles';

interface Props {
  visible: boolean;
}

export function SistemaTab({ visible }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [configLoading, setConfigLoading] = useState(false);
  const [configFields, setConfigFields] = useState<Partial<SystemConfigResponse>>({});
  const [showConfigPassword, setShowConfigPassword] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAdminConfig();
      setConfigError('');
      setConfigSuccess('');
      setShowConfigPassword(false);
    }
  }, [visible]);

  const loadAdminConfig = async () => {
    setConfigLoading(true);
    try {
      const cfg = await api.getAdminConfig();
      setConfigFields({ ...cfg });
    } catch {
      // ignore
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveAdminConfig = async () => {
    setConfigSaving(true);
    setConfigError('');
    setConfigSuccess('');
    try {
      const updated = await api.updateAdminConfig(configFields);
      setConfigFields({ ...updated });
      setConfigSuccess(t.adminConfig.saveSuccess);
      setTimeout(() => setConfigSuccess(''), 3000);
    } catch (err: any) {
      setConfigError(err.message || t.adminConfig.saveError);
    } finally {
      setConfigSaving(false);
    }
  };

  const base = makeTabStyles(colors);
  const styles = StyleSheet.create({
    configNote: {
      fontSize: 12,
      color: colors.textTertiary,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    configGroup: { marginBottom: 16 },
    configGroupTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    passwordInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    passwordInput: { flex: 1, marginBottom: 0 },
    eyeButton: {
      padding: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      backgroundColor: colors.inputBg,
    },
  });

  return (
    <>
      <Text style={styles.configNote}>{t.adminConfig.effectNote}</Text>

      {configLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          {/* Connection group */}
          <View style={styles.configGroup}>
            <Text style={styles.configGroupTitle}>{t.adminConfig.groupConnection}</Text>
            {([
              ['centralUrl', 'central_url'],
              ['centralApiEndpoint', 'central_api_endpoint'],
              ['centralHl7Endpoint', 'central_hl7_endpoint'],
              ['centralUsersEndpoint', 'central_users_endpoint'],
            ] as [keyof typeof t.adminConfig, keyof SystemConfigResponse][]).map(([labelKey, fieldKey]) => (
              <View key={fieldKey}>
                <Text style={base.label}>{t.adminConfig[labelKey] as string}</Text>
                <TextInput
                  style={base.input}
                  value={String(configFields[fieldKey] ?? '')}
                  onChangeText={(v) => setConfigFields(prev => ({ ...prev, [fieldKey]: v }))}
                  placeholderTextColor={colors.textTertiary}
                  editable={!configSaving}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
          </View>

          {/* Credentials group */}
          <View style={styles.configGroup}>
            <Text style={styles.configGroupTitle}>{t.adminConfig.groupCredentials}</Text>
            <Text style={base.label}>{t.adminConfig.centralApiUsername}</Text>
            <TextInput
              style={base.input}
              value={String(configFields.central_api_username ?? '')}
              onChangeText={(v) => setConfigFields(prev => ({ ...prev, central_api_username: v }))}
              placeholderTextColor={colors.textTertiary}
              editable={!configSaving}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={base.label}>{t.adminConfig.centralApiPassword}</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[base.input, styles.passwordInput]}
                value={String(configFields.central_api_password ?? '')}
                onChangeText={(v) => setConfigFields(prev => ({ ...prev, central_api_password: v }))}
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showConfigPassword}
                editable={!configSaving}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfigPassword(p => !p)}
              >
                {showConfigPassword ? (
                  <EyeOff width={16} height={16} color={colors.textSecondary} />
                ) : (
                  <Eye width={16} height={16} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Intervals group */}
          <View style={styles.configGroup}>
            <Text style={styles.configGroupTitle}>{t.adminConfig.groupIntervals}</Text>
            {([
              ['healthCheckInterval', 'health_check_interval'],
              ['downstreamSyncInterval', 'downstream_sync_interval'],
              ['upstreamSyncInterval', 'upstream_sync_interval'],
              ['maxRetries', 'max_retries'],
            ] as [keyof typeof t.adminConfig, keyof SystemConfigResponse][]).map(([labelKey, fieldKey]) => (
              <View key={fieldKey}>
                <Text style={base.label}>{t.adminConfig[labelKey] as string}</Text>
                <TextInput
                  style={base.input}
                  value={String(configFields[fieldKey] ?? '')}
                  onChangeText={(v) => setConfigFields(prev => ({ ...prev, [fieldKey]: v === '' ? undefined : Number(v) }))}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  editable={!configSaving}
                />
              </View>
            ))}
          </View>

          {configError !== '' && (
            <View style={base.errorBox}>
              <Text style={base.errorText}>{configError}</Text>
            </View>
          )}
          {configSuccess !== '' && (
            <View style={base.successBox}>
              <Text style={base.successText}>{configSuccess}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[base.saveButton, configSaving && { opacity: 0.6 }]}
            onPress={handleSaveAdminConfig}
            disabled={configSaving}
          >
            {configSaving
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={base.saveButtonText}>{t.common.save}</Text>}
          </TouchableOpacity>
        </>
      )}
      <View style={{ height: 30 }} />
    </>
  );
}
