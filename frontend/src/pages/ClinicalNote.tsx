import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { PatientHistorySidebar } from '../components/PatientHistorySidebar';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { EpisodeDetail, ClinicalNote } from '../types';

export function ClinicalNote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isReadOnlyMode } = useUser();
  const { t, language } = useLanguage();
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadNotes = async () => {
    if (!id) return;
    try {
      const episodeId = parseInt(id);
      const notesData = await api.getClinicalNotes(episodeId);
      setNotes(notesData);
    } catch (err) {
      console.error(t.clinicalNote.saveError, err);
    }
  };

  useEffect(() => {
    const checkForUpdates = async () => {
      if (!id) return;

      const hasPendingNotes = notes.some(note => !note.synced_flag);

      if (hasPendingNotes) {
        await loadNotes();
      }
    };

    const interval = setInterval(checkForUpdates, 5000);

    return () => clearInterval(interval);
  }, [id, notes]);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      try {
        const episodeId = parseInt(id);
        const [episodeData, notesData] = await Promise.all([
          api.getEpisode(episodeId),
          api.getClinicalNotes(episodeId)
        ]);

        if (!episodeData.paciente && episodeData.data?.Paciente) {
          episodeData.paciente = episodeData.data.Paciente;
        }
        if (!episodeData.paciente && episodeData.data?.Nombre) {
          episodeData.paciente = episodeData.data.Nombre;
        }
        if (!episodeData.profesional && episodeData.data?.Profesional) {
          episodeData.profesional = episodeData.data.Profesional;
        }
        if (!episodeData.profesional && episodeData.data?.Antecedentes?.Encuentros?.[0]?.Medico) {
          episodeData.profesional = episodeData.data.Antecedentes.Encuentros[0].Medico;
        }

        setEpisode(episodeData);
        setNotes(notesData);
      } catch (err) {
        setError(t.clinicalNote.loadError);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !noteText.trim()) return;

    setIsSaving(true);
    setError('');

    try {
      await api.createClinicalNote(parseInt(id), {
        note_text: noteText,
      });

      setSuccessMessage(t.clinicalNote.saveSuccess);
      setNoteText('');

      await loadNotes();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.clinicalNote.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = language === 'es'
      ? ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Header />
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-lg p-4">
            {t.clinicalNote.episodeNotFound}
          </div>
          <button
            onClick={() => navigate('/episodes')}
            className="mt-4 btn-primary"
          >
            {t.clinicalNote.backToEpisodes}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />
      <PatientHistorySidebar episodeData={episode.data} />

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 mr-96">
        <div className="mb-6">
          <button
            onClick={() => navigate('/episodes')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2 mb-4"
          >
            ← {t.clinicalNote.backToEpisodes}
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t.clinicalNote.clinicalRecord}</h2>
        </div>

        <div className="card mb-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.patient}</h3>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                {episode.paciente || 'Sin nombre'}
              </p>
              {episode.run && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t.episodes.run}: {episode.run}</p>
              )}
              {episode.mrn && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t.episodes.mrn}: {episode.mrn}</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.sex}</h3>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                {episode.sexo || t.clinicalNote.unknown}
              </p>
            </div>

            {episode.fecha_nacimiento && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.birthDate}</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {formatDate(episode.fecha_nacimiento)}
                </p>
              </div>
            )}

            {episode.fecha_atencion && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.attentionDate}</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {formatDateTime(episode.fecha_atencion)}
                </p>
              </div>
            )}

            {episode.tipo && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.episodeType}</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {episode.tipo}
                </p>
              </div>
            )}

            {episode.profesional && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.professional}</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {episode.profesional}
                </p>
              </div>
            )}

            {episode.motivo_consulta && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.consultReason}</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {episode.motivo_consulta}
                </p>
              </div>
            )}

            {(episode.habitacion || episode.cama) && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t.clinicalNote.location}</h3>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {episode.habitacion && episode.cama
                    ? `${t.clinicalNote.room} ${episode.habitacion} - ${t.clinicalNote.bed} ${episode.cama}`
                    : episode.habitacion || episode.cama}
                </p>
              </div>
            )}
          </div>
        </div>

        {notes.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">{t.clinicalNote.previousNotes}</h3>
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="border-l-4 border-blue-500 bg-gray-50 dark:bg-gray-900 p-4 rounded-r-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-medium">{note.author_username}</span>
                        <span>•</span>
                        <span>{formatDateTime(note.created_at)}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          note.synced_flag
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        }`}>
                          {note.synced_flag ? t.clinicalNote.sent : t.clinicalNote.pending}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
                    {note.note_text}
                    {note.author_nombre && (
                      <span className="text-gray-600 dark:text-gray-400">{'\n\n'}{note.author_nombre}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isReadOnlyMode && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold mb-1">{t.readOnlyMode.title}</h3>
                <p className="text-sm">{t.readOnlyMode.notesBanner}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="mb-4">
            <label className="label text-base">
              {t.clinicalNote.newNote}
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="input-field min-h-[300px] font-mono text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              placeholder={isReadOnlyMode === false ? t.clinicalNote.notePlaceholder : t.readOnlyMode.textareaPlaceholder}
              required
              disabled={isReadOnlyMode !== false}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {noteText.length} {t.clinicalNote.characters}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-lg p-3 text-sm mb-4">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-200 rounded-lg p-3 text-sm mb-4">
              {successMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/episodes')}
              className="flex-1 btn-secondary"
            >
              {t.clinicalNote.backToEpisodes}
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isSaving || !noteText.trim() || isReadOnlyMode !== false}
              title={isReadOnlyMode === true ? t.readOnlyMode.buttonTooltip : ''}
            >
              {isSaving ? t.clinicalNote.saving : t.clinicalNote.saveNote}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
