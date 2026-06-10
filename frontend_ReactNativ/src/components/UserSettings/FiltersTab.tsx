import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { api } from '../../lib/api';
import { auth } from '../../lib/auth';
import type { User } from '../../types';
import { makeTabStyles } from './tabStyles';
import { FiltrosState, parseFiltros, serializeFiltros } from './types';

interface Props {
  user: User;
  visible: boolean;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export function FiltersTab({ user, visible, onClose, onUserUpdated }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [filtros, setFiltros] = useState<FiltrosState>(parseFiltros(user.filtros));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (visible) {
      setFiltros(parseFiltros(user.filtros));
      setError('');
      setSuccess('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    const newFiltrosStr = serializeFiltros(filtros);
    if (newFiltrosStr === (user.filtros || '')) {
      setError(t.userSettings.noChanges);
      return;
    }
    setIsSubmitting(true);
    try {
      const updatedUser = await api.updateCurrentUser({ filtros: newFiltrosStr });
      auth.updateUser(updatedUser);
      onUserUpdated(updatedUser);
      setSuccess(t.userSettings.saveSuccess);
      api.syncFromCentral().catch(() => {});
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
    oruBox: {
      padding: 12,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      borderRadius: 10,
      marginBottom: 16,
    },
    oruLabel: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 4 },
    oruHint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
    oruInput: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      marginTop: 6,
    },
    sectionBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 16,
    },
    sectionHeader: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionItemLast: {
      padding: 12,
    },
    sectionInput: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      marginTop: 4,
    },
  });

  return (
    <>
      {/* Usuario ORU — used in HL7 OBR.24 */}
      <View style={styles.oruBox}>
        <Text style={styles.oruLabel}>{t.userSettings.filterOruUserLabel}</Text>
        <TextInput
          style={styles.oruInput}
          value={filtros.user}
          onChangeText={(v) => setFiltros(f => ({ ...f, user: v }))}
          placeholder={t.userSettings.filterOruUserPlaceholder}
          placeholderTextColor={colors.textTertiary}
          editable={!isSubmitting}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.oruHint}>{t.userSettings.filterOruUserHint}</Text>
      </View>

      {/* Episode filters */}
      <View style={styles.sectionBox}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{t.userSettings.filterEpisodeSection}</Text>
        </View>

        <View style={styles.sectionItem}>
          <Text style={base.label}>{t.userSettings.filterTipo}</Text>
          <TextInput
            style={styles.sectionInput}
            value={filtros.Tipo}
            onChangeText={(v) => setFiltros(f => ({ ...f, Tipo: v }))}
            placeholder={t.userSettings.filterTipoPlaceholder}
            placeholderTextColor={colors.textTertiary}
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.sectionItem}>
          <Text style={base.label}>{t.userSettings.filterHospital}</Text>
          <TextInput
            style={styles.sectionInput}
            value={filtros.Hospital}
            onChangeText={(v) => setFiltros(f => ({ ...f, Hospital: v }))}
            placeholder={t.userSettings.filterHospitalPlaceholder}
            placeholderTextColor={colors.textTertiary}
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.sectionItem}>
          <Text style={base.label}>{t.userSettings.filterLocal}</Text>
          <TextInput
            style={styles.sectionInput}
            value={filtros.Local}
            onChangeText={(v) => setFiltros(f => ({ ...f, Local: v }))}
            placeholder={t.userSettings.filterLocalPlaceholder}
            placeholderTextColor={colors.textTertiary}
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.sectionItemLast}>
          <Text style={base.label}>{t.userSettings.filterProfesional}</Text>
          <TextInput
            style={styles.sectionInput}
            value={filtros.Profesional}
            onChangeText={(v) => setFiltros(f => ({ ...f, Profesional: v }))}
            placeholder={t.userSettings.filterProfesionalPlaceholder}
            placeholderTextColor={colors.textTertiary}
            editable={!isSubmitting}
          />
        </View>
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
