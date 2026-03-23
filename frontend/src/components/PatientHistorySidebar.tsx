import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { EpisodeData, ResultadoHistorico, RegistroOffline } from '../types';

interface PatientHistorySidebarProps {
  episodeData: EpisodeData;
}

export function PatientHistorySidebar({ episodeData }: PatientHistorySidebarProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(true);
  const [expandedEncounter, setExpandedEncounter] = useState<number | null>(null);
  const [expandedLabType, setExpandedLabType] = useState<string | null>(null);
  const [expandedAlergias, setExpandedAlergias] = useState(false);
  const [expandedRegistros, setExpandedRegistros] = useState(false);
  const [selectedNota, setSelectedNota] = useState<RegistroOffline | null>(null);

  const encuentros = episodeData.Antecedentes?.Encuentros || [];
  const resultados = episodeData.Antecedentes?.Resultados || [];
  const alergias = episodeData.Antecedentes?.Alergias || [];
  const registrosOffline = episodeData.Antecedentes?.RegistrosOffline || [];

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const groupResultadosByType = () => {
    const grouped: Record<string, ResultadoHistorico[]> = {};
    resultados.forEach(result => {
      const tipo = result.Tipo || 'Otros';
      if (!grouped[tipo]) {
        grouped[tipo] = [];
      }
      grouped[tipo].push(result);
    });
    return grouped;
  };

  const resultadosByType = groupResultadosByType();

  const getStatusColor = (flag?: string) => {
    if (!flag) return 'text-gray-700 dark:text-gray-300';
    const normalizedFlag = flag.toLowerCase();
    if (normalizedFlag.includes('normal')) return 'text-green-700 dark:text-green-400';
    if (normalizedFlag.includes('alto') || normalizedFlag.includes('bajo')) return 'text-orange-700 dark:text-orange-400';
    return 'text-gray-700 dark:text-gray-300';
  };

  const getStatusBadge = (flag?: string) => {
    if (!flag) return null;
    const normalizedFlag = flag.toLowerCase();
    if (normalizedFlag.includes('normal')) {
      return <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded">{t.patientHistory.abnormalFlag.Normal}</span>;
    }
    if (normalizedFlag.includes('alto') || normalizedFlag.includes('high')) {
      return <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded">{t.patientHistory.abnormalFlag.Alto}</span>;
    }
    if (normalizedFlag.includes('bajo') || normalizedFlag.includes('low')) {
      return <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded">{t.patientHistory.abnormalFlag.Bajo}</span>;
    }
    return <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">{flag}</span>;
  };

  const getSeveridadColor = (severidad?: string) => {
    if (!severidad) return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    const normalized = severidad.toLowerCase();
    if (normalized.includes('alta') || normalized.includes('severa')) return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200';
    if (normalized.includes('moderada') || normalized.includes('media')) return 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200';
    if (normalized.includes('baja') || normalized.includes('leve')) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
  };

  const truncateText = (text: string | undefined | null, maxLength: number = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getEncounterTypeColor = (tipo?: string) => {
    if (!tipo) return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950';
    const normalizedTipo = tipo.toLowerCase();
    if (normalizedTipo.includes('urgencia') || normalizedTipo.includes('emergencia')) {
      return 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950';
    }
    if (normalizedTipo.includes('hospitaliza')) {
      return 'border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950';
    }
    if (normalizedTipo.includes('consulta') || normalizedTipo.includes('ambulatorio')) {
      return 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950';
    }
    if (normalizedTipo.includes('control')) {
      return 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950';
    }
    if (normalizedTipo.includes('procedimiento') || normalizedTipo.includes('cirugía')) {
      return 'border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950';
    }
    return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-20 right-0 z-10 bg-blue-600 dark:bg-blue-700 text-white rounded-l-lg shadow-lg p-3 hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
      >
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${
            isOpen ? 'rotate-0' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden border-l border-gray-200 dark:border-gray-800 z-50 ${
          isOpen ? 'w-96' : 'w-0'
        }`}
      >
        <div className="h-full overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">{t.patientHistory.title}</h2>
          </div>

          <div>
            <div
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4"
            >
              <button
                onClick={() => setExpandedAlergias(!expandedAlergias)}
                className="w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  {t.patientHistory.allergies}
                  {alergias.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-full">
                      {alergias.filter(a => a.Activa).length}
                    </span>
                  )}
                </h3>
                <svg
                  className={`w-5 h-5 transition-transform duration-200 ${
                    expandedAlergias ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedAlergias && (
                <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                  {alergias.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">{t.patientHistory.noAllergies}</p>
                  ) : (
                    <div className="space-y-2">
                      {alergias.map((alergia, index) => (
                        <div
                          key={index}
                          className={`bg-white dark:bg-gray-950 p-3 rounded border ${
                            alergia.Activa ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950' : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{alergia.Alergia}</p>
                            {alergia.Activa && (
                              <span className="text-xs px-2 py-0.5 bg-red-500 dark:bg-red-700 text-white rounded">
                                {t.patientHistory.active}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {alergia.Tipo && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{t.patientHistory.examType}:</span> {alergia.Tipo}
                              </p>
                            )}
                            {alergia.Severidad && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.patientHistory.severity[alergia.Severidad as keyof typeof t.patientHistory.severity] ? t.patientHistory.severity[alergia.Severidad as keyof typeof t.patientHistory.severity].split(':')[0] : 'Severidad'}:</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${getSeveridadColor(alergia.Severidad)}`}>
                                  {t.patientHistory.severity[alergia.Severidad as keyof typeof t.patientHistory.severity] || alergia.Severidad}
                                </span>
                              </div>
                            )}
                            {alergia.Fecha && (
                              <p className="text-xs text-gray-500">
                                {formatDate(alergia.Fecha)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <div
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4"
            >
              <button
                onClick={() => setExpandedRegistros(!expandedRegistros)}
                className="w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  {t.patientHistory.offlineRecords}
                  {registrosOffline.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                      {registrosOffline.length}
                    </span>
                  )}
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                    expandedRegistros ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedRegistros && (
                <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                  {registrosOffline.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">{t.patientHistory.noRecords}</p>
                  ) : (
                    <div className="space-y-2">
                      {registrosOffline.map((registro, index) => (
                        <div
                          key={index}
                          className="bg-white dark:bg-gray-950 p-3 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                          onClick={() => setSelectedNota(registro)}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {formatDateTime(registro.FechaHora)}
                            </p>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                            <span className="font-medium">{t.patientHistory.responsible}:</span> {registro.Responsable || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-900 dark:text-gray-50">
                            {truncateText(registro.Nota, 100)}
                          </p>
                          {registro.Nota && registro.Nota.length > 100 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t.patientHistory.viewFullNote}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <div
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4"
            >
              <button
                onClick={() => setExpandedEncounter(expandedEncounter === null ? 0 : null)}
                className="w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  {t.patientHistory.previousEncounters}
                  {encuentros.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                      {encuentros.length}
                    </span>
                  )}
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                    expandedEncounter !== null ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedEncounter !== null && (
                <>
                  {encuentros.length === 0 ? (
                    <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">{t.patientHistory.noEncounters}</p>
                    </div>
                  ) : (
                    <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      {encuentros.map((encuentro, index) => (
                        <div
                          key={index}
                          className={`rounded-lg overflow-hidden border ${getEncounterTypeColor(encuentro.Tipo)}`}
                        >
                          <button
                            onClick={() => setExpandedEncounter(expandedEncounter === index ? null : index)}
                            className="w-full p-3 text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                                  {formatDateTime(encuentro.FechaHora)}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{encuentro.Especialidad || '-'}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{encuentro.Tipo || '-'}</p>
                              </div>
                            </div>
                          </button>

                          {expandedEncounter === index && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        {encuentro.Medico && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.patientHistory.doctor}</p>
                            <p className="text-sm text-gray-900 dark:text-gray-50">{encuentro.Medico}</p>
                          </div>
                        )}

                        {encuentro.MotivoConsulta && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.patientHistory.consultReason}</p>
                            <p className="text-sm text-gray-900 dark:text-gray-50">{encuentro.MotivoConsulta}</p>
                          </div>
                        )}

                        {encuentro.Diagnosticos && encuentro.Diagnosticos.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.patientHistory.diagnoses}</p>
                            <div className="space-y-1">
                              {encuentro.Diagnosticos.map((diag, idx) => (
                                <p key={idx} className="text-sm text-gray-900 dark:text-gray-50 bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800">
                                  {diag.Glosa}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {encuentro.Medicamentos && encuentro.Medicamentos.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.patientHistory.medications}</p>
                            <ul className="space-y-1">
                              {encuentro.Medicamentos.map((med, idx) => (
                                <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 pl-3 border-l-2 border-green-300 dark:border-green-700">
                                  {med.Glosa}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {encuentro.Indicaciones && encuentro.Indicaciones.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.patientHistory.indications}</p>
                            <ul className="space-y-1">
                              {encuentro.Indicaciones.map((ind, idx) => (
                                <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 pl-3 border-l-2 border-purple-300 dark:border-purple-700">
                                  {ind.Glosa}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <div
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4"
            >
              <button
                onClick={() => setExpandedLabType(expandedLabType === null ? '' : null)}
                className="w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                  {t.patientHistory.labResults}
                  {resultados.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                      {resultados.length}
                    </span>
                  )}
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                    expandedLabType !== null ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedLabType !== null && (
                <>
                  {resultados.length === 0 ? (
                    <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">{t.patientHistory.noResults}</p>
                    </div>
                  ) : (
                    <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      {Object.entries(resultadosByType).map(([tipo, results]) => (
                        <div
                          key={tipo}
                          className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedLabType(expandedLabType === tipo ? '' : tipo)}
                            className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{tipo}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                  {results.length} {t.patientHistory.exams}
                                </p>
                              </div>
                            </div>
                          </button>

                          {expandedLabType === tipo && (
                            <div className="px-3 pb-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                              {results.map((result, idx) => (
                                <div
                                  key={idx}
                                  className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700"
                                >
                                  <div className="flex items-start justify-between mb-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{result.Examen}</p>
                                    {getStatusBadge(result.AbnormalFlag)}
                                  </div>
                                  {result.FechaHora && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{formatDate(result.FechaHora)}</p>
                                  )}
                                  <div className="flex items-baseline gap-2">
                                    <p className={`text-sm font-semibold ${getStatusColor(result.AbnormalFlag)}`}>
                                      {typeof result.Valor === 'number' ? result.Valor : result.Valor || '-'}
                                      {result.Unidad && ` ${result.Unidad}`}
                                    </p>
                                    {result.RangoReferencia && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        ({t.patientHistory.referenceRange}: {result.RangoReferencia})
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black dark:bg-black bg-opacity-20 dark:bg-opacity-40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {selectedNota && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{t.patientHistory.noteDetails}</h3>
              <button
                onClick={() => setSelectedNota(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.patientHistory.dateTime}</p>
                <p className="text-sm text-gray-900 dark:text-gray-50">{formatDateTime(selectedNota.FechaHora)}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.patientHistory.responsible}</p>
                <p className="text-sm text-gray-900 dark:text-gray-50">{selectedNota.Responsable}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t.patientHistory.fullNote}</p>
                <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-900 dark:text-gray-50 whitespace-pre-wrap">{selectedNota.Nota}</p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
              <button
                onClick={() => setSelectedNota(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t.patientHistory.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
