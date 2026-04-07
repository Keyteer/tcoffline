import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header } from '../components/Header';
import { PatientHistoryModal } from '../components/PatientHistoryModal';
import { api } from '../lib/api';
import type { EpisodeDetail, ClinicalNote } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClinicalNote'>;
  route: RouteProp<RootStackParamList, 'ClinicalNote'>;
};

export function ClinicalNoteScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { isReadOnlyMode } = useUser();
  const { t, language } = useLanguage();
  const { colors } = useTheme();
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const loadNotes = async () => {
    try {
      const notesData = await api.getClinicalNotes(id);
      setNotes(notesData);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const hasPendingNotes = notes.some((note) => !note.synced_flag);
      if (hasPendingNotes) {
        await loadNotes();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [notes]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [episodeData, notesData] = await Promise.all([
          api.getEpisode(id),
          api.getClinicalNotes(id),
        ]);

        if (!episodeData.paciente && episodeData.data?.Paciente) {
          episodeData.paciente = episodeData.data.Paciente;
        }
        if (!episodeData.paciente && episodeData.data?.Nombre) {
          episodeData.paciente = episodeData.data.Nombre;
        }
        if (!episodeData.profesional && episodeData.data?.Profesional) {
          episodeData.profesional = episodeData.data.Profesional;
        }

        setEpisode(episodeData);
        setNotes(notesData);
      } catch {
        setError(t.clinicalNote.loadError);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleSubmit = async () => {
    if (!noteText.trim()) return;
    setIsSaving(true);
    setError('');

    try {
      await api.createClinicalNote(id, { note_text: noteText });
      setSuccessMessage(t.clinicalNote.saveSuccess);
      setNoteText('');
      await loadNotes();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.clinicalNote.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months =
      language === 'es'
        ? ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 16, paddingBottom: 40 },
    backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    backText: { color: colors.primary, fontSize: 14 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    historyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    historyButtonText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
    // Patient info card
    patientCard: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    infoItem: { width: '50%', marginBottom: 12 },
    infoItemFull: { width: '100%', marginBottom: 12 },
    infoLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 2 },
    infoValue: { fontSize: 16, fontWeight: '600', color: colors.text },
    infoValueSmall: { fontSize: 13, color: colors.textSecondary },
    // Notes
    notesSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    notesTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    noteItem: {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      backgroundColor: colors.surfaceSecondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    noteHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 },
    noteAuthor: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    noteDot: { fontSize: 13, color: colors.textSecondary },
    noteDate: { fontSize: 13, color: colors.textSecondary },
    noteBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, },
    noteBadgeSynced: { backgroundColor: colors.successLight },
    noteBadgePending: { backgroundColor: colors.warningLight },
    noteBadgeText: { fontSize: 11, fontWeight: '600' },
    noteBadgeTextSynced: { color: colors.success },
    noteBadgeTextPending: { color: colors.warning },
    noteText: { fontSize: 14, color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    noteAuthorName: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
    // Read only banner
    readOnlyBanner: {
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    readOnlyTitle: { fontWeight: '600', color: colors.warning, marginBottom: 4 },
    readOnlyText: { fontSize: 13, color: colors.warning },
    // Form
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formLabel: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 8 },
    textarea: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 200,
      textAlignVertical: 'top',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    textareaDisabled: { backgroundColor: colors.surfaceSecondary, opacity: 0.6 },
    charCount: { fontSize: 12, color: colors.textTertiary, marginTop: 6, marginBottom: 12 },
    errorBox: {
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: { color: colors.error, fontSize: 14 },
    successBox: {
      backgroundColor: colors.successLight,
      borderWidth: 1,
      borderColor: colors.successBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    successText: { color: colors.success, fontSize: 14 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: { color: colors.textSecondary, fontWeight: '600' },
    submitButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitButtonDisabled: { backgroundColor: colors.textTertiary },
    submitButtonText: { color: '#FFFFFF', fontWeight: '600' },
    errorPage: { padding: 20 },
    errorPageText: {
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      padding: 16,
      color: colors.error,
      fontSize: 14,
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!episode) {
    return (
      <View style={styles.container}>
        <Header navigation={navigation} />
        <View style={styles.errorPage}>
          <Text style={styles.errorPageText}>{t.clinicalNote.episodeNotFound}</Text>
          <TouchableOpacity
            style={[styles.submitButton, { marginTop: 12 }]}
            onPress={() => navigation.navigate('Episodes')}
          >
            <Text style={styles.submitButtonText}>{t.clinicalNote.backToEpisodes}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header navigation={navigation} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Episodes')}>
            <Text style={styles.backText}>← {t.clinicalNote.backToEpisodes}</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <Text style={styles.title}>{t.clinicalNote.clinicalRecord}</Text>
            <TouchableOpacity style={styles.historyButton} onPress={() => setShowHistory(true)}>
              <Text style={styles.historyButtonText}>{t.patientHistory.title}</Text>
            </TouchableOpacity>
          </View>

          {/* Patient Info Card */}
          <View style={styles.patientCard}>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t.clinicalNote.patient}</Text>
                <Text style={styles.infoValue}>{episode.paciente || 'Sin nombre'}</Text>
                {episode.run ? <Text style={styles.infoValueSmall}>{t.episodes.run}: {episode.run}</Text> : null}
                {episode.mrn ? <Text style={styles.infoValueSmall}>{t.episodes.mrn}: {episode.mrn}</Text> : null}
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t.clinicalNote.sex}</Text>
                <Text style={styles.infoValue}>{episode.sexo || t.clinicalNote.unknown}</Text>
              </View>

              {episode.fecha_nacimiento ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t.clinicalNote.birthDate}</Text>
                  <Text style={styles.infoValue}>{formatDate(episode.fecha_nacimiento)}</Text>
                </View>
              ) : null}

              {episode.fecha_atencion ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t.clinicalNote.attentionDate}</Text>
                  <Text style={styles.infoValue}>{formatDateTime(episode.fecha_atencion)}</Text>
                </View>
              ) : null}

              {episode.tipo ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t.clinicalNote.episodeType}</Text>
                  <Text style={styles.infoValue}>{episode.tipo}</Text>
                </View>
              ) : null}

              {episode.profesional ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t.clinicalNote.professional}</Text>
                  <Text style={styles.infoValue}>{episode.profesional}</Text>
                </View>
              ) : null}

              {episode.motivo_consulta ? (
                <View style={styles.infoItemFull}>
                  <Text style={styles.infoLabel}>{t.clinicalNote.consultReason}</Text>
                  <Text style={styles.infoValue}>{episode.motivo_consulta}</Text>
                </View>
              ) : null}

              {(episode.habitacion || episode.cama) ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t.clinicalNote.location}</Text>
                  <Text style={styles.infoValue}>
                    {episode.habitacion && episode.cama
                      ? `${t.clinicalNote.room} ${episode.habitacion} - ${t.clinicalNote.bed} ${episode.cama}`
                      : episode.habitacion || episode.cama}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Previous Notes */}
          {notes.length > 0 && (
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>{t.clinicalNote.previousNotes}</Text>
              {notes.map((note) => (
                <View key={note.id} style={styles.noteItem}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteAuthor}>{note.author_username}</Text>
                    <Text style={styles.noteDot}>•</Text>
                    <Text style={styles.noteDate}>{formatDateTime(note.created_at)}</Text>
                    <Text style={styles.noteDot}>•</Text>
                    <View style={[styles.noteBadge, note.synced_flag ? styles.noteBadgeSynced : styles.noteBadgePending]}>
                      <Text style={[styles.noteBadgeText, note.synced_flag ? styles.noteBadgeTextSynced : styles.noteBadgeTextPending]}>
                        {note.synced_flag ? t.clinicalNote.sent : t.clinicalNote.pending}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.noteText}>{note.note_text}</Text>
                  {note.author_nombre ? (
                    <Text style={styles.noteAuthorName}>{note.author_nombre}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Read Only Banner */}
          {isReadOnlyMode && (
            <View style={styles.readOnlyBanner}>
              <Text style={styles.readOnlyTitle}>{t.readOnlyMode.title}</Text>
              <Text style={styles.readOnlyText}>{t.readOnlyMode.notesBanner}</Text>
            </View>
          )}

          {/* New Note Form */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>{t.clinicalNote.newNote}</Text>
            <TextInput
              style={[styles.textarea, isReadOnlyMode && styles.textareaDisabled]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={isReadOnlyMode ? t.readOnlyMode.textareaPlaceholder : t.clinicalNote.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
              editable={!isReadOnlyMode}
            />
            <Text style={styles.charCount}>{noteText.length} {t.clinicalNote.characters}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.navigate('Episodes')}>
                <Text style={styles.cancelButtonText}>{t.clinicalNote.backToEpisodes}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (isSaving || !noteText.trim() || isReadOnlyMode) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSaving || !noteText.trim() || isReadOnlyMode}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{t.clinicalNote.saveNote}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Patient History Modal */}
      {episode && (
        <PatientHistoryModal
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          episodeData={episode.data}
        />
      )}
    </View>
  );
}
