import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { api } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRUT, getRUTError } from '../lib/rutValidation';

export function NewEpisode() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rut, setRut] = useState('');
  const [rutError, setRutError] = useState<string | null>(null);
  const [noDocument, setNoDocument] = useState(false);
  const [sex, setSex] = useState('M');
  const [birthDate, setBirthDate] = useState('');
  const [episodeType, setEpisodeType] = useState<string>('');
  const [availableEpisodeTypes, setAvailableEpisodeTypes] = useState<string[]>([]);
  const [locationRoomBox, setLocationRoomBox] = useState('');
  const [clinicUnit, setClinicUnit] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  useEffect(() => {
    const loadEpisodeTypes = async () => {
      try {
        const types = await api.getUniqueEpisodeTypes();
        setAvailableEpisodeTypes(types);
        if (types.length > 0 && !episodeType) {
          setEpisodeType(types[0]);
        }
      } catch (err) {
        console.error('Error loading episode types:', err);
      }
    };

    loadEpisodeTypes();
  }, []);

  useEffect(() => {
    if (!episodeType) return;

    const loadLocations = async () => {
      setIsLoadingLocations(true);
      setLocationsError(null);
      try {
        const locations = await api.getUniqueLocations(episodeType);

        if (!Array.isArray(locations)) {
          throw new Error('Invalid response format');
        }

        setAvailableLocations(locations);
        setFilteredLocations(locations);
      } catch (err) {
        console.error('Error loading locations:', err);
        setLocationsError(err instanceof Error ? err.message : 'Error loading locations');
        setAvailableLocations([]);
        setFilteredLocations([]);
      } finally {
        setIsLoadingLocations(false);
      }
    };

    loadLocations();
    setClinicUnit('');
  }, [episodeType]);

  const handleRutChange = (value: string) => {
    const formatted = formatRUT(value);
    setRut(formatted);
    if (!noDocument) {
      const error = getRUTError(formatted);
      setRutError(error);
    }
  };

  const handleNoDocumentChange = (checked: boolean) => {
    setNoDocument(checked);
    if (checked) {
      setRut('');
      setRutError(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowLocationDropdown(true);

    if (value.trim() === '') {
      setFilteredLocations(availableLocations);
    } else {
      const filtered = availableLocations.filter(loc =>
        loc.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredLocations(filtered);
    }
  };

  const selectLocation = (location: string) => {
    setClinicUnit(location);
    setSearchTerm('');
    setShowLocationDropdown(false);
  };

  const handleFocusLocation = () => {
    console.log('handleFocusLocation called');
    console.log('availableLocations:', availableLocations);
    console.log('availableLocations.length:', availableLocations.length);
    console.log('isLoadingLocations:', isLoadingLocations);

    if (isLoadingLocations) {
      console.log('Still loading locations, waiting...');
      return;
    }

    if (availableLocations.length > 0) {
      setSearchTerm('');
      setFilteredLocations(availableLocations);
      setShowLocationDropdown(true);
      console.log('Dropdown should be visible now');
    } else {
      console.log('No locations available');
      if (!locationsError) {
        console.log('Opening empty dropdown to show message');
        setShowLocationDropdown(true);
      }
    }
  };

  const handleBlurLocation = () => {
    setTimeout(() => {
      setShowLocationDropdown(false);
      setSearchTerm('');
    }, 200);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!noDocument && rutError) {
      setError(rutError);
      return;
    }

    setIsLoading(true);

    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const cleanRut = rut ? rut.replace(/[.-]/g, '') : `NODOC${timestamp.slice(-8)}`;

      const temporalMrn = `OFFP${cleanRut}`;
      const temporalEpisodeNum = `OFFE${timestamp}`;
      const fullName = `${firstName} ${lastName}`;

      const episodeData = {
        Paciente: fullName,
        Nombre: fullName,
        MRN: temporalMrn,
        Run: rut || '',
        RUN: rut || '',
        FechaNacimiento: birthDate,
        Sexo: sex === 'M' ? 'Masculino' : sex === 'F' ? 'Femenino' : 'Otro',
        Tipo: episodeType,
        FechaAtencion: now.toISOString(),
        NumEpisodio: temporalEpisodeNum,
        Hospital: 'Hospital Demo',
        Habitacion: locationRoomBox,
        Cama: '',
        Ubicacion: clinicUnit || '',
        Local: clinicUnit || '',
        Estado: 'Activo',
        Profesional: '',
        Antecedentes: {
          Encuentros: [],
          Resultados: []
        }
      };

      const episode = await api.createEpisode({
        mrn: temporalMrn,
        num_episodio: temporalEpisodeNum,
        run: rut,
        paciente: fullName,
        fecha_nacimiento: birthDate ? new Date(birthDate).toISOString() : undefined,
        sexo: episodeData.Sexo,
        tipo: episodeType,
        fecha_atencion: now.toISOString(),
        hospital: 'Hospital Demo',
        habitacion: locationRoomBox,
        cama: '',
        ubicacion: clinicUnit || '',
        estado: 'Activo',
        motivo_consulta: motivoConsulta,
        data_json: JSON.stringify(episodeData)
      });

      navigate(`/episode/${episode.id}/note`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.newEpisode.createError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/episodes')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2 mb-4"
          >
            ← {t.newEpisode.backToEpisodes}
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t.newEpisode.titlePatient}</h2>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6">
          <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">{t.newEpisode.patientData}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  {t.newEpisode.firstName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">
                  {t.newEpisode.lastName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">{t.newEpisode.rut}</label>
                <div className="mb-2">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noDocument}
                      onChange={(e) => handleNoDocumentChange(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {t.newEpisode.noDocument}
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  value={rut}
                  onChange={(e) => handleRutChange(e.target.value)}
                  className={`input-field ${rutError ? 'border-red-500 dark:border-red-600' : ''} ${noDocument ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                  placeholder="12345678-9"
                  disabled={noDocument}
                />
                {rutError && !noDocument && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{rutError}</p>
                )}
              </div>

              <div>
                <label className="label">
                  {t.newEpisode.sex} <span className="text-red-500">*</span>
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="M">{t.newEpisode.sexOptions.M}</option>
                  <option value="F">{t.newEpisode.sexOptions.F}</option>
                  <option value="O">{t.newEpisode.sexOptions.O}</option>
                  <option value="U">{t.newEpisode.sexOptions.U}</option>
                </select>
              </div>

              <div>
                <label className="label">
                  {t.newEpisode.birthDate} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">{t.newEpisode.episodeData}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  {t.newEpisode.episodeType} <span className="text-red-500">*</span>
                </label>
                <select
                  value={episodeType}
                  onChange={(e) => setEpisodeType(e.target.value)}
                  className="input-field"
                  required
                  disabled={availableEpisodeTypes.length === 0}
                >
                  {availableEpisodeTypes.length === 0 ? (
                    <option value="">{t.newEpisode.noEpisodeTypes || 'No hay tipos disponibles'}</option>
                  ) : (
                    availableEpisodeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="label">{t.newEpisode.roomBox}</label>
                <input
                  type="text"
                  value={locationRoomBox}
                  onChange={(e) => setLocationRoomBox(e.target.value)}
                  className="input-field"
                  placeholder="Ej: Box 3, Habitación 201"
                />
              </div>

              <div className="md:col-span-2 relative">
                <label className="label">{t.newEpisode.clinicUnit}</label>
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={showLocationDropdown ? searchTerm : clinicUnit}
                      onFocus={handleFocusLocation}
                      onClick={handleFocusLocation}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onBlur={handleBlurLocation}
                      className={`input-field pr-10 cursor-pointer ${locationsError ? 'border-red-300 dark:border-red-700' : ''}`}
                      placeholder={
                        isLoadingLocations
                          ? 'Cargando ubicaciones...'
                          : availableLocations.length === 0
                            ? t.newEpisode.clinicUnitNoData
                            : t.newEpisode.clinicUnitPlaceholder
                      }
                      disabled={isLoadingLocations || availableLocations.length === 0}
                      readOnly={false}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      {isLoadingLocations ? (
                        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {showLocationDropdown && !isLoadingLocations && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(() => {
                        console.log('Rendering dropdown');
                        console.log('filteredLocations:', filteredLocations);
                        console.log('filteredLocations.length:', filteredLocations.length);
                        return null;
                      })()}
                      {filteredLocations.length > 0 ? (
                        filteredLocations.map((location, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectLocation(location)}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors ${
                              location === clinicUnit ? 'bg-blue-50 dark:bg-blue-950' : ''
                            }`}
                          >
                            {location}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
                          {availableLocations.length === 0
                            ? t.newEpisode.clinicUnitNoDataSync
                            : t.newEpisode.clinicUnitNoResults}
                        </div>
                      )}
                    </div>
                  )}
                  {locationsError && !showLocationDropdown && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      Error: {locationsError}
                    </p>
                  )}
                </div>
                {clinicUnit && !showLocationDropdown && (
                  <input type="hidden" name="clinicUnit" value={clinicUnit} />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="label">{t.newEpisode.consultReason}</label>
                <textarea
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="Describa brevemente el motivo de la consulta..."
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/episodes')}
              className="flex-1 btn-secondary"
              disabled={isLoading}
            >
              {t.newEpisode.cancel}
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={isLoading}
            >
              {isLoading ? t.newEpisode.creating : t.newEpisode.createAndContinue}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
