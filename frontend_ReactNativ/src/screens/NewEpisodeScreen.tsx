import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { Header } from '../components/Header';
import { MicButton } from '../components/MicButton';
import { CommandMicButton } from '../components/CommandMicButton';
import { stopActiveSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { api } from '../lib/api';
import { localStore } from '../lib/localStore';
import { outbox } from '../lib/outbox';
import { formatRUT, getRUTError } from '../lib/rutValidation';
import { parseSpokenDate, cleanSpokenRut, parseSpokenName, fuzzyMatchOption } from '../lib/speechParsers';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NewEpisode'>;
};

export function NewEpisodeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { isBackendReachable } = useConnectivity();
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rut, setRut] = useState('');
  const [rutError, setRutError] = useState<string | null>(null);
  const [noDocument, setNoDocument] = useState(false);
  const [sex, setSex] = useState('U');
  const [birthDate, setBirthDate] = useState('');
  const [episodeType, setEpisodeType] = useState<string>('');
  const [availableEpisodeTypes, setAvailableEpisodeTypes] = useState<string[]>([]);
  const [locationRoomBox, setLocationRoomBox] = useState('');
  const [clinicUnit, setClinicUnit] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSexPicker, setShowSexPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  // ----- Command mic (hands-free dictation) -----
  type CommandField =
    | 'firstName'
    | 'lastName'
    | 'rut'
    | 'noDocument'
    | 'birthDate'
    | 'sex'
    | 'episodeType'
    | 'roomBox'
    | 'clinicUnit'
    | 'motivoConsulta';
  const [activeCmdField, setActiveCmdField] = useState<CommandField | null>(null);
  const [cmdInterim, setCmdInterim] = useState('');

  const commandVocab = t.speech.command.fields as Record<CommandField, string[]>;
  const fieldDisplayName = (f: CommandField | null): string =>
    f ? commandVocab[f]?.[0] ?? f : '';

  const handleCommandSegment = (field: CommandField, raw: string) => {
    const value = raw.trim();
    // `noDocument` is a toggle — fires even with no following value.
    if (field === 'noDocument') {
      setNoDocument((prev) => {
        const next = !prev;
        if (next) {
          setRut('');
          setRutError(null);
        }
        return next;
      });
      return;
    }
    if (!value) return;
    switch (field) {
      case 'firstName':
        setFirstName(parseSpokenName(value));
        break;
      case 'lastName':
        setLastName(parseSpokenName(value));
        break;
      case 'rut': {
        const cleaned = cleanSpokenRut(value);
        const formatted = formatRUT(cleaned);
        setRut(formatted);
        if (!noDocument) setRutError(getRUTError(formatted));
        break;
      }
      case 'birthDate':
        setBirthDate(parseSpokenDate(value));
        break;
      case 'sex': {
        const sexAliases = t.speech.command.sexValues as Record<string, string[]>;
        const matched = fuzzyMatchOption(value, sexAliases);
        if (matched) setSex(matched);
        break;
      }
      case 'episodeType': {
        const matched = fuzzyMatchOption(value, availableEpisodeTypes);
        if (matched) setEpisodeType(matched);
        break;
      }
      case 'roomBox':
        setLocationRoomBox(value);
        break;
      case 'clinicUnit': {
        const matched = fuzzyMatchOption(value, availableLocations);
        if (matched) setClinicUnit(matched);
        break;
      }
      case 'motivoConsulta':
        setMotivoConsulta(value);
        break;
    }
  };

  useEffect(() => {
    const loadEpisodeTypes = async () => {
      // Show stored data immediately (store-first / stale-while-revalidate)
      const stored = await localStore.getEpisodeTypes();
      if (stored && stored.length > 0) {
        setAvailableEpisodeTypes(stored);
        if (!episodeType) setEpisodeType(stored[0]);
      }
      // Refresh from network in background
      try {
        const types = await api.getUniqueEpisodeTypes();
        setAvailableEpisodeTypes(types);
        if (types.length > 0 && !episodeType) {
          setEpisodeType(types[0]);
        }
      } catch {
        // ignore — stored data already shown
      }
    };
    loadEpisodeTypes();
  }, []);

  useEffect(() => {
    if (!episodeType) return;
    const loadLocations = async () => {
      // Show stored data immediately (store-first / stale-while-revalidate)
      const stored = await localStore.getLocations(episodeType);
      if (stored && stored.length > 0) {
        setAvailableLocations(stored);
      } else {
        setIsLoadingLocations(true);
      }
      // Refresh from network in background
      try {
        const locations = await api.getUniqueLocations(episodeType);
        setAvailableLocations(Array.isArray(locations) ? locations : []);
      } catch {
        if (!stored || stored.length === 0) setAvailableLocations([]);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    loadLocations();
    setClinicUnit('');
  }, [episodeType]);

  const handleRutChange = (value: string) => {
    const formatted = formatRUT(value);
    setRut(formatted);
    if (!noDocument) {
      setRutError(getRUTError(formatted));
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t.newEpisode.required);
      return;
    }
    if (!clinicUnit.trim()) {
      setError(t.newEpisode.clinicUnitRequired);
      return;
    }
    if (!noDocument && rutError) {
      setError(rutError);
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const cleanRut = rut ? rut.replace(/[.-]/g, '') : `NODOC${timestamp.slice(-8)}`;
      const temporalMrn = `OFFP${cleanRut}`;
      const temporalEpisodeNum = `OFFE${timestamp}`;
      const fullName = `${firstName} ${lastName}`;

      const sexLabel = sex === 'M' ? 'Masculino' : sex === 'F' ? 'Femenino' : 'Otro';

      const episodeData = {
        Paciente: fullName,
        Nombre: fullName,
        MRN: temporalMrn,
        Run: rut || '',
        RUN: rut || '',
        FechaNacimiento: birthDate,
        Sexo: sexLabel,
        Tipo: episodeType,
        FechaAtencion: now.toISOString(),
        NumEpisodio: temporalEpisodeNum,
        Hospital: 'Hospital Demo',
        Habitacion: locationRoomBox,
        Cama: '',
        Ubicacion: clinicUnit || '',
        Local: clinicUnit || '',
        Estado: 'Activo',
        Profesional: '',
        Antecedentes: { Encuentros: [], Resultados: [] },
      };

      const createRequest = {
        mrn: temporalMrn,
        num_episodio: temporalEpisodeNum,
        run: rut,
        paciente: fullName,
        fecha_nacimiento: birthDate ? new Date(birthDate).toISOString() : undefined,
        sexo: sexLabel,
        tipo: episodeType,
        fecha_atencion: now.toISOString(),
        hospital: 'Hospital Demo',
        habitacion: locationRoomBox,
        cama: '',
        ubicacion: clinicUnit || '',
        estado: 'Activo',
        motivo_consulta: motivoConsulta,
        data_json: episodeData,
      };

      if (!isBackendReachable) {
        await outbox.enqueue({
          type: 'createEpisode',
          payload: createRequest,
        });
        navigation.replace('Episodes');
      } else {
        const episode = await api.createEpisode(createRequest);
        navigation.replace('ClinicalNote', { id: episode.id });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t.newEpisode.createError);
    } finally {
      setIsLoading(false);
    }
  };

  const sexOptions = [
    { value: 'M', label: t.newEpisode.sexOptions.M },
    { value: 'F', label: t.newEpisode.sexOptions.F },
    { value: 'O', label: t.newEpisode.sexOptions.O },
    { value: 'U', label: t.newEpisode.sexOptions.U },
  ];

  const filteredLocations = locationSearch
    ? availableLocations.filter((l) => l.toLowerCase().includes(locationSearch.toLowerCase()))
    : availableLocations;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    backText: { color: colors.primary, fontSize: 14 },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 16 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionHeaderTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
    cmdBanner: {
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    cmdBannerTitle: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    cmdBannerText: { fontSize: 14, color: colors.text, marginTop: 2 },
    cmdBannerHint: { fontSize: 11, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
    label: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
    required: { color: colors.error },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
    },
    inputDisabled: { backgroundColor: colors.surfaceSecondary, opacity: 0.6 },
    inputError: { borderColor: colors.error },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    inputRowField: { flex: 1, marginBottom: 0 },
    errorSmall: { color: colors.error, fontSize: 12, marginTop: -8, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    switchLabel: { fontSize: 13, color: colors.textSecondary, marginLeft: 8 },
    pickerButton: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    pickerButtonText: { fontSize: 16, color: colors.text },
    pickerChevron: { fontSize: 14, color: colors.textTertiary },
    textarea: { minHeight: 80, textAlignVertical: 'top' },
    errorBox: {
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: { color: colors.error, fontSize: 14 },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
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
    submitButtonText: { color: '#FFFFFF', fontWeight: '600' },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '60%',
      padding: 16,
      paddingBottom: 16 + insets.bottom,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
    modalItem: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalItemSelected: { backgroundColor: colors.primaryLight },
    modalItemText: { fontSize: 16, color: colors.text },
    modalSearch: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
    },
    modalEmpty: { padding: 20, alignItems: 'center' },
    modalEmptyText: { color: colors.textSecondary, fontSize: 14 },
  });

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    items: Array<{ value: string; label: string }>,
    selected: string,
    onSelect: (value: string) => void
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item.value === selected && styles.modalItemSelected]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header navigation={navigation} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => stopActiveSpeechRecognition()}
      >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← {t.newEpisode.backToEpisodes}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t.newEpisode.titlePatient}</Text>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTitle}>{t.newEpisode.patientData}</Text>
              <CommandMicButton<CommandField>
                vocab={commandVocab}
                nextAliases={t.speech.command.next}
                onSegment={handleCommandSegment}
                onActiveFieldChange={setActiveCmdField}
                onInterim={setCmdInterim}
              />
            </View>

            {(activeCmdField || cmdInterim) ? (
              <View style={styles.cmdBanner}>
                <Text style={styles.cmdBannerTitle}>
                  {t.speech.command.activeField}: {fieldDisplayName(activeCmdField)}
                </Text>
                {cmdInterim ? <Text style={styles.cmdBannerText}>{cmdInterim}</Text> : null}
                <Text style={styles.cmdBannerHint}>{t.speech.command.hint}</Text>
              </View>
            ) : null}

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>
                  {t.newEpisode.firstName} <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, styles.inputRowField]} value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.textTertiary} />
                  <MicButton value={firstName} mode="replace" onTranscript={(text) => setFirstName(parseSpokenName(text))} />
                </View>
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>
                  {t.newEpisode.lastName} <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, styles.inputRowField]} value={lastName} onChangeText={setLastName} placeholderTextColor={colors.textTertiary} />
                  <MicButton value={lastName} mode="replace" onTranscript={(text) => setLastName(parseSpokenName(text))} />
                </View>
              </View>
            </View>

            <Text style={styles.label}>{t.newEpisode.rut}</Text>
            <View style={styles.switchRow}>
              <Switch
                value={noDocument}
                onValueChange={(val) => {
                  setNoDocument(val);
                  if (val) { setRut(''); setRutError(null); }
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
              <Text style={styles.switchLabel}>{t.newEpisode.noDocument}</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputRowField, noDocument && styles.inputDisabled, rutError ? styles.inputError : null]}
                value={rut}
                onChangeText={handleRutChange}
                placeholder="12345678-9"
                placeholderTextColor={colors.textTertiary}
                editable={!noDocument}
              />
              <MicButton
                value={rut}
                mode="replace"
                disabled={noDocument}
                onTranscript={(text) => handleRutChange(cleanSpokenRut(text))}
              />
            </View>
            {rutError && !noDocument ? <Text style={styles.errorSmall}>{rutError}</Text> : null}

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>
                  {t.newEpisode.sex} <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSexPicker(true)}>
                  <Text style={styles.pickerButtonText}>
                    {sexOptions.find((o) => o.value === sex)?.label || sex}
                  </Text>
                  <Text style={styles.pickerChevron}>▼</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>{t.newEpisode.birthDate}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputRowField]}
                    value={birthDate}
                    onChangeText={setBirthDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <MicButton
                    value={birthDate}
                    mode="replace"
                    onTranscript={(text) => setBirthDate(parseSpokenDate(text))}
                  />
                </View>
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>{t.newEpisode.episodeData}</Text>

            <Text style={styles.label}>
              {t.newEpisode.episodeType} <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, availableEpisodeTypes.length === 0 && styles.inputDisabled]}
              onPress={() => availableEpisodeTypes.length > 0 && setShowTypePicker(true)}
              disabled={availableEpisodeTypes.length === 0}
            >
              <Text style={styles.pickerButtonText}>
                {episodeType || t.newEpisode.noEpisodeTypes}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t.newEpisode.roomBox}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputRowField]}
                value={locationRoomBox}
                onChangeText={setLocationRoomBox}
                placeholder="Ej: Box 3, Habitación 201"
                placeholderTextColor={colors.textTertiary}
              />
              <MicButton value={locationRoomBox} mode="replace" onTranscript={(text) => setLocationRoomBox(text)} />
            </View>

            <Text style={styles.label}>
              {t.newEpisode.clinicUnit} <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, (isLoadingLocations || availableLocations.length === 0) && styles.inputDisabled]}
              onPress={() => !isLoadingLocations && availableLocations.length > 0 && setShowLocationPicker(true)}
              disabled={isLoadingLocations || availableLocations.length === 0}
            >
              <Text style={styles.pickerButtonText}>
                {isLoadingLocations
                  ? 'Cargando...'
                  : clinicUnit || (availableLocations.length === 0 ? t.newEpisode.clinicUnitNoData : t.newEpisode.clinicUnitPlaceholder)}
              </Text>
              {isLoadingLocations ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.pickerChevron}>▼</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>{t.newEpisode.consultReason}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputRowField, styles.textarea]}
                value={motivoConsulta}
                onChangeText={setMotivoConsulta}
                placeholder="Describa brevemente el motivo de la consulta..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
              <MicButton
                value={motivoConsulta}
                mode="append"
                continuous
                interim
                onTranscript={(text) => setMotivoConsulta(text)}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={isLoading}>
                <Text style={styles.cancelButtonText}>{t.newEpisode.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, isLoading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{t.newEpisode.createAndContinue}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

      {renderPickerModal(
        showSexPicker,
        () => setShowSexPicker(false),
        t.newEpisode.sex,
        sexOptions,
        sex,
        setSex
      )}

      {renderPickerModal(
        showTypePicker,
        () => setShowTypePicker(false),
        t.newEpisode.episodeType,
        availableEpisodeTypes.map((tp) => ({ value: tp, label: tp })),
        episodeType,
        setEpisodeType
      )}

      {/* Location picker with search */}
      <Modal visible={showLocationPicker} transparent animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLocationPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.newEpisode.clinicUnit}</Text>
            <TextInput
              style={styles.modalSearch}
              value={locationSearch}
              onChangeText={setLocationSearch}
              placeholder={t.common.search}
              placeholderTextColor={colors.textTertiary}
            />
            {filteredLocations.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>{t.newEpisode.clinicUnitNoResults}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredLocations}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalItem, item === clinicUnit && styles.modalItemSelected]}
                    onPress={() => {
                      setClinicUnit(item);
                      setLocationSearch('');
                      setShowLocationPicker(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
