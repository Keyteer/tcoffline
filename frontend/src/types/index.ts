export type EpisodeType = 'Urgencia' | 'Hospitalizado' | 'Ambulatorio' | 'Nuevos';

export const EPISODE_TYPE_LABELS: Record<EpisodeType, string> = {
  Urgencia: 'Urgencia',
  Hospitalizado: 'Hospitalizado',
  Ambulatorio: 'Ambulatorio',
  Nuevos: 'Nuevos',
};

export interface User {
  id: number;
  username: string;
  role: string;
  active: boolean;
  is_admin: boolean;
  nombre?: string | null;
  filtros?: string | null;
  updated_at: string;
}

export interface UserUpdateRequest {
  password?: string;
  nombre?: string;
  filtros?: string;
}

export interface UserCreateRequest {
  username: string;
  password: string;
  nombre?: string;
  is_admin: boolean;
}

export interface SystemSettings {
  enable_read_only_mode: boolean;
}

export interface Episode {
  id: number;
  mrn: string;
  num_episodio: string;
  run?: string;
  paciente?: string;
  fecha_nacimiento?: string;
  sexo?: string;
  tipo?: string;
  fecha_atencion?: string;
  hospital?: string;
  habitacion?: string;
  cama?: string;
  ubicacion?: string;
  estado?: string;
  profesional?: string;
  motivo_consulta?: string;
  data_json: string;
  created_at: string;
  updated_at: string;
  synced_flag: boolean;
  pending_notes_count: number;
}

export interface EpisodeDetail extends Episode {
  data: EpisodeData;
}

export interface EpisodeData {
  MRN: string;
  NumEpisodio: string;
  RUN?: string;
  Paciente?: string;
  Nombre?: string;
  FechaNacimiento?: string;
  Sexo?: string;
  Tipo?: string;
  FechaAtencion?: string;
  Hospital?: string;
  Habitacion?: string;
  Cama?: string;
  Ubicacion?: string;
  Local?: string;
  Estado?: string;
  Profesional?: string;
  Antecedentes?: {
    Encuentros?: EncuentroHistorico[];
    Resultados?: ResultadoHistorico[];
    Alergias?: AlergiaHistorica[];
    RegistrosOffline?: RegistroOffline[];
  };
}

export interface EncuentroHistorico {
  FechaHora?: string;
  Medico?: string;
  Especialidad?: string;
  Tipo?: string;
  MotivoConsulta?: string;
  Diagnosticos?: Array<{ Glosa: string }>;
  Medicamentos?: Array<{ Glosa: string }>;
  Indicaciones?: Array<{ Glosa: string }>;
}

export interface ResultadoHistorico {
  Tipo?: string;
  Examen?: string;
  Valor?: string;
  Unidad?: string;
  RangoReferencia?: string;
  FechaHora?: string;
  AbnormalFlag?: string;
}

export interface AlergiaHistorica {
  Alergia: string;
  Tipo?: string;
  Severidad?: string;
  Fecha?: string;
  Activa: boolean;
}

export interface RegistroOffline {
  FechaHora: string;
  Profesional?: string;
  Nota?: string;
}

export interface ClinicalNote {
  id: number;
  episode_id: number;
  author_user_id: number;
  author_username: string;
  author_nombre?: string;
  note_text: string;
  created_at: string;
  synced_flag: boolean;
}

export interface SyncStatus {
  pending_events: number;
  failed_events: number;
  last_sync: string | null;
  total_outbox_events: number;
}

export interface SyncStats {
  pending_events: number;
  failed_events: number;
  total_episodes: number;
  synced_episodes: number;
  local_only_episodes: number;
  last_downstream_sync: string | null;
  last_upstream_sync: string | null;
  connection: {
    is_online: boolean;
    last_check: string | null;
  };
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface EpisodeCreateRequest {
  mrn: string;
  num_episodio: string;
  run?: string;
  paciente: string;
  fecha_nacimiento?: string;
  sexo?: string;
  tipo?: string;
  fecha_atencion?: string;
  hospital?: string;
  habitacion?: string;
  cama?: string;
  ubicacion?: string;
  estado?: string;
  profesional?: string;
  motivo_consulta?: string;
  data_json: string;
}

export interface ClinicalNoteCreateRequest {
  note_text: string;
}
