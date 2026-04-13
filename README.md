# TrakCare Offline Local

Sistema offline para gestión de episodios clínicos con sincronización bidireccional con servidor central.

## Características

- Gestión offline de episodios clínicos
- Almacenamiento de JSON completo con antecedentes del paciente
- Sincronización bidireccional automática con servidor central vía HL7
- Frontend móvil React Native (Android, iOS, Web) con modo oscuro
- Backend containerizado (Docker + PostgreSQL)
- Autenticación JWT con refresh tokens
- Sistema de outbox para garantizar entrega de mensajes
- Descubrimiento de servidor vía mDNS y endpoint `/discovery`
- Soporte multiidioma (Español/English)

## Arquitectura

- **Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL, containerizado con Docker
- **Frontend**: React Native (Expo SDK 54) — Android, iOS, y Web
- **Base de datos**: PostgreSQL 15 con JSONB para datos clínicos
- **Sincronización**: HL7 v2.5 bidireccional (ADT^A28, ADT^A01, ORU^R01)
- **Patrón Outbox** para sincronización confiable upstream
- **mDNS** para descubrimiento automático del servidor en la red local

## Requisitos

### Backend (Docker)
- Docker y Docker Compose

### Backend (desarrollo local)
- Python 3.12+
- PostgreSQL 15+

### Frontend móvil
- Node.js 18+
- Expo Go (para desarrollo rápido) o Android Studio / Xcode (para builds nativos)

## Instalación y Uso

### Backend con Docker (recomendado)

```bash
docker compose up -d
```

Esto levanta:
- **PostgreSQL 15** en puerto 5432
- **Backend FastAPI** en puerto 8000 (aplica migraciones e inicializa usuarios demo automáticamente)

Credenciales demo: `admin` / `admin123`, `demo` / `demo123`

API Docs: http://localhost:8000/docs

### Backend local (desarrollo)

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
alembic upgrade head
python init_demo_users.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend React Native
Ver [frontend_ReactNativ/DEVELOPMENT.md](frontend_ReactNativ/DEVELOPMENT.md) para instrucciones completas.

```bash
cd frontend_ReactNativ
npm install
npx expo start
```

Escanea el código QR con Expo Go (Android) o la cámara (iOS).

### Cargar datos de prueba (opcional)

```bash
python load_test_data.py
```

Carga 10 pacientes de prueba con episodios, alergias, laboratorios, imágenes, etc.

## Estructura del Proyecto

```
project/
├── app/                       # Backend FastAPI
│   ├── models.py             # Modelos SQLAlchemy (PostgreSQL)
│   ├── schemas.py            # Schemas Pydantic
│   ├── main.py               # Aplicación principal
│   ├── background_tasks.py   # Tareas de sincronización
│   ├── outbox_processor.py   # Procesador de eventos
│   ├── sync_service.py       # Servicio de sincronización
│   ├── hl7_builder.py        # Generador de mensajes HL7
│   ├── mdns_service.py       # Descubrimiento mDNS
│   ├── config/               # Configuración i18n
│   └── routers/              # Endpoints REST
├── frontend_ReactNativ/       # Frontend React Native (Expo)
│   └── src/
│       ├── screens/          # Pantallas principales
│       ├── components/       # Componentes reutilizables
│       ├── contexts/         # Contextos (Theme, User, Language)
│       ├── config/           # Configuración i18n
│       └── lib/              # Utilidades (API, Auth)
├── alembic/                   # Migraciones de BD (PostgreSQL)
├── central_mock/              # Mock del servidor central
├── Dockerfile                 # Imagen Docker del backend
├── docker-compose.yml         # Backend + PostgreSQL
└── entrypoint.sh              # Migraciones + uvicorn
```

## Modelo de Datos (PostgreSQL)

### Tabla `episodes`

Almacena episodios completos con JSONB:

- `id`: ID autoincremental
- `mrn`: Medical Record Number (indexado)
- `num_episodio`: Número de episodio (único, indexado)
- `run`, `paciente`, `fecha_nacimiento`, `sexo`: Datos del paciente
- `tipo`, `fecha_atencion`, `hospital`, `habitacion`, `cama`, `ubicacion`, `estado`: Datos del episodio
- `profesional`: Profesional responsable
- `motivo_consulta`: Motivo de la consulta (enviado en HL7 PV2.3)
- `synced_flag`: Indica si está sincronizado
- **`data_json`**: JSON completo incluyendo antecedentes

### Tabla `users`

Usuarios del sistema:

- `id`: ID autoincremental
- `username`: Nombre de usuario (único)
- `hashed_password`: Contraseña hasheada
- `role`: Rol del usuario (admin, user)
- `active`: Estado activo/inactivo
- `nombre`: Nombre completo del usuario
- `filtros`: Filtros API personalizados
- `updated_at`: Fecha de última actualización

### Tabla `clinical_notes`

Notas clínicas asociadas a episodios:

- `id`: ID autoincremental
- `episode_id`: FK a episodes
- `author_user_id`: FK a users
- `author_nombre`: Nombre del autor (snapshot al momento de crear la nota)
- `note_text`: Texto de la nota
- `synced_flag`: Indica si está sincronizada

### Tabla `outbox_events`

Eventos para sincronización upstream:

- `id`: ID autoincremental
- `event_type`: Tipo de evento (episode_created, clinical_note_created)
- `correlation_id`: ID del objeto relacionado
- `hl7_payload`: Mensaje HL7 generado
- `status`: Estado (pending, sent, failed)
- `priority`: Prioridad de procesamiento
- `retry_count`: Número de reintentos

