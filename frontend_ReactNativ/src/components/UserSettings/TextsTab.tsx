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
import type { PredefinedText } from '../../types';
import { makeTabStyles } from './tabStyles';

interface Props {
  visible: boolean;
}

export function TextsTab({ visible }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [predefinedTexts, setPredefinedTexts] = useState<PredefinedText[]>([]);
  const [ptLoading, setPtLoading] = useState(false);
  const [newPtTitle, setNewPtTitle] = useState('');
  const [newPtContent, setNewPtContent] = useState('');
  const [ptEditId, setPtEditId] = useState<number | null>(null);
  const [ptEditTitle, setPtEditTitle] = useState('');
  const [ptEditContent, setPtEditContent] = useState('');
  const [ptError, setPtError] = useState('');
  const [ptSaving, setPtSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPredefinedTexts();
      setNewPtTitle('');
      setNewPtContent('');
      setPtEditId(null);
      setPtError('');
    }
  }, [visible]);

  const loadPredefinedTexts = async () => {
    setPtLoading(true);
    try {
      const list = await api.listPredefinedTexts();
      setPredefinedTexts(list);
    } catch {
      // ignore — not available offline
    } finally {
      setPtLoading(false);
    }
  };

  const handleAddPredefinedText = async () => {
    if (!newPtTitle.trim() || !newPtContent.trim()) return;
    setPtSaving(true);
    setPtError('');
    try {
      await api.createPredefinedText({ title: newPtTitle.trim(), content: newPtContent.trim() });
      setNewPtTitle('');
      setNewPtContent('');
      await loadPredefinedTexts();
    } catch (err: any) {
      setPtError(err.message || t.common.error);
    } finally {
      setPtSaving(false);
    }
  };

  const handleUpdatePredefinedText = async () => {
    if (!ptEditId) return;
    setPtSaving(true);
    setPtError('');
    try {
      await api.updatePredefinedText(ptEditId, { title: ptEditTitle, content: ptEditContent });
      setPtEditId(null);
      await loadPredefinedTexts();
    } catch (err: any) {
      setPtError(err.message || t.common.error);
    } finally {
      setPtSaving(false);
    }
  };

  const handleTogglePtActive = async (pt: PredefinedText) => {
    try {
      await api.updatePredefinedText(pt.id, { active: !pt.active });
      await loadPredefinedTexts();
    } catch { /* ignore */ }
  };

  const handleDeletePredefinedText = async (id: number) => {
    try {
      await api.deletePredefinedText(id);
      await loadPredefinedTexts();
    } catch (err: any) {
      setPtError(err.message || t.common.error);
    }
  };

  const base = makeTabStyles(colors);
  const styles = StyleSheet.create({
    ptItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ptTitle: { flex: 1, fontWeight: '600', color: colors.text, fontSize: 13 },
    ptContent: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
    ptActionsRow: { flexDirection: 'row', gap: 8 },
    ptActionBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    ptEditBtn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    ptDeleteBtn: { borderColor: colors.error, backgroundColor: colors.errorLight },
    ptToggleBtn: { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
    ptActionText: { fontSize: 11, fontWeight: '600' },
    ptEditText: { color: colors.primary },
    ptDeleteText: { color: colors.error },
    ptToggleText: { color: colors.textSecondary },
    ptAddSection: { marginTop: 16 },
    ptAddTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
    ptAddButton: {
      padding: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    ptAddButtonText: { color: '#FFF', fontWeight: '600' },
    ptEditBox: {
      padding: 12,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      borderRadius: 10,
      marginBottom: 8,
    },
    ptEditTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  });

  return (
    <>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
        {t.predefinedTexts.desc}
      </Text>

      {ptLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : predefinedTexts.length === 0 ? (
        <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
          {t.predefinedTexts.noTexts}
        </Text>
      ) : (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }}>
          {predefinedTexts.map(pt => (
            <View key={pt.id} style={styles.ptItem}>
              {ptEditId === pt.id ? (
                <View style={styles.ptEditBox}>
                  <Text style={styles.ptEditTitle}>{t.common.edit}</Text>
                  <Text style={base.label}>{t.predefinedTexts.titlePlaceholder}</Text>
                  <TextInput
                    style={base.input}
                    value={ptEditTitle}
                    onChangeText={setPtEditTitle}
                    editable={!ptSaving}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={base.label}>{t.predefinedTexts.contentPlaceholder}</Text>
                  <TextInput
                    style={[base.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={ptEditContent}
                    onChangeText={setPtEditContent}
                    multiline
                    editable={!ptSaving}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[base.cancelButton, { flex: 0, paddingHorizontal: 16 }]}
                      onPress={() => setPtEditId(null)}
                      disabled={ptSaving}
                    >
                      <Text style={base.cancelButtonText}>{t.predefinedTexts.cancel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[base.saveButton, { flex: 0, paddingHorizontal: 16 }, ptSaving && { opacity: 0.6 }]}
                      onPress={handleUpdatePredefinedText}
                      disabled={ptSaving}
                    >
                      {ptSaving
                        ? <ActivityIndicator color="#FFF" size="small" />
                        : <Text style={base.saveButtonText}>{t.predefinedTexts.save}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.ptTitle}>{pt.title}</Text>
                  <Text style={styles.ptContent} numberOfLines={2}>{pt.content}</Text>
                  <View style={styles.ptActionsRow}>
                    <TouchableOpacity
                      style={[styles.ptActionBtn, styles.ptEditBtn]}
                      onPress={() => { setPtEditId(pt.id); setPtEditTitle(pt.title); setPtEditContent(pt.content); }}
                    >
                      <Text style={[styles.ptActionText, styles.ptEditText]}>{t.predefinedTexts.edit}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ptActionBtn, styles.ptToggleBtn]}
                      onPress={() => handleTogglePtActive(pt)}
                    >
                      <Text style={[styles.ptActionText, styles.ptToggleText]}>
                        {pt.active ? t.predefinedTexts.active : t.predefinedTexts.inactive}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ptActionBtn, styles.ptDeleteBtn]}
                      onPress={() => handleDeletePredefinedText(pt.id)}
                    >
                      <Text style={[styles.ptActionText, styles.ptDeleteText]}>{t.predefinedTexts.delete}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {ptError !== '' && (
        <View style={[base.errorBox, { marginTop: 8 }]}>
          <Text style={base.errorText}>{ptError}</Text>
        </View>
      )}

      <View style={styles.ptAddSection}>
        <Text style={styles.ptAddTitle}>{t.predefinedTexts.addText}</Text>
        <Text style={base.label}>{t.predefinedTexts.titlePlaceholder}</Text>
        <TextInput
          style={base.input}
          value={newPtTitle}
          onChangeText={setNewPtTitle}
          placeholder={t.predefinedTexts.titlePlaceholder}
          placeholderTextColor={colors.textTertiary}
          editable={!ptSaving}
        />
        <Text style={base.label}>{t.predefinedTexts.contentPlaceholder}</Text>
        <TextInput
          style={[base.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={newPtContent}
          onChangeText={setNewPtContent}
          placeholder={t.predefinedTexts.contentPlaceholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          editable={!ptSaving}
        />
        <TouchableOpacity
          style={[styles.ptAddButton, (!newPtTitle.trim() || !newPtContent.trim() || ptSaving) && { opacity: 0.5 }]}
          onPress={handleAddPredefinedText}
          disabled={!newPtTitle.trim() || !newPtContent.trim() || ptSaving}
        >
          {ptSaving
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={styles.ptAddButtonText}>{t.predefinedTexts.addText}</Text>}
        </TouchableOpacity>
      </View>
      <View style={{ height: 30 }} />
    </>
  );
}
