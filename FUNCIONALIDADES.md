# DOCUMENTACIÓN COMPLETA DE FUNCIONALIDADES — BACKEND API

Sistema TrakCare Offline Local

---

## ÍNDICE

1. [Backend - Autenticación y Usuarios](#backend---autenticación-y-usuarios)
2. [Backend - Episodios Clínicos](#backend---episodios-clínicos)
3. [Backend - Notas Clínicas](#backend---notas-clínicas)
4. [Backend - Salud y Estado del Sistema](#backend---salud-y-estado-del-sistema)
5. [Backend - Sincronización](#backend---sincronización)
6. [Backend - Tareas en Segundo Plano](#backend---tareas-en-segundo-plano)
7. [Backend - Servicios Auxiliares](#backend---servicios-auxiliares)
8. [Características Transversales](#características-transversales)
13. [Frontend - Configuración](#frontend---configuración)
14. [Características Transversales](#características-transversales)

---

## BACKEND - AUTENTICACIÓN Y USUARIOS

### Obtener usuario actual
- **Endpoint:** `GET /auth/me`
- **Archivo:** `app/routers/auth.py:10`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene la información del usuario autenticado actualmente
- **Response:** Datos del usuario (id, username, role, nombre, profesional, filtros)

### Actualizar usuario actual
- **Endpoint:** `PUT /auth/me`
- **Archivo:** `app/routers/auth.py:15`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Permite al usuario actualizar su información (nombre, profesional, filtros, idioma)
- **Body:** UserUpdate (nombre, profesional, filtros)
- **Response:** Usuario actualizado

---

## BACKEND - EPISODIOS CLÍNICOS

### Crear episodio
- **Endpoint:** `POST /episodes`
- **Archivo:** `app/routers/episodes.py:12`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Crea un nuevo episodio clínico
- **Features:**
  - Generación automática de `num_episodio` con formato `YYYYMMDD-HHMMSS`
  - Validación de datos del paciente
  - Almacenamiento del JSON completo en `data_json`
  - Creación automática de evento outbox para sincronización
  - Generación de mensaje HL7 ADT^A01 con ubicación y unidad clínica
- **Body:** EpisodeCreate (mrn, run, paciente, fecha_nacimiento, sexo, tipo, hospital, habitacion, ubicacion, etc.)
- **Response:** Episodio creado con todos los campos

### Obtener tipos únicos de episodio
- **Endpoint:** `GET /episodes/types/unique`
- **Archivo:** `app/routers/episodes.py`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene todos los tipos de episodio únicos existentes en la base de datos
- **Response:** Lista de strings con tipos de episodio (ej: ["Urgencia", "Hospitalizado", "Ambulatorio"])
- **Uso:** Poblar dropdown de tipo de episodio en formulario de creación

### Obtener ubicaciones únicas
- **Endpoint:** `GET /episodes/locations/unique?tipo={tipo_episodio}`
- **Archivo:** `app/routers/episodes.py`
- **Autenticación:** Bearer token (JWT)
- **Query Params:**
  - `tipo` (optional): Filtra ubicaciones por tipo de episodio
- **Descripción:** Obtiene todas las ubicaciones únicas existentes en la base de datos
- **Response:** Lista de strings con ubicaciones (ej: ["Urgencias", "UCI", "Pabellón"])
- **Uso:** Poblar dropdown de unidad clínica en formulario de creación

### Listar episodios
- **Endpoint:** `GET /episodes`
- **Archivo:** `app/routers/episodes.py:72`
- **Autenticación:** Bearer token (JWT)
- **Query Params:**
  - `tipo` (optional): Filtra por tipo de episodio
  - `estado` (optional): Filtra por estado (activo/cerrado)
  - `profesional` (optional): Filtra por profesional
  - `search` (optional): Búsqueda por paciente o MRN
  - `skip` (default: 0): Offset para paginación
  - `limit` (default: 50): Cantidad de resultados
- **Descripción:** Lista episodios con filtrado y paginación
- **Response:** Lista de episodios

### Obtener episodio específico
- **Endpoint:** `GET /episodes/{episode_id}`
- **Archivo:** `app/routers/episodes.py:122`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene un episodio completo incluyendo el JSON con antecedentes
- **Response:** Episodio con data_json completo

### Actualizar episodio
- **Endpoint:** `PUT /episodes/{episode_id}`
- **Archivo:** `app/routers/episodes.py:141`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Actualiza un episodio existente
- **Features:**
  - Actualización de campos indexados
  - Actualización del JSON completo
  - No genera evento outbox (solo se sincronizan creaciones)
- **Body:** EpisodeUpdate
- **Response:** Episodio actualizado

### Eliminar episodio
- **Endpoint:** `DELETE /episodes/{episode_id}`
- **Archivo:** `app/routers/episodes.py:176`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Elimina un episodio y sus notas asociadas
- **Response:** Estado de eliminación

---

## BACKEND - NOTAS CLÍNICAS

### Crear nota clínica
- **Endpoint:** `POST /episodes/{episode_id}/notes`
- **Archivo:** `app/routers/notes.py:11`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Crea una nota clínica asociada a un episodio
- **Features:**
  - Snapshot del nombre del autor al momento de creación
  - Creación automática de evento outbox
  - Generación de mensaje HL7 ORU^R01
  - Actualización automática de IDs (MRN y num_episodio) con respuesta del servidor
- **Body:** ClinicalNoteCreate (note_text)
- **Response:** Nota clínica creada

### Listar notas de episodio
- **Endpoint:** `GET /episodes/{episode_id}/notes`
- **Archivo:** `app/routers/notes.py:48`
- **Autenticación:** Bearer token (JWT)
- **Query Params:**
  - `skip` (default: 0): Offset para paginación
  - `limit` (default: 100): Cantidad de resultados
- **Descripción:** Lista todas las notas de un episodio específico
- **Response:** Lista de notas clínicas ordenadas por fecha de creación (descendente)

### Obtener nota específica
- **Endpoint:** `GET /episodes/{episode_id}/notes/{note_id}`
- **Archivo:** `app/routers/notes.py:92`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene una nota clínica específica
- **Validación:** Verifica que la nota pertenezca al episodio indicado
- **Response:** Nota clínica completa

---

## BACKEND - SALUD Y ESTADO DEL SISTEMA

### Health check local
- **Endpoint:** `GET /health`
- **Archivo:** `app/routers/general.py:14`
- **Autenticación:** No requerida
- **Descripción:** Verifica el estado del servidor local
- **Response:** `{"status": "ok"}`

### Health check servidor central
- **Endpoint:** `GET /health/central`
- **Archivo:** `app/routers/general.py:20`
- **Autenticación:** No requerida
- **Descripción:** Verifica conectividad con el servidor central
- **Response:** Estado de conexión y detalles de respuesta

### Estado de sincronización
- **Endpoint:** `GET /sync/status`
- **Archivo:** `app/routers/general.py:33`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene estado detallado de la sincronización
- **Response:**
  - Conectividad con servidor central
  - Cantidad de eventos pendientes
  - Cantidad de eventos fallidos
  - Fecha de última sincronización downstream
  - Estado de sincronización general

---

## BACKEND - SINCRONIZACIÓN

### Sincronizar manualmente
- **Endpoint:** `POST /sync/trigger`
- **Archivo:** `app/routers/sync.py:14`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Fuerza una sincronización manual inmediata
- **Features:**
  - Ejecuta sincronización downstream (obtener datos del central)
  - Ejecuta sincronización upstream (enviar eventos outbox)
- **Response:** Resultado de la sincronización

### Reintentar eventos fallidos
- **Endpoint:** `POST /sync/retry-failed`
- **Archivo:** `app/routers/sync.py:40`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Resetea el contador de reintentos de eventos fallidos
- **Features:**
  - Reinicia retry_count a 0
  - Cambia status de 'failed' a 'pending'
  - Permite reenvío automático de mensajes que fallaron
- **Response:** Cantidad de eventos reseteados

### Estado de conexión
- **Endpoint:** `GET /sync/connection-status`
- **Archivo:** `app/routers/sync.py:67`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene el estado actual de conexión
- **Response:**
  - Estado del servidor local
  - Estado del servidor central
  - Conectividad general

### Estadísticas de sincronización
- **Endpoint:** `GET /sync/stats`
- **Archivo:** `app/routers/sync.py:82`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Obtiene estadísticas detalladas de eventos outbox
- **Response:**
  - Eventos pendientes (por tipo)
  - Eventos enviados (por tipo)
  - Eventos fallidos (por tipo)
  - Total de eventos

### Sincronizar desde central
- **Endpoint:** `POST /sync/from-central`
- **Archivo:** `app/routers/sync.py:103`
- **Autenticación:** Bearer token (JWT)
- **Descripción:** Ejecuta solo sincronización downstream (descarga de datos)
- **Features:**
  - Obtiene datos del endpoint `/apirest/externos/obtenerDatos`
  - Upsert de episodios locales
  - Marca episodios como sincronizados
- **Response:** Resultado de la sincronización

---

## BACKEND - TAREAS EN SEGUNDO PLANO

### Monitoreo de salud del servidor central
- **Archivo:** `app/sync_service.py:66`
- **Función:** `check_central_health()`
- **Intervalo:** Cada 8 segundos (configurable en settings)
- **Descripción:** Verifica continuamente la conectividad con el servidor central
- **Actualiza:** Variable global `central_server_online`

### Procesamiento de eventos Outbox
- **Archivo:** `app/outbox_processor.py`
- **Función:** `process_outbox_events()`
- **Intervalo:** Cada 10 segundos (configurable en settings)
- **Descripción:** Procesa eventos pendientes en la tabla outbox_events
- **Features:**
  - Envía mensajes HL7 al servidor central
  - Actualiza status de eventos (pending → sent/failed)
  - Incrementa retry_count en caso de falla
  - Máximo 5 reintentos
  - Actualiza IDs (MRN y num_episodio) con respuesta del servidor

### Sincronización automática al iniciar
- **Archivo:** `app/main.py:73`
- **Función:** `startup_sync_from_central()`
- **Trigger:** Al iniciar el servidor
- **Descripción:** Ejecuta una sincronización downstream inmediata al arrancar
- **Features:**
  - Descarga episodios del servidor central
  - Actualiza base de datos local
  - Solo se ejecuta si el servidor central está disponible

### Reset de contadores de reintentos
- **Archivo:** `app/main.py:52`
- **Función:** `reset_retry_counts_on_startup()`
- **Trigger:** Al iniciar el servidor
- **Descripción:** Resetea contadores de reintentos de eventos fallidos
- **Features:**
  - Cambia status de 'failed' a 'pending'
  - Reinicia retry_count a 0
  - Permite reenvío automático al arrancar

---

## BACKEND - SERVICIOS AUXILIARES

### Construcción de mensajes HL7
- **Archivo:** `app/hl7_builder.py`
- **Funciones principales:**
  - `build_a28_message()`: Mensaje ADT^A28 (Añadir información del paciente)
  - `build_a01_message()`: Mensaje ADT^A01 (Admitir/Visitar paciente)
  - `build_oru_message()`: Mensaje ORU^R01 (Observaciones/Notas clínicas)
- **Features:**
  - Generación de segmentos MSH, EVN, PID, PV1, PV2, OBR, OBX
  - Formateo correcto de fechas
  - Codificación de caracteres especiales
  - Validación de campos requeridos
  - **PV1.3** incluye unidad clínica y habitación en formato: `ubicacion^habitacion`
  - Separación clara entre ubicación física (habitacion) y servicio (ubicacion)

### Gestión de estado de sincronización
- **Archivo:** `app/sync_service.py:83`
- **Función:** `get_sync_state()`
- **Descripción:** Obtiene el estado completo de sincronización del sistema
- **Response:**
  - Estado de servidores (local y central)
  - Contadores de eventos outbox
  - Fecha de última sincronización
  - Conectividad general

### Obtención de datos desde central
- **Archivo:** `app/sync_service.py:198`
- **Función:** `sync_from_central()`
- **Descripción:** Descarga episodios del servidor central
- **Features:**
  - GET a `/apirest/externos/obtenerDatos`
  - Autenticación JWT (Bearer token)
  - Parseo de respuesta JSON
  - Upsert de episodios locales
  - Actualización de marca `synced_flag`

### Procesamiento de datos de pacientes
- **Archivo:** `app/sync_service.py:224`
- **Función:** `process_patient_data()`
- **Descripción:** Procesa y almacena datos de pacientes descargados
- **Features:**
  - Creación o actualización de episodios
  - Preservación de JSON completo
  - Actualización de campos indexados
  - Marca como sincronizado

---

## CARACTERÍSTICAS TRANSVERSALES

### Modo offline
- **Descripción:** El sistema funciona completamente sin conexión al servidor central
- **Funcionalidades:**
  - Creación de episodios y notas en modo offline
  - Almacenamiento en PostgreSQL local
  - Encola operaciones en tabla `outbox_events`
  - Sincronización automática al recuperar conexión
  - Reintentos automáticos de operaciones fallidas

### Sincronización bidireccional
- **Local → Central (Upstream):**
  - Envío de eventos desde `outbox_events`
  - Mensajes HL7: ADT^A28, ADT^A01, ORU^R01
  - POST a `/apirest/externos/hl7inbound`
  - Reintentos automáticos (máx 5)
  - Actualización de IDs con respuesta del servidor
- **Central → Local (Downstream):**
  - Descarga de episodios cada 60 segundos
  - GET desde `/apirest/externos/obtenerDatos`
  - Upsert de episodios locales
  - Marca de episodios como sincronizados
- **Manejo de conflictos:**
  - Los datos del servidor central prevalecen en downstream
  - Los eventos locales no sincronizados se preservan
  - No se sobrescriben datos locales más recientes

### Multiidioma
- **Idiomas soportados:** Español (es), Inglés (en)
- **Implementación:** Backend (`app/config/`) y frontend React Native (`frontend_ReactNativ/src/config/`)

### Seguridad
- **Autenticación:** JWT con refresh tokens (Bearer token), fallback Basic Auth
- **Autorización:** Rutas protegidas, verificación de roles (admin/user)
- **Validación:** Pydantic schemas en backend, prevención de inyección SQL via SQLAlchemy ORM