## API Endpoints

### Episodios
- `GET /episodes` - Lista episodios (filtrable por tipo)
- `GET /episodes/{id}` - Obtiene episodio con JSON completo
- `POST /episodes` - Crea nuevo episodio
- `PUT /episodes/{id}` - Actualiza episodio

### Notas Clínicas
- `POST /episodes/{id}/notes` - Crea nota clínica
- `GET /episodes/{id}/notes` - Lista notas del episodio

### Sincronización
- `GET /sync/status` - Estado detallado de sincronización
- `GET /sync/stats` - Estadísticas de sincronización
- `POST /sync/trigger` - Fuerza sincronización manual

### Autenticación
- `GET /auth/me` - Usuario actual (Basic Auth)
- `PUT /auth/me` - Actualiza usuario actual

## Sincronización

El sistema sincroniza automáticamente cada 10-60 segundos:

### 1. Downstream (Central → Local)
- Intervalo: 60 segundos
- GET desde `/apirest/externos/obtenerDatos`
- Upsert de episodios completos con JSON
- Marca episodios como sincronizados

### 2. Upstream (Local → Central)
- Intervalo: 10 segundos
- Procesa eventos de tabla `outbox_events`
- Genera y envía mensajes HL7:
  - ADT^A28 (Añadir información del paciente)
  - ADT^A01 (Admitir/Visitar paciente)
  - ORU^R01 (Observaciones/Notas clínicas)
- POST a `/apirest/externos/hl7inbound`
- Reintentos automáticos (máx 5)

### 3. Actualización Automática de IDs (v2.2.0)
- Cuando se envía un mensaje ORU^R01 (nota clínica), el servidor central responde con:
  - `{"estado":"200","pid":"<ID_Paciente_TC>","enctid":"<ID_Episodio_TC>"}`
- El sistema actualiza automáticamente:
  - `episodes.mrn` ← `pid` (ID del paciente en TrakCare)
  - `episodes.num_episodio` ← `enctid` (ID del episodio en TrakCare)
- Esto garantiza que los IDs locales coincidan con los IDs del sistema central
- Los episodios y notas clínicas quedan correctamente vinculados con TrakCare

### Configuración de intervalos

En `app/settings.py`:

```python
HEALTH_CHECK_INTERVAL: int = 8  # Verificación de conectividad
DOWNSTREAM_SYNC_INTERVAL: int = 60  # Descarga de datos
UPSTREAM_SYNC_INTERVAL: int = 10  # Envío de mensajes HL7
MAX_RETRIES: int = 5  # Reintentos máximos
```

## Desarrollo

### Migraciones de Base de Datos

El proyecto usa Alembic para migraciones:

```bash
# Crear nueva migración
alembic revision -m "descripcion"

# Aplicar migraciones
alembic upgrade head

# Ver historial
alembic history
```

**Migraciones actuales:**
1. `001_initial_simplified.py` - Estructura inicial de base de datos
2. `002_add_profesional_field.py` - Añade campo profesional a episodios
3. `003_make_hl7_payload_nullable.py` - hl7_payload nullable en outbox
4. `004_add_user_filtros_field.py` - Añade filtros personalizados por usuario
5. `005_add_motivo_consulta_and_nombre.py` - Añade motivo_consulta, nombre de usuario y author_nombre

### Variables de Entorno

Crea un archivo `.env` (opcional):

```bash
CENTRAL_URL=http://servidor-central.ejemplo.com:52773
CENTRAL_API_USERNAME=demo
CENTRAL_API_PASSWORD=demodemo
DOWNSTREAM_SYNC_INTERVAL=60
UPSTREAM_SYNC_INTERVAL=10
```

## Solución de Problemas

### Backend no inicia (Docker)

```bash
# Ver logs del backend
docker compose logs backend

# Recrear contenedores
docker compose down
docker compose up -d --build
```

### Backend no inicia (local)

```bash
# Verificar que PostgreSQL esté corriendo
# Verificar DATABASE_URL en .env
# Aplicar migraciones
alembic upgrade head
```

### Error de login

1. Verifica que el backend esté corriendo: `http://localhost:8000/health`
2. Si usas Docker, los usuarios demo se crean automáticamente
3. Si es local, ejecuta: `python init_demo_users.py`

### Puerto 8000 en uso

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <número> /F

# Linux/Mac
lsof -i :8000
kill -9 <PID>
```

### La sincronización no funciona

1. Verifica conectividad con el servidor central: `GET /health/central`
2. Revisa logs del backend
3. Verifica eventos pendientes: `GET /sync/stats`
4. Fuerza sincronización: `POST /sync/trigger`

## Servidor Mock

El proyecto incluye un servidor mock del servidor central en `central_mock/`:

```bash
cd central_mock
pip install -r requirements.txt
uvicorn app.main:app --port 52773
```

Este servidor simula:
- Endpoint `obtenerDatos` para descarga de episodios
- Endpoint `hl7inbound` para recepción de mensajes HL7
- Almacenamiento de mensajes recibidos

## Documentación

- [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) — Documentación completa de API y funcionalidades del backend
- [QUICK_FIXES.md](./QUICK_FIXES.md) — Soluciones rápidas a problemas comunes
- [CHANGELOG.md](./CHANGELOG.md) — Historial de cambios
- [frontend_ReactNativ/DEVELOPMENT.md](./frontend_ReactNativ/DEVELOPMENT.md) — Desarrollo del frontend móvil

## Licencia

Uso interno - Todos los derechos reservados
