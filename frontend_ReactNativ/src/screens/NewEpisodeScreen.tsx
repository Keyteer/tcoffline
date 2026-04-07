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
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header } from '../components/Header';
import { api } from '../lib/api';
import { formatRUT, getRUTError } from '../lib/rutValidation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NewEpisode'>;
};

export function NewEpisodeScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rut, setRut] = useState('');
  const [rutError, setRutError] = useState<string | null>(null);
  const [noDocument, setNoDocument] = useState(false);
  const [sex, setSex] = useState('M');
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

  useEffect(() => {
    const loadEpisodeTypes = async () => {
      try {
        const types = await api.getUniqueEpisodeTypes();
        setAvailableEpisodeTypes(types);
        if (types.length > 0 && !episodeType) {
          setEpisodeType(types[0]);
        }
      } catch {
        // ignore
      }
    };
    loadEpisodeTypes();
  }, []);

  useEffect(() => {
    if (!episodeType) return;
    const loadLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const locations = await api.getUniqueLocations(episodeType);
        setAvailableLocations(Array.isArray(locations) ? locations : []);
      } catch {
        setAvailableLocations([]);
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

      const episode = await api.createEpisode({
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
        data_json: JSON.stringify(episodeData),
      });

      navigation.replace('ClinicalNote', { id: episode.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.newEpisode.createError);
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
    <View style={styles.container}>
      <Header navigation={navigation} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← {t.newEpisode.backToEpisodes}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t.newEpisode.titlePatient}</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.newEpisode.patientData}</Text>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>
                  {t.newEpisode.firstName} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>
                  {t.newEpisode.lastName} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor={colors.textTertiary} />
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
            <TextInput
              style={[styles.input, noDocument && styles.inputDisabled, rutError ? styles.inputError : null]}
              value={rut}
              onChangeText={handleRutChange}
              placeholder="12345678-9"
              placeholderTextColor={colors.textTertiary}
              editable={!noDocument}
            />
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
                <Text style={styles.label}>
                  {t.newEpisode.birthDate} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                />
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
            <TextInput
              style={styles.input}
              value={locationRoomBox}
              onChangeText={setLocationRoomBox}
              placeholder="Ej: Box 3, Habitación 201"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>{t.newEpisode.clinicUnit}</Text>
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
            <TextInput
              style={[styles.input, styles.textarea]}
              value={motivoConsulta}
              onChangeText={setMotivoConsulta}
              placeholder="Describa brevemente el motivo de la consulta..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />

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
      </KeyboardAvoidingView>

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
    </View>
  );
}
