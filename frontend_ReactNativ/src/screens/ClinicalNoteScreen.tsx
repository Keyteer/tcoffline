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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { Header } from '../components/Header';
import { PatientHistoryModal } from '../components/PatientHistoryModal';
import { OfflineBanner } from '../components/OfflineBanner';
import { MicButton } from '../components/MicButton';
import { stopActiveSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { api } from '../lib/api';
import { mutationQueue } from '../lib/mutationQueue';
import type { PendingMutation } from '../lib/mutationQueue';
import type { EpisodeDetail, ClinicalNote, EpisodeCreateRequest, ClinicalNoteCreateRequest } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClinicalNote'>;
  route: RouteProp<RootStackParamList, 'ClinicalNote'>;
};

export function ClinicalNoteScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const isLocalEpisode = id < 0;
  const { isReadOnlyMode } = useUser();
  const { t, language } = useLanguage();
  const { colors } = useTheme();
  const { isBackendReachable } = useConnectivity();
  const keyboardHeight = useKeyboardHeight();
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [pendingLocalNotes, setPendingLocalNotes] = useState<ClinicalNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [interimNote, setInterimNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Build a synthetic EpisodeDetail from a queued createEpisode mutation so
  // the user can keep working with episodes that have not yet been synced.
  const buildLocalEpisodeDetail = (m: PendingMutation): EpisodeDetail => {
    const p = m.payload as EpisodeCreateRequest;
    return {
      id,
      mrn: p.mrn,
      num_episodio: p.num_episodio,
      run: p.run,
      paciente: p.paciente,
      fecha_nacimiento: p.fecha_nacimiento,
      sexo: p.sexo,
      tipo: p.tipo,
      fecha_atencion: p.fecha_atencion,
      hospital: p.hospital,
      habitacion: p.habitacion,
      cama: p.cama,
      ubicacion: p.ubicacion,
      estado: p.estado,
      profesional: p.profesional,
      motivo_consulta: p.motivo_consulta,
      data_json: '',
      created_at: new Date(m.timestamp).toISOString(),
      updated_at: new Date(m.timestamp).toISOString(),
      synced_flag: false,
      pending_notes_count: 0,
      local: true,
      local_mutation_id: m.id,
      data: (p.data_json as unknown) as EpisodeDetail['data'],
    };
  };

  // Convert queued createNote mutations into ClinicalNote-shaped objects so
  // they can be rendered inline with synced notes.
  const queueToNotes = (mutations: PendingMutation[]): ClinicalNote[] =>
    mutations.map((m) => ({
      // Negative id avoids collisions with real notes from the backend.
      id: -m.timestamp,
      episode_id: id,
      author_user_id: 0,
      author_username: '—',
      note_text: (m.payload as ClinicalNoteCreateRequest).note_text,
      created_at: new Date(m.timestamp).toISOString(),
      synced_flag: false,
    }));

  const loadPendingLocalNotes = async (episodeKey?: string) => {
    try {
      const pending = await mutationQueue.getPendingNotesForEpisode(id, episodeKey);
      setPendingLocalNotes(queueToNotes(pending));
    } catch {
      setPendingLocalNotes([]);
    }
  };

  const loadNotes = async () => {
    if (isLocalEpisode) {
      // No backend record yet — only queued notes are available.
      const localKey = episode?.num_episodio;
      await loadPendingLocalNotes(localKey);
      return;
    }
    try {
      const notesData = await api.getClinicalNotes(id, (fresh) => setNotes(fresh));
      setNotes(notesData);
    } catch {
      // ignore
    }
    await loadPendingLocalNotes();
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const hasPendingNotes = notes.some((note) => !note.synced_flag) || pendingLocalNotes.length > 0;
      if (hasPendingNotes) {
        await loadNotes();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [notes, pendingLocalNotes, isLocalEpisode, episode?.num_episodio]);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (isLocalEpisode) {
          const local = await mutationQueue.findLocalEpisode(id);
          if (!local) {
            setError(t.clinicalNote.loadError);
            return;
          }
          const synthetic = buildLocalEpisodeDetail(local);
          setEpisode(synthetic);
          await loadPendingLocalNotes(synthetic.num_episodio);
          return;
        }

        const [episodeData, notesData] = await Promise.all([
          api.getEpisode(id, (fresh) => {
            if (!fresh.paciente && fresh.data?.Paciente) fresh.paciente = fresh.data.Paciente;
            if (!fresh.paciente && fresh.data?.Nombre) fresh.paciente = fresh.data.Nombre;
            if (!fresh.profesional && fresh.data?.Profesional) fresh.profesional = fresh.data.Profesional;
            setEpisode(fresh);
          }),
          api.getClinicalNotes(id, (fresh) => setNotes(fresh)).catch(() => [] as ClinicalNote[]),
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
        await loadPendingLocalNotes();
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
      // Notes on a still-local episode MUST be queued (no real id yet).
      // Otherwise, queue when offline and post directly when online.
      if (isLocalEpisode) {
        await mutationQueue.enqueue({
          type: 'createNote',
          payload: { note_text: noteText },
          episodeId: id, // pseudo-id; replaced after parent createEpisode replays
          localEpisodeKey: episode?.num_episodio,
        });
        setSuccessMessage(t.offline.queuedNote);
        setNoteText('');
        await loadPendingLocalNotes(episode?.num_episodio);
      } else if (!isBackendReachable) {
        await mutationQueue.enqueue({
          type: 'createNote',
          payload: { note_text: noteText },
          episodeId: id,
        });
        setSuccessMessage(t.offline.queuedNote);
        setNoteText('');
        await loadPendingLocalNotes();
      } else {
        await api.createClinicalNote(id, { note_text: noteText });
        setSuccessMessage(t.clinicalNote.saveSuccess);
        setNoteText('');
        await loadNotes();
      }
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
    noteBadgeLocal: { backgroundColor: colors.errorLight },
    noteBadgeText: { fontSize: 11, fontWeight: '600' },
    noteBadgeTextSynced: { color: colors.success },
    noteBadgeTextPending: { color: colors.warning },
    noteBadgeTextLocal: { color: colors.error },
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
      paddingRight: 52,
      fontSize: 14,
      color: colors.text,
      minHeight: 200,
      textAlignVertical: 'top',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    textareaDisabled: { backgroundColor: colors.surfaceSecondary, opacity: 0.6 },
    textareaWrapper: { position: 'relative' },
    textareaMic: { position: 'absolute', top: 8, right: 8 },
    interimPreview: {
      fontSize: 12,
      fontStyle: 'italic',
      color: colors.textTertiary,
      marginTop: 4,
      marginBottom: 4,
    },
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
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <Header navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!episode) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header navigation={navigation} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + keyboardHeight }]}
          keyboardShouldPersistTaps="handled"
          onTouchStart={() => stopActiveSpeechRecognition()}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Episodes')}>
            <Text style={styles.backText}>← {t.clinicalNote.backToEpisodes}</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <Text style={styles.title}>{t.clinicalNote.clinicalRecord}</Text>
            <TouchableOpacity style={styles.historyButton} onPress={() => setShowHistory(true)}>
              <Text style={styles.historyButtonText}>{t.patientHistory.title}</Text>
            </TouchableOpacity>
          </View>

          <OfflineBanner />

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
          {(notes.length > 0 || pendingLocalNotes.length > 0) && (
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>{t.clinicalNote.previousNotes}</Text>
              {[...notes, ...pendingLocalNotes].map((note) => {
                // Notes that exist only in the offline mutation queue use a
                // negative pseudo-id; show them as "Local" (red) to make it
                // clear they have not yet reached the backend at all.
                const isLocalNote = note.id < 0;
                const badgeStyle = isLocalNote
                  ? styles.noteBadgeLocal
                  : note.synced_flag
                    ? styles.noteBadgeSynced
                    : styles.noteBadgePending;
                const badgeTextStyle = isLocalNote
                  ? styles.noteBadgeTextLocal
                  : note.synced_flag
                    ? styles.noteBadgeTextSynced
                    : styles.noteBadgeTextPending;
                const badgeLabel = isLocalNote
                  ? `⊘ ${t.episodes.syncStatus.local}`
                  : note.synced_flag
                    ? t.clinicalNote.sent
                    : t.clinicalNote.pending;
                return (
                <View key={note.id} style={styles.noteItem}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteAuthor}>{note.author_username}</Text>
                    <Text style={styles.noteDot}>•</Text>
                    <Text style={styles.noteDate}>{formatDateTime(note.created_at)}</Text>
                    <Text style={styles.noteDot}>•</Text>
                    <View style={[styles.noteBadge, badgeStyle]}>
                      <Text style={[styles.noteBadgeText, badgeTextStyle]}>
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.noteText}>{note.note_text}</Text>
                  {note.author_nombre ? (
                    <Text style={styles.noteAuthorName}>{note.author_nombre}</Text>
                  ) : null}
                </View>
                );
              })}
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
            <View style={styles.textareaWrapper}>
              <TextInput
                style={[styles.textarea, isReadOnlyMode && styles.textareaDisabled]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder={isReadOnlyMode ? t.readOnlyMode.textareaPlaceholder : t.clinicalNote.notePlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
                editable={!isReadOnlyMode}
              />
              {!isReadOnlyMode ? (
                <View style={styles.textareaMic}>
                  <MicButton
                    value={noteText}
                    mode="append"
                    continuous
                    interim
                    onTranscript={(text) => setNoteText(text)}
                    onInterim={setInterimNote}
                  />
                </View>
              ) : null}
            </View>
            {interimNote ? (
              <Text style={styles.interimPreview}>{interimNote}</Text>
            ) : null}
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
    </SafeAreaView>
  );
}
