# DOCUMENTACIÓN COMPLETA DE FUNCIONALIDADES — BACKEND API

Sistema TrakCare Offline Local

---

## ÍNDICE

1. [Backend - Referencia API (endpoints)](#backend---referencia-api)
2. [Backend - Tareas en Segundo Plano](#backend---tareas-en-segundo-plano)
3. [Backend - Servicios Auxiliares](#backend---servicios-auxiliares)
4. [Características Transversales](#características-transversales)
5. [Frontend - Configuración](#frontend---configuración)

---

## BACKEND - REFERENCIA API

La documentación completa de todos los endpoints HTTP — contratos, parámetros, schemas de request/response y autenticación requerida — está disponible en la interfaz interactiva generada automáticamente por FastAPI desde el código fuente:

- **Swagger UI (interactivo):** `http://localhost:8000/docs`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

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
