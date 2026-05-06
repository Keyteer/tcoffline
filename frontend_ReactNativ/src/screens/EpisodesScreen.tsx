import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { Header } from '../components/Header';
import { EpisodeRow } from '../components/EpisodeRow';
import { OfflineBanner } from '../components/OfflineBanner';
import { api } from '../lib/api';
import { mutationQueue } from '../lib/mutationQueue';
import { formatTimeAgo } from '../lib/timeAgo';
import type { Episode, EpisodeType, SyncStats } from '../types';
import type { EpisodeCreateRequest } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

import { EPISODES_REFRESH_INTERVAL } from '../config/env';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Episodes'>;
};

export function EpisodesScreen({ navigation }: Props) {
  const { isReadOnlyMode } = useUser();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { lastReplayAt } = useConnectivity();
  const [activeTab, setActiveTab] = useState<EpisodeType | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [availableTabs, setAvailableTabs] = useState<Array<{ id: EpisodeType; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllEpisodes = useCallback(async () => {
    // Build pseudo-Episode entries from the offline mutation queue so that
    // episodes created while disconnected appear immediately in the list
    // with a "Local" badge until they are synced.
    const buildLocalEpisodes = async (): Promise<Episode[]> => {
      try {
        const pending = await mutationQueue.getAll();
        return pending
          .filter((m) => m.type === 'createEpisode')
          .map((m) => {
            const p = m.payload as EpisodeCreateRequest;
            return {
              // Stable negative pseudo-id derived from the mutation timestamp,
              // so ClinicalNoteScreen can find the originating queue entry.
              id: mutationQueue.localEpisodePseudoId(m),
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
              profesional: '',
              motivo_consulta: p.motivo_consulta,
              data_json: '',
              created_at: new Date(m.timestamp).toISOString(),
              updated_at: new Date(m.timestamp).toISOString(),
              synced_flag: false,
              pending_notes_count: 0,
              local: true,
              local_mutation_id: m.id,
            } as Episode;
          });
      } catch {
        return [];
      }
    };

    const apply = async (list: Episode[]) => {
      const locals = await buildLocalEpisodes();
      // Avoid duplicating a local entry if the server already returned the
      // synced version (matched by num_episodio).
      const serverNums = new Set(list.map((e) => e.num_episodio));
      const merged = [...locals.filter((l) => !serverNums.has(l.num_episodio)), ...list];

      const sortedEpisodes = merged.sort((a, b) => {
        const timeA = a.fecha_atencion ? new Date(a.fecha_atencion).getTime() : 0;
        const timeB = b.fecha_atencion ? new Date(b.fecha_atencion).getTime() : 0;
        return timeB - timeA;
      });

      setAllEpisodes(sortedEpisodes);

      const uniqueTypes = Array.from(new Set(sortedEpisodes.map((e) => e.tipo).filter(Boolean))) as EpisodeType[];
      const tabs = uniqueTypes.map((tipo) => ({ id: tipo, label: tipo }));
      setAvailableTabs(tabs);

      setActiveTab((current) => {
        if (tabs.length > 0 && !current) return tabs[0].id;
        if (current && !tabs.find((t) => t.id === current)) return tabs[0]?.id ?? null;
        return current;
      });
    };

    try {
      const episodesList = await api.getEpisodes({}, (fresh) => { void apply(fresh); });
      await apply(episodesList);
    } catch {
      // Even on total failure, still render any local-only episodes.
      await apply([]);
    }
  }, []);

  const loadSyncStats = useCallback(async () => {
    try {
      const stats = await api.getSyncStats((fresh) => setSyncStats(fresh));
      setSyncStats(stats);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadAllEpisodes(), loadSyncStats()]).finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      loadAllEpisodes();
      loadSyncStats();
    }, EPISODES_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loadAllEpisodes, loadSyncStats]);

  // Refresh immediately after the offline mutation queue is drained, so
  // episodes flip from "Local" to a real backend record without the user
  // having to wait for the next polling tick or pull-to-refresh.
  useEffect(() => {
    if (lastReplayAt === 0) return;
    loadAllEpisodes();
    loadSyncStats();
  }, [lastReplayAt, loadAllEpisodes, loadSyncStats]);

  useEffect(() => {
    if (activeTab) {
      setEpisodes(allEpisodes.filter((e) => e.tipo === activeTab));
    } else {
      setEpisodes(allEpisodes);
    }
  }, [activeTab, allEpisodes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAllEpisodes(), loadSyncStats()]);
    setRefreshing(false);
  };

  const handleEpisodeClick = (episodeId: number) => {
    // Local-only episodes use a negative pseudo-id; ClinicalNoteScreen knows
    // how to load them from the offline mutation queue.
    navigation.navigate('ClinicalNote', { id: episodeId });
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return t.episodes.never;
    return formatTimeAgo(lastSync, t.timeAgo);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
    },
    newButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    newButtonDisabled: {
      backgroundColor: colors.textTertiary,
    },
    newButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    readOnlyBanner: {
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    readOnlyTitle: {
      fontWeight: '600',
      color: colors.warning,
      marginBottom: 4,
    },
    readOnlyText: {
      fontSize: 13,
      color: colors.warning,
    },
    syncBar: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
    },
    syncDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    syncText: {
      fontSize: 12,
      color: colors.text,
    },
    syncLabel: {
      fontWeight: '600',
      fontSize: 12,
      color: colors.text,
    },
    pendingText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.warning,
    },
    tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    },
    loadingText: {
      marginTop: 8,
      color: colors.textSecondary,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 16,
      paddingVertical: 48,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header navigation={navigation} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t.episodes.title}</Text>
          <TouchableOpacity
            style={[styles.newButton, isReadOnlyMode && styles.newButtonDisabled]}
            onPress={() => navigation.navigate('NewEpisode')}
            disabled={isReadOnlyMode}
          >
            <Text style={styles.newButtonText}>+ {t.episodes.newEpisode}</Text>
          </TouchableOpacity>
        </View>

        {isReadOnlyMode && (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyTitle}>{t.readOnlyMode.title}</Text>
            <Text style={styles.readOnlyText}>{t.readOnlyMode.episodesBanner}</Text>
          </View>
        )}

        <OfflineBanner />

        {syncStats && (
          <View style={styles.syncBar}>
            <View style={styles.syncRow}>
              <View
                style={[
                  styles.syncDot,
                  { backgroundColor: syncStats.connection.is_online ? '#22C55E' : '#EF4444' },
                ]}
              />
              <Text style={styles.syncLabel}>
                {syncStats.connection.is_online ? t.episodes.connected : t.episodes.disconnected}
              </Text>
            </View>
            <Text style={styles.syncText}>
              <Text style={styles.syncLabel}>{t.episodes.dataReception}:</Text>{' '}
              {formatLastSync(syncStats.last_downstream_sync)}
            </Text>
            <Text style={styles.syncText}>
              <Text style={styles.syncLabel}>{t.episodes.hl7Send}:</Text>{' '}
              {formatLastSync(syncStats.last_upstream_sync)}
            </Text>
            {syncStats.pending_events > 0 && (
              <Text style={styles.pendingText}>
                {syncStats.pending_events}{' '}
                {syncStats.pending_events !== 1 ? t.episodes.pendingEventsPlural : t.episodes.pendingEvents}{' '}
                {syncStats.pending_events !== 1 ? t.episodes.pendingPlural : t.episodes.pending}
              </Text>
            )}
          </View>
        )}

        {availableTabs.length > 0 && (
          <View style={styles.tabsRow}>
            {availableTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {(t.episodeTypes as Record<string, string>)[tab.label] || tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t.episodes.loadingEpisodes}</Text>
          </View>
        ) : episodes.length === 0 ? (
          <Text style={styles.emptyText}>{t.episodes.noEpisodesInCategory}</Text>
        ) : (
          <FlatList
            data={episodes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <EpisodeRow episode={item} onPress={() => handleEpisodeClick(item.id)} />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
