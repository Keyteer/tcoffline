import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { ArrowLeft, Search, X } from 'react-native-feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { useResponsive, LAYOUT_MAX } from '../hooks/useResponsive';
import { Header } from '../components/Header';
import { EpisodeRow } from '../components/EpisodeRow';
import { SyncPipeline } from '../components/SyncPipeline';
import { api } from '../lib/api';
import { outbox } from '../lib/outbox';
import type { Episode, EpisodeType, SyncStats } from '../types';
import type { EpisodeCreateRequest } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

import { EPISODES_REFRESH_INTERVAL, PAGE_SIZE } from '../config/env';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Episodes'>;
};

export function EpisodesScreen({ navigation }: Props) {
  const { isReadOnlyMode } = useUser();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { lastReplayAt } = useConnectivity();
  const { columns } = useResponsive();
  const [activeTab, setActiveTab] = useState<EpisodeType | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [availableTabs, setAvailableTabs] = useState<Array<{ id: EpisodeType; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [enableNewEpisodeButton, setEnableNewEpisodeButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filterEpisodes = (list: Episode[], query: string): Episode[] => {
    const q = query.toLowerCase().trim();
    if (!q) return list;
    return list.filter((e) => {
      const fields = [
        e.paciente, e.run, e.mrn, e.num_episodio,
        e.motivo_consulta, e.ubicacion, e.habitacion, e.cama,
      ];
      return fields.some((f) => f?.toLowerCase().includes(q));
    });
  };

  const loadAllEpisodes = useCallback(async () => {
    // Build pseudo-Episode entries from the device-side outbox so that
    // episodes created while disconnected appear immediately in the list
    // with a "Local" badge until they are synced.
    const buildLocalEpisodes = async (): Promise<Episode[]> => {
      try {
        const pending = await outbox.getAll();
        return pending
          .filter((m) => m.type === 'createEpisode')
          .map((m) => {
            const p = m.payload as EpisodeCreateRequest;
            return {
              // Stable negative pseudo-id derived from the outbox-entry
              // timestamp, so ClinicalNoteScreen can find the originating
              // outbox entry.
              id: outbox.localEpisodePseudoId(m),
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
              local_outbox_id: m.id,
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

  const loadSystemSettings = useCallback(async () => {
    try {
      const settings = await api.getSystemSettings();
      setEnableNewEpisodeButton(settings.enable_new_episode_button);
    } catch {
      // ignore — keep current value (defaults to hidden) when offline
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadAllEpisodes(), loadSyncStats(), loadSystemSettings()]).finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      loadAllEpisodes();
      loadSyncStats();
      loadSystemSettings();
    }, EPISODES_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loadAllEpisodes, loadSyncStats, loadSystemSettings]);

  // Refresh immediately after the offline mutation queue is drained, so
  // episodes flip from "Local" to a real backend record without the user
  // having to wait for the next polling tick or pull-to-refresh.
  useEffect(() => {
    if (lastReplayAt === 0) return;
    loadAllEpisodes();
    loadSyncStats();
  }, [lastReplayAt, loadAllEpisodes, loadSyncStats]);

  useEffect(() => {
    const base = searchQuery.trim()
      ? allEpisodes
      : activeTab
        ? allEpisodes.filter((e) => e.tipo === activeTab)
        : allEpisodes;
    setEpisodes(filterEpisodes(base, searchQuery));
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, allEpisodes, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAllEpisodes(), loadSyncStats()]);
    setRefreshing(false);
  };

  const handleEpisodeClick = (episodeId: number) => {
    // Local-only episodes use a negative pseudo-id; ClinicalNoteScreen knows
    // how to load them from the device-side outbox.
    navigation.navigate('ClinicalNote', { id: episodeId });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      // Cap content width on tablets / desktops so cards don't stretch into
      // unreadable lines. Centred horizontally on wide screens.
      width: '100%',
      maxWidth: LAYOUT_MAX.content,
      alignSelf: 'center',
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
    titleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchIconButton: {
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      marginLeft: 4,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    clearButton: {
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header navigation={navigation} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          {isSearching ? (
            <>
              <TouchableOpacity
                onPress={() => { setIsSearching(false); setSearchQuery(''); }}
                style={styles.searchIconButton}
              >
                <ArrowLeft width={20} height={20} color={colors.primary} />
              </TouchableOpacity>
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t.episodes.searchPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <X width={16} height={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t.episodes.title}</Text>
              <View style={styles.titleActions}>
                <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.searchIconButton}>
                  <Search width={20} height={20} color={colors.text} />
                </TouchableOpacity>
                {enableNewEpisodeButton && (
                  <TouchableOpacity
                    style={[styles.newButton, isReadOnlyMode && styles.newButtonDisabled]}
                    onPress={() => navigation.navigate('NewEpisode')}
                    disabled={isReadOnlyMode}
                  >
                    <Text style={styles.newButtonText}>+ {t.episodes.newEpisode}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {isReadOnlyMode && (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyTitle}>{t.readOnlyMode.title}</Text>
            <Text style={styles.readOnlyText}>{t.readOnlyMode.episodesBanner}</Text>
          </View>
        )}

        {syncStats && <SyncPipeline syncStats={syncStats} />}

        {availableTabs.length > 0 && !isSearching && (
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
            data={episodes.slice(0, visibleCount)}
            key={`cols-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={columns > 1 ? { flex: 1 } : undefined}>
                <EpisodeRow episode={item} onPress={() => handleEpisodeClick(item.id)} />
              </View>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            onEndReached={() => {
              if (visibleCount < episodes.length) {
                setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, episodes.length));
              }
            }}
            onEndReachedThreshold={0.3}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
