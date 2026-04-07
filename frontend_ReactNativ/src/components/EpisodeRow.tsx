import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Episode } from '../types';

type Props = {
  episode: Episode;
  onPress: () => void;
};

export function EpisodeRow({ episode, onPress }: Props) {
  const { colors } = useTheme();
  const { t, language } = useLanguage();

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = language === 'es' ? monthsEs : monthsEn;
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const toCamelCase = (text: string) =>
    text
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const truncateName = (name: string, maxLength = 30) => {
    if (!name || name === '-') return name;
    const cc = toCamelCase(name);
    return cc.length <= maxLength ? cc : cc.substring(0, maxLength) + '...';
  };

  const hasUnsynedNotes = episode.pending_notes_count > 0;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    patientName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    newBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 6,
    },
    newBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
    syncBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    syncedBg: { backgroundColor: colors.successLight },
    pendingBg: { backgroundColor: colors.warningLight },
    syncText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
    syncedText: { color: colors.success },
    pendingText: { color: colors.warning },
    middleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
    detail: { fontSize: 12, color: colors.textSecondary },
    detailLabel: { fontWeight: '600' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 12, color: colors.textTertiary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    statusBadgeNormal: { backgroundColor: colors.successLight },
    statusBadgePending: { backgroundColor: colors.warningLight },
    statusText: { fontSize: 11, fontWeight: '600' },
    statusTextNormal: { color: colors.success },
    statusTextPending: { color: colors.warning },
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={styles.patientName} numberOfLines={1}>
            {truncateName(episode.paciente || '-')}
          </Text>
          {!episode.synced_flag && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t.episodes.syncStatus.new}</Text>
            </View>
          )}
        </View>
        <View style={[styles.syncBadge, episode.synced_flag && !hasUnsynedNotes ? styles.syncedBg : styles.pendingBg]}>
          <Text style={[styles.syncText, episode.synced_flag && !hasUnsynedNotes ? styles.syncedText : styles.pendingText]}>
            {episode.synced_flag && !hasUnsynedNotes
              ? `✓ ${t.episodes.syncStatus.synced}`
              : `⏱ ${t.episodes.syncStatus.pendingCount}${hasUnsynedNotes ? ` (${episode.pending_notes_count})` : ''}`}
          </Text>
        </View>
      </View>

      <View style={styles.middleRow}>
        {episode.run ? (
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>{t.episodes.run}:</Text> {episode.run}
          </Text>
        ) : null}
        {episode.profesional ? (
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>{t.episodes.professional}:</Text> {truncateName(episode.profesional, 20)}
          </Text>
        ) : null}
        {episode.ubicacion ? (
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>{t.episodes.location}:</Text> {episode.ubicacion}
          </Text>
        ) : null}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.dateText}>{formatDateTime(episode.fecha_atencion)}</Text>
        <View style={[styles.statusBadge, hasUnsynedNotes ? styles.statusBadgePending : styles.statusBadgeNormal]}>
          <Text style={[styles.statusText, hasUnsynedNotes ? styles.statusTextPending : styles.statusTextNormal]}>
            {hasUnsynedNotes
              ? t.episodes.syncStatus.pendingCount
              : episode.estado || (language === 'es' ? 'Activo' : 'Active')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
