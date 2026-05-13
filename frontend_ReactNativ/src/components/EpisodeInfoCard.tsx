import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { EpisodeDetail } from '../types';

type Props = {
  episode: EpisodeDetail;
};

export function EpisodeInfoCard({ episode }: Props) {
  const { colors } = useTheme();
  const { t, language } = useLanguage();

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const locale = language === 'es' ? 'es-CL' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    const locale = language === 'es' ? 'es-CL' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(dateString));
  };

  const styles = StyleSheet.create({
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
  });

  return (
    <View style={styles.patientCard}>
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t.clinicalNote.patient}</Text>
          <Text style={styles.infoValue}>{episode.paciente || 'Sin nombre'}</Text>
          {episode.run ? <Text style={styles.infoValueSmall}>{t.episodes.run}: {episode.run}</Text> : null}
          {episode.mrn ? <Text style={styles.infoValueSmall}>{t.episodes.mrn}: {episode.mrn}</Text> : null}
        </View>

        {episode.num_episodio ? (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t.clinicalNote.episodeNumber}</Text>
            <Text style={styles.infoValue}>{episode.num_episodio}</Text>
          </View>
        ) : null}

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

        {episode.motivo_consulta ? (
          <View style={styles.infoItemFull}>
            <Text style={styles.infoLabel}>{t.clinicalNote.consultReason}</Text>
            <Text style={styles.infoValue}>{episode.motivo_consulta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
