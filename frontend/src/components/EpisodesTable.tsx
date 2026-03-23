import type { Episode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface EpisodesTableProps {
  episodes: Episode[];
  onEpisodeClick: (episodeId: number) => void;
}

export function EpisodesTable({ episodes, onEpisodeClick }: EpisodesTableProps) {
  const { t, language } = useLanguage();
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const months = language === 'es' ? monthsEs : monthsEn;
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  const toCamelCase = (text: string) => {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const truncateName = (name: string, maxLength: number = 40) => {
    if (!name || name === '-') return name;
    const camelCaseName = toCamelCase(name);
    if (camelCaseName.length <= maxLength) return camelCaseName;
    return camelCaseName.substring(0, maxLength) + '...';
  };

  const getEpisodeData = (episode: Episode) => {
    return {
      paciente: truncateName(episode.paciente || '-'),
      run: episode.run || '-',
      profesional: episode.profesional || '-',
      ubicacion: episode.ubicacion || '-',
    };
  };

  if (episodes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">{t.episodes.noEpisodesInCategory}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 w-full">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-800 table-fixed">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[15%]">
                {t.episodes.patient}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                {t.episodes.run}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[9%]">
                {t.episodes.episode}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[14%]">
                {t.episodes.professional}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[13%]">
                {t.episodes.location}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[17%]">
                {t.episodes.dateAttention}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                {t.episodes.status}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[12%]">
                {t.episodes.sync}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {episodes.map((episode) => {
              const episodeData = getEpisodeData(episode);
              const hasUnsynedNotes = episode.pending_notes_count > 0;
              const displayStatus = hasUnsynedNotes ? t.episodes.syncStatus.pendingCount : (episode.estado || (language === 'es' ? 'Activo' : 'Active'));

              return (
              <tr
                key={episode.id}
                onClick={() => onEpisodeClick(episode.id)}
                className="hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer transition-colors"
              >
                <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {episodeData.paciente}
                    </div>
                    {!episode.synced_flag && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 whitespace-nowrap">
                        {t.episodes.syncStatus.new}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {episodeData.run}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {episode.num_episodio}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {episodeData.profesional}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {episodeData.ubicacion}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {formatDateTime(episode.fecha_atencion)}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full truncate ${
                    hasUnsynedNotes
                      ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                      : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  }`}>
                    {displayStatus}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {episode.synced_flag && !hasUnsynedNotes ? (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {t.episodes.syncStatus.synced}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {t.episodes.syncStatus.pendingCount}{hasUnsynedNotes ? ` (${episode.pending_notes_count})` : ''}
                    </span>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
