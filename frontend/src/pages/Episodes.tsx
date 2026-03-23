import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Tabs } from '../components/Tabs';
import { EpisodesTable } from '../components/EpisodesTable';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatTimeAgo } from '../lib/timeAgo';
import type { Episode, EpisodeType, SyncStats } from '../types';

const EPISODES_REFRESH_INTERVAL = 15000; // 15 segundos

export function Episodes() {
  const navigate = useNavigate();
  const { isReadOnlyMode } = useUser();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<EpisodeType | null>(() => {
    const saved = sessionStorage.getItem('activeEpisodeTab');
    return saved as EpisodeType | null;
  });
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [availableTabs, setAvailableTabs] = useState<Array<{ id: EpisodeType; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);

  const loadAllEpisodes = async () => {
    setIsLoading(true);
    try {
      const episodesList = await api.getEpisodes({});

      const sortedEpisodes = episodesList.sort((a, b) => {
        const timeA = a.fecha_atencion ? new Date(a.fecha_atencion).getTime() : 0;
        const timeB = b.fecha_atencion ? new Date(b.fecha_atencion).getTime() : 0;
        return timeB - timeA;
      });

      setAllEpisodes(sortedEpisodes);

      const uniqueTypes = Array.from(new Set(sortedEpisodes.map(e => e.tipo).filter(Boolean))) as EpisodeType[];
      const tabs = uniqueTypes.map(tipo => ({
        id: tipo,
        label: tipo
      }));

      setAvailableTabs(tabs);

      if (tabs.length > 0 && !activeTab) {
        const firstTab = tabs[0].id;
        setActiveTab(firstTab);
        sessionStorage.setItem('activeEpisodeTab', firstTab);
      } else if (activeTab && !tabs.find(t => t.id === activeTab)) {
        const firstTab = tabs[0]?.id;
        if (firstTab) {
          setActiveTab(firstTab);
          sessionStorage.setItem('activeEpisodeTab', firstTab);
        }
      }
    } catch (error) {
      console.error('Error loading episodes:', error);
      setAllEpisodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllEpisodes();

    const interval = setInterval(loadAllEpisodes, EPISODES_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleSyncComplete = () => {
      loadAllEpisodes();
    };

    window.addEventListener('sync-completed', handleSyncComplete);

    return () => {
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, []);

  useEffect(() => {
    const loadSyncStats = async () => {
      try {
        const stats = await api.getSyncStats();
        setSyncStats(stats);

        if (stats.pending_events > 0) {
          loadAllEpisodes();
        }
      } catch (error) {
        console.error('Error loading sync stats:', error);
      }
    };

    loadSyncStats();
    const interval = setInterval(loadSyncStats, EPISODES_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab) {
      const filtered = allEpisodes.filter(e => e.tipo === activeTab);
      setEpisodes(filtered);
    } else {
      setEpisodes(allEpisodes);
    }
  }, [activeTab, allEpisodes]);

  const handleNewEpisode = () => {
    navigate('/new');
  };

  const handleEpisodeClick = (episodeId: number) => {
    if (activeTab) {
      sessionStorage.setItem('activeEpisodeTab', activeTab);
    }
    navigate(`/episode/${episodeId}/note`);
  };

  const handleTabChange = (tab: EpisodeType) => {
    setActiveTab(tab);
    sessionStorage.setItem('activeEpisodeTab', tab);
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return t.episodes.never;
    return formatTimeAgo(lastSync, t.timeAgo);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t.episodes.title}</h1>
            </div>
            <button
              onClick={handleNewEpisode}
              disabled={isReadOnlyMode !== false}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              title={isReadOnlyMode === true ? t.readOnlyMode.buttonTooltip : ''}
            >
              + {t.episodes.newEpisode}
            </button>
          </div>
          {isReadOnlyMode && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-semibold mb-1">{t.readOnlyMode.title}</h3>
                  <p className="text-sm">{t.readOnlyMode.episodesBanner}</p>
                </div>
              </div>
            </div>
          )}
          {syncStats && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-6 text-sm bg-gray-100 dark:bg-gray-900 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${syncStats.connection.is_online ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {syncStats.connection.is_online ? t.episodes.connected : t.episodes.disconnected}
                  </span>
                </div>
                <div className="text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{t.episodes.dataReception}:</span> {formatLastSync(syncStats.last_downstream_sync)}
                </div>
                <div className="text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{t.episodes.hl7Send}:</span> {formatLastSync(syncStats.last_upstream_sync)}
                </div>
                {syncStats.pending_events > 0 && (
                  <div className="text-amber-700 dark:text-amber-400 font-medium">
                    {syncStats.pending_events} {syncStats.pending_events !== 1 ? t.episodes.pendingEventsPlural : t.episodes.pendingEvents} {syncStats.pending_events !== 1 ? t.episodes.pendingPlural : t.episodes.pending}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {availableTabs.length > 0 && (
          <Tabs
            tabs={availableTabs}
            activeTab={activeTab || availableTabs[0].id}
            onTabChange={handleTabChange}
          />
        )}

        <div className="mt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t.episodes.loadingEpisodes}</p>
            </div>
          ) : (
            <EpisodesTable
              episodes={episodes}
              onEpisodeClick={handleEpisodeClick}
            />
          )}
        </div>
      </main>
    </div>
  );
}
