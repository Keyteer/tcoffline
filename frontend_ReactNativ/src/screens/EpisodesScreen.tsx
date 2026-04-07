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
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header } from '../components/Header';
import { EpisodeRow } from '../components/EpisodeRow';
import { api } from '../lib/api';
import { formatTimeAgo } from '../lib/timeAgo';
import type { Episode, EpisodeType, SyncStats } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

const EPISODES_REFRESH_INTERVAL = 15000;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Episodes'>;
};

export function EpisodesScreen({ navigation }: Props) {
  const { isReadOnlyMode } = useUser();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<EpisodeType | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [availableTabs, setAvailableTabs] = useState<Array<{ id: EpisodeType; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllEpisodes = useCallback(async () => {
    try {
      const episodesList = await api.getEpisodes({});
      const sortedEpisodes = episodesList.sort((a, b) => {
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
    } catch {
      setAllEpisodes([]);
    }
  }, []);

  const loadSyncStats = useCallback(async () => {
    try {
      const stats = await api.getSyncStats();
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
    <View style={styles.container}>
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
                  {tab.label}
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
    </View>
  );
}
