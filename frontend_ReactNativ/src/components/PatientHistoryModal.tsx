import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { EpisodeData, ResultadoHistorico, RegistroOffline } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  episodeData: EpisodeData;
};

export function PatientHistoryModal({ visible, onClose, episodeData }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedEncounter, setExpandedEncounter] = useState<number | null>(null);
  const [expandedLabType, setExpandedLabType] = useState<string | null>(null);
  const [selectedNota, setSelectedNota] = useState<RegistroOffline | null>(null);

  const encuentros = episodeData.Antecedentes?.Encuentros || [];
  const resultados = episodeData.Antecedentes?.Resultados || [];
  const alergias = episodeData.Antecedentes?.Alergias || [];
  const registrosOffline = episodeData.Antecedentes?.RegistrosOffline || [];

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const groupResultadosByType = () => {
    const grouped: Record<string, ResultadoHistorico[]> = {};
    resultados.forEach((r) => {
      const tipo = r.Tipo || 'Otros';
      if (!grouped[tipo]) grouped[tipo] = [];
      grouped[tipo].push(r);
    });
    return grouped;
  };

  const resultadosByType = groupResultadosByType();

  const getStatusColor = (flag?: string) => {
    if (!flag) return colors.text;
    const f = flag.toLowerCase();
    if (f.includes('normal')) return colors.success;
    if (f.includes('alto') || f.includes('bajo')) return colors.warning;
    return colors.text;
  };

  const getSeveridadColor = (sev?: string) => {
    if (!sev) return { bg: colors.surfaceSecondary, text: colors.textSecondary };
    const n = sev.toLowerCase();
    if (n.includes('alta') || n.includes('severa')) return { bg: colors.errorLight, text: colors.error };
    if (n.includes('moderada') || n.includes('media')) return { bg: colors.warningLight, text: colors.warning };
    if (n.includes('baja') || n.includes('leve')) return { bg: colors.warningLight, text: colors.warning };
    return { bg: colors.surfaceSecondary, text: colors.textSecondary };
  };

  const getEncounterBgColor = (tipo?: string) => {
    if (!tipo) return colors.card;
    const n = tipo.toLowerCase();
    if (n.includes('urgencia') || n.includes('emergencia')) return colors.errorLight;
    if (n.includes('hospitaliza')) return colors.warningLight;
    if (n.includes('consulta') || n.includes('ambulatorio')) return colors.infoLight;
    if (n.includes('control')) return colors.successLight;
    return colors.card;
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '85%',
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
    closeButton: { padding: 4 },
    closeText: { fontSize: 22, color: colors.textSecondary },
    scrollContent: { padding: 16 },
    section: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countBadgeText: { fontSize: 11, fontWeight: '600' },
    chevron: { fontSize: 14, color: colors.textSecondary },
    sectionContent: { paddingHorizontal: 14, paddingBottom: 14 },
    emptyText: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 8, fontSize: 13 },
    // Allergy
    allergyCard: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 8,
    },
    allergyActive: { borderColor: colors.errorBorder, backgroundColor: colors.errorLight },
    allergyInactive: { borderColor: colors.border, backgroundColor: colors.card },
    allergyName: { fontSize: 14, fontWeight: '600', color: colors.text },
    allergyActiveBadge: {
      backgroundColor: colors.error,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    allergyActiveBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    allergyDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    // Record
    recordCard: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginBottom: 8,
    },
    recordDate: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
    recordProf: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    recordNote: { fontSize: 13, color: colors.text, marginTop: 4 },
    recordLink: { fontSize: 12, color: colors.primary, marginTop: 4 },
    // Encounter
    encounterCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      overflow: 'hidden',
    },
    encounterHeader: { padding: 12 },
    encounterDate: { fontSize: 13, fontWeight: '600', color: colors.text },
    encounterSpec: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    encounterDetail: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
    detailLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 2 },
    detailValue: { fontSize: 13, color: colors.text, marginBottom: 8 },
    diagCard: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      padding: 8,
      borderRadius: 6,
      marginBottom: 4,
    },
    diagText: { fontSize: 13, color: colors.text },
    medItem: {
      fontSize: 12,
      color: colors.textSecondary,
      borderLeftWidth: 2,
      borderLeftColor: colors.success,
      paddingLeft: 8,
      marginBottom: 4,
    },
    indItem: {
      fontSize: 12,
      color: colors.textSecondary,
      borderLeftWidth: 2,
      borderLeftColor: '#A78BFA',
      paddingLeft: 8,
      marginBottom: 4,
    },
    // Lab
    labGroup: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    },
    labGroupHeader: { padding: 12 },
    labGroupTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    labGroupCount: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    labItem: {
      backgroundColor: colors.surfaceSecondary,
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
      marginHorizontal: 12,
    },
    labItemLast: { marginBottom: 12 },
    labItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    labItemName: { fontSize: 13, fontWeight: '500', color: colors.text },
    labItemValue: { fontSize: 13, fontWeight: '600' },
    labItemRange: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    flagBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    // Note detail modal
    noteModalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
    noteModal: { backgroundColor: colors.card, borderRadius: 12, maxHeight: '80%' },
    noteModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    noteModalTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    noteModalContent: { padding: 16 },
    noteModalLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
    noteModalValue: { fontSize: 14, color: colors.text, marginBottom: 16 },
    noteModalTextBox: {
      backgroundColor: colors.surfaceSecondary,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteModalText: { fontSize: 14, color: colors.text },
    noteModalFooter: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'flex-end',
    },
    closeModalButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    closeModalText: { color: '#FFF', fontWeight: '600' },
  });

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t.patientHistory.title}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent}>
              {/* Allergies */}
              <View style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('allergies')}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{t.patientHistory.allergies}</Text>
                    {alergias.length > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: colors.errorLight }]}>
                        <Text style={[styles.countBadgeText, { color: colors.error }]}>
                          {alergias.filter((a) => a.Activa).length}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chevron}>{expandedSection === 'allergies' ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expandedSection === 'allergies' && (
                  <View style={styles.sectionContent}>
                    {alergias.length === 0 ? (
                      <Text style={styles.emptyText}>{t.patientHistory.noAllergies}</Text>
                    ) : (
                      alergias.map((a, i) => {
                        const sevColors = getSeveridadColor(a.Severidad);
                        return (
                          <View key={i} style={[styles.allergyCard, a.Activa ? styles.allergyActive : styles.allergyInactive]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={styles.allergyName}>{a.Alergia}</Text>
                              {a.Activa && (
                                <View style={styles.allergyActiveBadge}>
                                  <Text style={styles.allergyActiveBadgeText}>{t.patientHistory.active}</Text>
                                </View>
                              )}
                            </View>
                            {a.Tipo && <Text style={styles.allergyDetail}>{t.patientHistory.examType}: {a.Tipo}</Text>}
                            {a.Severidad && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={[styles.severityBadge, { backgroundColor: sevColors.bg }]}>
                                  <Text style={{ fontSize: 11, color: sevColors.text }}>
                                    {t.patientHistory.severity[a.Severidad as keyof typeof t.patientHistory.severity] || a.Severidad}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {a.Fecha && <Text style={styles.allergyDetail}>{formatDate(a.Fecha)}</Text>}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>

              {/* Offline Records */}
              <View style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('records')}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{t.patientHistory.offlineRecords}</Text>
                    {registrosOffline.length > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
                        <Text style={[styles.countBadgeText, { color: colors.info }]}>{registrosOffline.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chevron}>{expandedSection === 'records' ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expandedSection === 'records' && (
                  <View style={styles.sectionContent}>
                    {registrosOffline.length === 0 ? (
                      <Text style={styles.emptyText}>{t.patientHistory.noRecords}</Text>
                    ) : (
                      registrosOffline.map((r, i) => (
                        <TouchableOpacity key={i} style={styles.recordCard} onPress={() => setSelectedNota(r)}>
                          <Text style={styles.recordDate}>{formatDateTime(r.FechaHora)}</Text>
                          <Text style={styles.recordProf}>
                            {t.patientHistory.responsible}: {r.Profesional || 'N/A'}
                          </Text>
                          <Text style={styles.recordNote} numberOfLines={3}>
                            {r.Nota || ''}
                          </Text>
                          {r.Nota && r.Nota.length > 100 && (
                            <Text style={styles.recordLink}>{t.patientHistory.viewFullNote}</Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              {/* Previous Encounters */}
              <View style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('encounters')}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{t.patientHistory.previousEncounters}</Text>
                    {encuentros.length > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
                        <Text style={[styles.countBadgeText, { color: colors.info }]}>{encuentros.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chevron}>{expandedSection === 'encounters' ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expandedSection === 'encounters' && (
                  <View style={styles.sectionContent}>
                    {encuentros.length === 0 ? (
                      <Text style={styles.emptyText}>{t.patientHistory.noEncounters}</Text>
                    ) : (
                      encuentros.map((enc, i) => (
                        <View key={i} style={[styles.encounterCard, { backgroundColor: getEncounterBgColor(enc.Tipo) }]}>
                          <TouchableOpacity
                            style={styles.encounterHeader}
                            onPress={() => setExpandedEncounter(expandedEncounter === i ? null : i)}
                          >
                            <Text style={styles.encounterDate}>{formatDateTime(enc.FechaHora)}</Text>
                            <Text style={styles.encounterSpec}>{enc.Especialidad || '-'} · {enc.Tipo || '-'}</Text>
                          </TouchableOpacity>
                          {expandedEncounter === i && (
                            <View style={styles.encounterDetail}>
                              {enc.Medico && (
                                <>
                                  <Text style={styles.detailLabel}>{t.patientHistory.doctor}</Text>
                                  <Text style={styles.detailValue}>{enc.Medico}</Text>
                                </>
                              )}
                              {enc.MotivoConsulta && (
                                <>
                                  <Text style={styles.detailLabel}>{t.patientHistory.consultReason}</Text>
                                  <Text style={styles.detailValue}>{enc.MotivoConsulta}</Text>
                                </>
                              )}
                              {enc.Diagnosticos && enc.Diagnosticos.length > 0 && (
                                <>
                                  <Text style={styles.detailLabel}>{t.patientHistory.diagnoses}</Text>
                                  {enc.Diagnosticos.map((d, di) => (
                                    <View key={di} style={styles.diagCard}>
                                      <Text style={styles.diagText}>{d.Glosa}</Text>
                                    </View>
                                  ))}
                                </>
                              )}
                              {enc.Medicamentos && enc.Medicamentos.length > 0 && (
                                <>
                                  <Text style={[styles.detailLabel, { marginTop: 8 }]}>{t.patientHistory.medications}</Text>
                                  {enc.Medicamentos.map((m, mi) => (
                                    <Text key={mi} style={styles.medItem}>{m.Glosa}</Text>
                                  ))}
                                </>
                              )}
                              {enc.Indicaciones && enc.Indicaciones.length > 0 && (
                                <>
                                  <Text style={[styles.detailLabel, { marginTop: 8 }]}>{t.patientHistory.indications}</Text>
                                  {enc.Indicaciones.map((ind, ii) => (
                                    <Text key={ii} style={styles.indItem}>{ind.Glosa}</Text>
                                  ))}
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>

              {/* Lab Results */}
              <View style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('labs')}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{t.patientHistory.labResults}</Text>
                    {resultados.length > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
                        <Text style={[styles.countBadgeText, { color: colors.info }]}>{resultados.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chevron}>{expandedSection === 'labs' ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expandedSection === 'labs' && (
                  <View style={styles.sectionContent}>
                    {resultados.length === 0 ? (
                      <Text style={styles.emptyText}>{t.patientHistory.noResults}</Text>
                    ) : (
                      Object.entries(resultadosByType).map(([tipo, results]) => (
                        <View key={tipo} style={styles.labGroup}>
                          <TouchableOpacity
                            style={styles.labGroupHeader}
                            onPress={() => setExpandedLabType(expandedLabType === tipo ? null : tipo)}
                          >
                            <Text style={styles.labGroupTitle}>{tipo}</Text>
                            <Text style={styles.labGroupCount}>{results.length} {t.patientHistory.exams}</Text>
                          </TouchableOpacity>
                          {expandedLabType === tipo &&
                            results.map((r, ri) => (
                              <View key={ri} style={[styles.labItem, ri === results.length - 1 && styles.labItemLast]}>
                                <View style={styles.labItemRow}>
                                  <Text style={styles.labItemName}>{r.Examen}</Text>
                                  {r.AbnormalFlag && (
                                    <View
                                      style={[
                                        styles.flagBadge,
                                        {
                                          backgroundColor: r.AbnormalFlag.toLowerCase().includes('normal')
                                            ? colors.successLight
                                            : colors.warningLight,
                                        },
                                      ]}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '600', color: getStatusColor(r.AbnormalFlag) }}>
                                        {t.patientHistory.abnormalFlag[r.AbnormalFlag as keyof typeof t.patientHistory.abnormalFlag] || r.AbnormalFlag}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                {r.FechaHora && <Text style={{ fontSize: 11, color: colors.textTertiary }}>{formatDate(r.FechaHora)}</Text>}
                                <Text style={[styles.labItemValue, { color: getStatusColor(r.AbnormalFlag) }]}>
                                  {r.Valor || '-'}{r.Unidad ? ` ${r.Unidad}` : ''}
                                </Text>
                                {r.RangoReferencia && (
                                  <Text style={styles.labItemRange}>
                                    ({t.patientHistory.referenceRange}: {r.RangoReferencia})
                                  </Text>
                                )}
                              </View>
                            ))}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Note Detail Modal */}
      <Modal visible={!!selectedNota} transparent animationType="fade" onRequestClose={() => setSelectedNota(null)}>
        <View style={styles.noteModalOverlay}>
          <View style={styles.noteModal}>
            <View style={styles.noteModalHeader}>
              <Text style={styles.noteModalTitle}>{t.patientHistory.noteDetails}</Text>
              <TouchableOpacity onPress={() => setSelectedNota(null)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.noteModalContent}>
              <Text style={styles.noteModalLabel}>{t.patientHistory.dateTime}</Text>
              <Text style={styles.noteModalValue}>{selectedNota ? formatDateTime(selectedNota.FechaHora) : ''}</Text>

              <Text style={styles.noteModalLabel}>{t.patientHistory.responsible}</Text>
              <Text style={styles.noteModalValue}>{selectedNota?.Profesional || 'N/A'}</Text>

              <Text style={styles.noteModalLabel}>{t.patientHistory.fullNote}</Text>
              <View style={styles.noteModalTextBox}>
                <Text style={styles.noteModalText}>{selectedNota?.Nota || ''}</Text>
              </View>
            </ScrollView>
            <View style={styles.noteModalFooter}>
              <TouchableOpacity style={styles.closeModalButton} onPress={() => setSelectedNota(null)}>
                <Text style={styles.closeModalText}>{t.patientHistory.close}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
