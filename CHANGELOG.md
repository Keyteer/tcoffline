# Changelog

---

## [2.0-beta15] - 2026-04-23

### Corregido
#### Notas clínicas fallaban inmediatamente en lugar de esperar a que el episodio se sincronizara

**Problema 1 — Prioridad de eventos invertida:**  
`episode_created` tenía `priority=2` y `clinical_note_created` tenía `priority=3`. Como el procesador ordena por `priority DESC`, las notas se procesaban *antes* que el episodio, encontraban IDs `OFFE*` no sincronizados y fallaban.

- **Fix:** Cambiado `priority` de `episode_created` de `2` a `5` en `app/routers/episodes.py`. Ahora el orden garantizado es: episodio (5) → nota (3).

**Problema 2 — NoneType error en `build_obr_segment`:**  
`app/hl7_builder.py :: build_obr_segment` accedía a `most_recent_user.filtros` sin verificar si el usuario o el campo `filtros` era `None`, causando `'NoneType' object has no attribute 'split'` al construir ORU.

- **Fix:** Añadida guarda defensiva en `build_obr_segment`: `user = ""` por defecto; el parseo de `filtros` solo se intenta si el campo existe, con `try/except`.

**Resultado verificado (end-to-end):**  
Crear episodio `OFFP*`/`OFFE*` + nota → trigger sync → en el mismo batch:  
1. `episode_created` (priority 5) procesa primero → A28+A01 OK, IDs reales asignados  
2. `clinical_note_created` (priority 3) procesa en el mismo batch → ORU OK, `synced_flag=true`  
Ambos eventos terminan `status=sent`, `retry_count=0`.

---

## [2.0-beta14] - 2026-04-23

### Añadido
#### Soporte HL7 v2.5 para eliminación y cancelación de episodios/pacientes
- Nuevos builders en `app/hl7_builder.py`:
  - `build_a08_message` — ADT^A08 (Update Patient Information).
  - `build_a11_message` — ADT^A11 (Cancel Admit/Visit Notification).
  - `build_a13_message` — ADT^A13 (Cancel Discharge).
  - `build_a23_message` — ADT^A23 (Delete a Patient Record / visit-level).
  - `build_a29_message` — ADT^A29 (Delete Person Information / patient-level).
- Outbox processor: nuevos handlers para eventos `episode_updated`, `episode_deleted`, `episode_admit_cancelled`, `episode_discharge_cancelled`, `patient_deleted`.
- `process_prebuilt_payload_event`: envía HL7 ya construido en la ruta originadora (necesario para deletes, donde la fila ya no existe al procesar).
- `DELETE /episodes/{id}`: ahora construye y encola un ADT^A23 antes de borrar (solo para episodios sincronizados con central; los `OFFP/OFFE` se borran sin notificar).
- Nuevo router `app/routers/patients.py` con `DELETE /patients/{mrn}`: borra el paciente y todos sus episodios locales, encolando ADT^A23 por cada episodio sincronizado y un ADT^A29 final para el paciente. Pacientes/episodios `OFFP*`/`OFFE*` se eliminan sin notificar a central.
- `requests/backend/episodes.http`: añadida sección "Patient delete (ADT^A29)" con el flujo de cierre completo (re-fetch del MRN real, delete patient, trigger sync, verify).

---

## [2.0-beta13] - 2026-04-23

### Modificado
#### Requests HTTP — `episodes.http` y `notes.http` alineados con validaciones de central
- Reemplazada `ubicacion` `Unidad Emergencia Adultos`/`Piso 3` por `Consulta Telemedicina` (CTLOC v\u00e1lido confirmado por central).
- Eliminado `run` con d\u00edgito verificador inv\u00e1lido (central rechaza con `RUN ingresado invalido`).
- A\u00f1adido `fecha_nacimiento` obligatorio (sin \u00e9l A28 falla con `Datatype validation failed on PAPerson:PAPERDob`).
- Cambiados prefijos `MRN-TEST-XXX`/`EP-TEST-XXX` por `OFFP{{$randomInt}}`/`OFFE{{$randomInt}}` para:
  - Evitar colisiones entre ejecuciones repetidas.
  - Disparar el flujo secuencial A28 + A01 que asigna PID/enctid reales.
- Documentado en comentarios al inicio de `Create episode` el contrato esperado por central.
- Verificado end-to-end: payload nuevo \u2192 central asigna `MRN=000008258, NumEpisodio=A0000011315`, `synced_flag=true`.

---

## [2.0-beta12] - 2026-04-23

### Modificado
#### Backend — Endpoints `/types/unique` y `/locations/unique` filtran por episodios sincronizados
- **Problema**: los dropdowns del frontend ofrecían valores de `tipo` y `ubicacion` provenientes de episodios locales que central nunca aceptó (p. ej. `Urgencias`), provocando errores `E^ Local No es válido^CTLOCDesc` al intentar sincronizar.
- **Fix en `app/routers/episodes.py`**: ambos endpoints ahora filtran con `Episode.synced_flag == True`, garantizando que solo se exponen valores ya validados por central (p. ej. `Consulta Telemedicina`, `Unidad Emergencia Adultos`).
- Verificado end-to-end: episodio creado local → A28 → A01 → `synced_flag=true`, MRN/NumEpisodio reemplazados por los de central.

---

## [2.0-beta11] - 2026-04-23

### Corregido
#### Backend — Respuestas `estado: NOK` de central tratadas como éxito
- **Bug**: en `app/outbox_processor.py::send_hl7_message`, cualquier respuesta JSON que contuviera la clave `"estado"` se devolvía como `(True, "AA", data)` sin inspeccionar el valor. Con `{"estado":"NOK","reason":"..."}` el evento se marcaba como `sent` aunque central rechazara el mensaje.
- **Fix**: ahora se compara `estado.upper() == "OK"` para considerar éxito; cualquier otro valor devuelve `(False, "AE", error_msg)` con `reason` incluido, activando el flujo normal de reintentos/fallo.

#### Frontend — `data_json` enviado como string en creación de episodios
- **Bug**: `NewEpisodeScreen.tsx` enviaba `data_json: JSON.stringify(episodeData)`, provocando error Pydantic `Input should be a valid dictionary` (el backend espera `dict`).
- **Fix**:
  - `frontend_ReactNativ/src/screens/NewEpisodeScreen.tsx`: se envía `data_json: episodeData` (objeto crudo).
  - `frontend_ReactNativ/src/types/index.ts`: `EpisodeCreateRequest.data_json` cambia de `string` a `Record<string, unknown>` para alinear con el schema backend.

---

## [2.0-beta10] - 2026-04-22

### Corregido
#### Backend — Outbox processor: episodios locales con IDs reales no se enviaban a central
- **Bug**: `process_episode_created_event` usaba el prefijo `OFFP`/`OFFE` como única señal de "episodio local". Episodios creados manualmente con IDs reales (ej. `EP-TEST-003`) eran marcados como `sent` sin enviar ningún mensaje HL7.
- **Causa raíz**: la condición `if not (is_new_patient and is_new_episode)` asumía que cualquier episodio sin prefijos OFFP/OFFE provenía de central, ignorando `synced_flag`.
- **Fix en `app/outbox_processor.py`**: se añadió comprobación de `episode.synced_flag`:
  - `synced_flag=True` → episodio viene de central, se marca como enviado sin HL7 (comportamiento previo correcto).
  - `synced_flag=False` + IDs reales → episodio creado localmente con paciente ya conocido en central → se envía `ADT^A01` directamente.
  - `synced_flag=False` + prefijos OFFP/OFFE → flujo secuencial A28 + A01 (sin cambios).

---

## [2.0-beta09] - 2026-04-22

### Modificado
#### Backend — Control de sincronización automática
- Añadida variable `AUTO_SYNC_ENABLED` (bool, default `true`) en `app/settings.py`
- `startup_event()` en `app/main.py`: sync inicial y tareas periódicas (health check, loops downstream/upstream) solo se inician si `AUTO_SYNC_ENABLED=true`; con `false` el backend arranca limpio solo con endpoints disponibles
- Los endpoints manuales `POST /sync/from-central` y `POST /sync/trigger` funcionan siempre independientemente del flag

#### Docker Compose — Servicio único
- Eliminado servicio `backend-dev` y anchor YAML `x-backend-base`
- Un único servicio `backend`; el modo se controla editando `.env` y reiniciando
- `DATABASE_URL` sigue siendo el único override a nivel compose (apunta al hostname `db`)

#### Variables de entorno
- `.env` actualizado con flags de desarrollo: `AUTO_SYNC_ENABLED=false`, `LOG_LEVEL=DEBUG`, `LOG_VERBOSE=true`
- `.env.example` actualizado con defaults de producción: `AUTO_SYNC_ENABLED=true`, `LOG_LEVEL=WARNING`, `LOG_VERBOSE=false`

---

## [2.0-beta08] - 2026-04-22

### Modificado
#### Documentacion
- `INSTALL_AND_RUN.md`: eliminado el bloque de instalacion/ejecucion local del backend (sin Docker)
- `INSTALL_AND_RUN.md`: aclarado explicitamente que ejecutar backend fuera de Docker no esta soportado
- `QUICK_FIXES.md`: eliminadas secciones de troubleshooting para backend local (Python/venv/alembic)
- `QUICK_FIXES.md`: eliminado comando de reinicio para backend local

---

## [2.0-beta07] - 2026-04-21

### Modificado
#### Docker Compose — Perfiles prod / dev / test
- Separación en tres perfiles: `prod` (default), `dev` y `test`
- Perfil `prod`: `LOG_LEVEL=WARNING`, log rotation JSON (10 MB × 3 archivos), logs silenciosos
- Perfil `dev`: `LOG_LEVEL=DEBUG`, `LOG_VERBOSE=true`, logs verbose en consola
- Perfil `test`: sin cambios funcionales

#### Sistema de Logging del Backend
- `app/settings.py`: nuevas variables `LOG_LEVEL` y `LOG_VERBOSE`
- `app/main.py`: configuración centralizada de logging desde settings; supresión total de uvicorn access log en prod; `LOG_VERBOSE=true` habilita request logging completo
- `app/background_tasks.py`, `sync_service.py`, `outbox_processor.py`: eliminados `basicConfig` locales; logs periódicos de sync degradados a `DEBUG`; banners `=====` eliminados
- `app/sync_service.py`: logs de conexión/desconexión del servidor central al cambiar estado; URL logueada al iniciar monitoreo; polling degradado a `DEBUG`
- `entrypoint.sh`: `--log-level` de uvicorn leído desde `$LOG_LEVEL`

#### Documentación — Reestructuración
- `README.md`: simplificado a landing page con quick start y tabla de links a docs
- `INSTALL_AND_RUN.md`: sección de perfiles Docker Compose, variables de logging, checklist producción; tests movidos a TESTING.md
- `TESTING.md`: nuevo archivo — pytest backend, Jest frontend, guía de archivos .http con REST Client
- `FUNCIONALIDADES.md`: sección "Desarrollo" (migraciones, variables) movida a INSTALL_AND_RUN.md
- `QUICK_FIXES.md`: sección "Contacto" reemplazada por enlaces a docs relevantes

---

## [2.0-beta06] - 2026-04-21

### Agregado
#### Tests de integración HL7 (backend)
- **`tests/test_integration_hl7_flow.py`**: 14 tests de integración async para el flujo completo del `OutboxProcessor` → HL7 → TrakCare central. Cubre: flujo A28→A01 exitoso para paciente nuevo (OFFP/OFFE), fallos HTTP de A28/A01 con incremento de `retry_count`, agotamiento de reintentos (`status=failed`), A08 enviado/omitido según estado de sincronización del episodio, clase de paciente `E` para Urgencia, flujo ORU^R01 con `note.synced_flag=True`, ORU omitido para episodio no sincronizado.
- **`pytest.ini`**: Agregado `asyncio_mode = auto` para soporte de tests async sin decorador por test.
- **`docker-compose.yml`**: Montaje de `pytest.ini` en el servicio `test` para heredar configuración desde el host.

#### HTTP files para servidor TrakCare
- **`requests/TC/hl7_inbound.http`**: Requests directos al endpoint `/demo01/tcoffline/hl7inbound` con encadenamiento de respuestas (A28→A01→A08→A03→ORU) usando `{{a28.response.body.pid}}` y `{{a01.response.body.enctid}}`, más variantes standalone para cada tipo de mensaje.
- **`requests/TC/data_sync.http`**: Requests al endpoint `/demo01/tcoffline/getData` con filtros (sin filtro, por usuario, por departamento) y flujo completo de sincronización vía backend local (login → stats → trigger sync → verificar episodios).

### Métricas de tests
- **Backend**: 70 tests en total (56 existentes + 14 nuevos de integración HL7), todos pasando en Docker contra PostgreSQL `tcoffline_test`.
- **React Native**: 116 tests de validación RUT, todos pasando.

---

## [2.0-beta05] - 2026-04-14

### Agregado
#### Resiliencia Offline (Frontend React Native)
- **Capa de caché offline** (`src/lib/offlineCache.ts`): Almacena episodios, detalles de episodio, notas clínicas, estadísticas de sincronización, tipos de episodio y ubicaciones en AsyncStorage. Los datos se guardan automáticamente en cada respuesta exitosa del servidor y se sirven desde caché cuando el backend no está disponible.
- **Cola de mutaciones** (`src/lib/mutationQueue.ts`): Las creaciones de episodios y notas clínicas se encolan en AsyncStorage cuando el backend está inaccesible, y se replayan automáticamente al reconectar.
- **Contexto de conectividad** (`src/contexts/ConnectivityContext.tsx`): Polling cada 10 segundos al endpoint `/health` del backend. Detecta transiciones offline→online y dispara el replay automático de la cola de mutaciones. Se reactiva al volver la app a primer plano.
- **Componente OfflineBanner** (`src/components/OfflineBanner.tsx`): Indicador visual que aparece cuando el backend es inaccesible, mostrando estado de conexión y cantidad de cambios pendientes.
- **Traducciones offline** en `lang_es.ts` y `lang_en.ts`: Mensajes para banner offline, cambios pendientes, notas/episodios encolados, datos en caché.

### Modificado
#### API y Navegación
- **`src/lib/api.ts`**: Los métodos de lectura (`getEpisodes`, `getEpisode`, `getClinicalNotes`, `getSyncStats`, `getUniqueLocations`, `getUniqueEpisodeTypes`) ahora cachean respuestas exitosas y sirven datos desde caché ante errores de red.
- **`App.tsx`**: Si el backend está caído pero el usuario estaba autenticado previamente, navega a la pantalla de episodios en modo offline en lugar de bloquear con la pantalla de descubrimiento de servidor. Se agrega `ConnectivityProvider` al árbol de componentes.
- **`EpisodesScreen.tsx`**: Muestra `OfflineBanner` cuando el backend no está disponible.
- **`ClinicalNoteScreen.tsx`**: Muestra `OfflineBanner`; la creación de notas se encola cuando está offline y se muestra mensaje de confirmación.
- **`NewEpisodeScreen.tsx`**: Muestra `OfflineBanner`; la creación de episodios se encola cuando está offline y redirige a la lista de episodios.

---

## [2.0-beta04] - 2026-04-13

### Agregado
#### Suite de Testing
- **Backend — 56 tests, todos pasando.** Corren dentro del contenedor Docker contra PostgreSQL real (`tcoffline_test`). El servicio `test` en `docker-compose.yml` anula el entrypoint para saltar migraciones y uvicorn, y monta `tests/` y `app/` como volúmenes para iteración rápida sin rebuild. Comando: `docker compose --profile test run --rm test`
  - `tests/conftest.py`: Crea automáticamente la base de datos `tcoffline_test`, gestiona tablas y limpieza por test
  - `tests/test_auth.py`: Login JWT, refresh token, `/auth/me`, gestión de usuarios por admin (16 tests)
  - `tests/test_episodes.py`: CRUD completo, unicidad de `num_episodio`, tipos/ubicaciones únicos, creación de outbox events (13 tests)
  - `tests/test_notes.py`: CRUD de notas clínicas con autor, casos 404 (8 tests)
  - `tests/test_general.py`: `/health`, `/discovery`, `/sync/status`, settings de sistema, control de acceso admin (11 tests)
  - `tests/test_sync.py`: Estado de conexión, estadísticas, trigger de sync, retry de eventos fallidos (8 tests)
- **React Native — Jest + jest-expo.** Tests unitarios para librerías puras en `frontend_ReactNativ/src/lib/__tests__/`: validación RUT chileno, formateo de tiempo relativo, manejo de credenciales (SecureStore), configuración de servidor. Comando: `npm test` desde `frontend_ReactNativ/`
- `pytest.ini`: Configuración mínima de pytest apuntando a `tests/`
- `requests/auth.http`, `episodes.http`, `general.http`, `notes.http`, `sync.http`, `variables.http`: Colección de requests HTTP para pruebas manuales con la extensión REST Client de VS Code

---

## [2.0-beta03] - 2026-04-08

### Modificado
#### UI y Cambios de Idioma (React Native)
- Iconos de pantallas actualizados
- `LoginScreen`: ajustes visuales y de texto
- `Header`: cambios de presentación
- `ServerDiscoveryScreen`: mejoras de UI

---

## [2.0-beta03] - 2026-04-08

### Agregado
#### Conectividad con Servidor (React Native)
- `ServerDiscoveryScreen`: pantalla dedicada para descubrir el servidor por mDNS
- `.env.example`: archivo de ejemplo de configuración de entorno
- Mejoras en el servicio mDNS del backend para compatibilidad con React Native

---

## [2.0-beta03] - 2026-04-07

### Agregado
#### Implementación Inicial React Native
- Proyecto Expo SDK 54 en `frontend_ReactNativ/`
- Pantallas: `LoginScreen`, `EpisodesScreen`, `NewEpisodeScreen`, `ClinicalNoteScreen`, `ServerDiscoveryScreen`
- Librerías: `api.ts`, `auth.ts`, `serverConfig.ts`, `rutValidation.ts`
- Componentes y contextos base de la aplicación móvil

---

## [2.0-beta02] - 2026-04-01

### Agregado
#### Autenticación JWT y Conectividad Multi-Cliente
- `app/mdns_service.py`: anuncio del servidor vía mDNS/Zeroconf para descubrimiento automático en LAN
- Endpoint `/discovery`: expone información del servidor para clientes que lo descubren por mDNS
- Migración de autenticación HTTP Basic → Bearer Token (JWT)
- Soporte para múltiples clientes simultáneos con tokens independientes

---

## [2.0-beta01] - 2026-03-31

### Agregado
#### Containerización del Backend
- `Dockerfile`: imagen multi-stage Python 3.12 slim
- `docker-compose.yml`: orquestación de backend + PostgreSQL 15-alpine
- `entrypoint.sh`: ejecuta migraciones Alembic antes de iniciar uvicorn

#### Migración a PostgreSQL
- 11 migraciones Alembic (`alembic/versions/001` a `011`): esquema completo incluyendo JSONB
- Reemplazo de SQLite + aiosqlite por PostgreSQL 15 + psycopg2 con connection pooling
- `migrate_sqlite_to_pg.py`: script one-time para migrar datos existentes

---

## [1.9.0-rc07] - 2026-03-23

### Corregido
#### Instalador Backend Windows
- **Detección de Python mejorada**:
  - Evita el redirect de Windows Store en `C:\Windows\System32\python`
  - Filtra rutas de WindowsApps que no funcionan
  - Busca en ubicaciones comunes: `C:\Python3XX`, `%LOCALAPPDATA%`, etc.
  - Verifica que Python funcione correctamente antes de continuar
  - Mensaje claro recomendando NO usar Python de Microsoft Store

#### Aplicación Electron
- **Pantalla en blanco corregida**:
  - Configurado `base: './'` en `vite.config.ts` para rutas relativas
  - Agregado Content Security Policy adecuado en `index.html`
  - Mejorada configuración de `electron/main.cjs` con logging detallado
  - Agregados event handlers para errores de carga

- **Build mejorado**:
  - Script `build-electron.bat` corregido: limpieza automática de node_modules corrupto
  - Instalación limpia de dependencias con `--legacy-peer-deps`
  - Configuración de CSS minifier para reducir warnings
  - Notas de troubleshooting incluidas en output del build
  - Agregados campos `description` y `author` a package.json (requeridos por electron-builder)
  - Agregada dependencia `cross-env` para compatibilidad cross-platform

- **Ventana negra corregida**:
  - CSP movido del HTML a Electron (session.defaultSession.webRequest.onHeadersReceived)
  - webSecurity configurado en false para permitir carga desde file://
  - Eliminado CSP del index.html que bloqueaba la ejecución de scripts en producción
  - Versión actualizada a 1.9.0-rc07 en diálogo "Acerca de"
  - **NUEVO**: Componente BackendCheck que muestra mensaje útil cuando el backend no está disponible
  - **NUEVO**: Instrucciones claras en pantalla sobre cómo iniciar el backend
  - **NUEVO**: DevTools se abre automáticamente en producción para facilitar debugging
  - **NUEVO**: Botones para reintentar conexión y verificar backend

- **PatientHistorySidebar crash corregido**:
  - Función `truncateText` ahora maneja valores undefined/null correctamente
  - Campo `Responsable` protegido con fallback 'N/A'
  - Tipos TypeScript actualizados: `RegistroOffline.Responsable` y `Nota` ahora son opcionales
  - Evita crash cuando registros offline tienen campos vacíos

- **Script de reparación**:
  - Nuevo `fix-dependencies.bat` para reparar node_modules corrupto
  - Limpieza de cache de npm
  - Reinstalación limpia de todas las dependencias

### Documentación
- **ELECTRON_TROUBLESHOOTING.md**: Nueva guía completa de solución de problemas
  - Diagnóstico de pantalla en blanco
  - Verificación de conexión con backend
  - Uso de DevTools para debugging

- **INICIO_RAPIDO_ELECTRON.md**: Guía de inicio rápido para usuarios finales
  - Instrucciones paso a paso para iniciar backend y frontend
  - Solución a problemas comunes
  - Flujo de trabajo diario recomendado

- **SOLUCION_PANTALLA_NEGRA.md**: Documentación específica del problema más común
  - Causa raíz explicada
  - Múltiples opciones de solución
  - Script automático de inicio

- **iniciar-trakcare-electron.bat**: Script automatizado para inicio
  - Verifica si el backend está corriendo
  - Inicia el backend automáticamente si es necesario
  - Lanza la aplicación Electron
  - Mantiene el backend en segundo plano

- **README.md** y **README_ELECTRON.md**: Actualizados con énfasis en iniciar el backend primero
  - Rebuild completo paso a paso
  - Logs y diagnóstico detallado
  - Solución para node_modules corrupto

- **README_ELECTRON.md actualizado**:
  - Sección mejorada de solución de problemas
  - Explicación del warning CSS (puede ignorarse)
  - Referencia a guía de troubleshooting
  - Puerto actualizado a 3000 en modo desarrollo

### Archivos Nuevos
- `frontend/fix-dependencies.bat`: Reparar dependencias corruptas automáticamente
- `QUICK_FIXES.md`: Guía rápida de soluciones a problemas comunes

### Archivos Modificados
- `install-backend-service.bat`: Detección de Python mejorada
- `frontend/vite.config.ts`: Base path y build config
- `frontend/electron/main.cjs`: CSP configurado en session.defaultSession, webSecurity=false, versión actualizada
- `frontend/index.html`: CSP eliminado (ahora manejado por Electron)
- `frontend/build-electron.bat`: Limpieza automática de node_modules + fix comando install
- `frontend/.env.production`: Creado con configuración por defecto
- `frontend/package.json`: Version 1.9.0-rc07, cross-env, description y author agregados
- `frontend/src/components/PatientHistorySidebar.tsx`: Manejo defensivo de campos undefined/null
- `frontend/src/types/index.ts`: RegistroOffline.Responsable y Nota ahora opcionales
- `README.md`: Versión actualizada, instrucciones de fix-dependencies agregadas
- `CHANGELOG.md`: Documentados todos los fixes de la versión 1.9.0-rc07
- `QUICK_FIXES.md`: Agregada solución para ventana negra
- `ELECTRON_TROUBLESHOOTING.md`: Agregada sección sobre ventana negra y CSP

## [1.9.0-rc06] - 2026-03-23

### Nuevo
#### RUN Opcional - Pacientes Sin Documento
- **Checkbox "Sin Documento"**: Agregado en formulario de nuevo episodio
  - Permite crear episodios sin RUN del paciente
  - Deshabilita automáticamente el campo RUN cuando está marcado
  - Omite validación M11 del dígito verificador
  - Genera MRN temporal usando timestamp en lugar del RUN
- **Backend**: Campo RUN ahora es completamente opcional en la base de datos
- **Migración 010**: Documentada la opcionalidad del campo RUN
- **Traducciones**: Agregadas en español e inglés
- **Archivos modificados**:
  - `frontend/src/pages/NewEpisode.tsx`: Implementada lógica del checkbox
  - `frontend/src/config/lang_es.ts`: Traducción "Sin Documento"
  - `frontend/src/config/lang_en.ts`: Traducción "No Document"
  - `alembic/versions/010_make_run_optional.py`: Nueva migración

#### Instaladores de Producción
- **Backend como Servicio Windows**:
  - Script PowerShell `install-backend-service.ps1` para instalación automática
  - Instalación del backend como servicio de Windows usando NSSM
  - Inicio automático con el sistema
  - Gestión de logs automática
  - Script de desinstalación `uninstall-backend-service.ps1`

- **Frontend como Aplicación Electron**:
  - Configuración completa de Electron para aplicación de escritorio
  - Generación de instalador NSIS para Windows
  - Scripts de compilación automatizados (`build-electron.bat` y `build-electron.sh`)
  - Soporte para icono personalizado
  - Menús nativos de Windows
  - Accesos directos en escritorio y menú inicio

### Documentación
- **INSTALLATION_GUIDE.md**: Guía completa de instalación para usuarios finales
  - Instalación del backend como servicio
  - Instalación del frontend como aplicación Electron
  - Configuración paso a paso
  - Solución de problemas
  - Comandos útiles de gestión del servicio
- **frontend/README_ELECTRON.md**: Documentación técnica de Electron
  - Guía de desarrollo con Electron
  - Scripts de compilación
  - Personalización del instalador
  - Depuración y solución de problemas
- **frontend/create-icon.html**: Utilidad para generar icono placeholder

### Scripts Nuevos
- `install-backend-service.bat`: Instalador automático del servicio Windows (.BAT)
- `uninstall-backend-service.bat`: Desinstalador del servicio Windows (.BAT)
- `install-backend-service.ps1`: Instalador automático del servicio Windows (PowerShell)
- `uninstall-backend-service.ps1`: Desinstalador del servicio Windows (PowerShell)
- `frontend/build-electron.bat`: Script de compilación para Windows
- `frontend/build-electron.sh`: Script de compilación para Linux/Mac
- `frontend/electron/main.cjs`: Proceso principal de Electron
- `frontend/electron/preload.cjs`: Script preload de seguridad

### Mejorado
- **README.md**: Actualizado con referencia a guía de instalación
- **package.json**: Configurado electron-builder para generación de instaladores

### TO-DO
- Version Responsiva
- Version con DB central en server local - Mysql? Posgress?

## [1.9.0-rc05] - 2026-03-19
### Mejorado

#### Constructor de Mensajes HL7

- **Formato de Nombres en Segmento PID**:
  - El método `build_pid_segment` ahora maneja correctamente nombres en formato "Apellido, Nombre"
  - Convierte automáticamente el formato a "Apellido^Nombre" requerido por HL7
  - Utiliza procesamiento con `split` y `strip` para limpiar espacios adicionales
  - Línea 154: Implementada conversión dinámica de formato de nombres

- **Timestamp Duplicado en Segmento OBR**:
  - El método `build_obr_segment` ahora incluye el timestamp tanto en el campo 7 como en el campo 8
  - Mejora la compatibilidad con sistemas HL7 que requieren ambos campos poblados
  - Línea 235: Agregado segundo campo de timestamp en el segmento OBR

### Modificado

#### Archivos Afectados
- `app/hl7_builder.py:152-155`: Actualizado formato de nombres en PID
- `app/hl7_builder.py:235`: Agregado timestamp duplicado en OBR

### Notas Técnicas

#### Compatibilidad de Nombres
El sistema ahora acepta nombres en dos formatos:
- Formato estándar: Se pasan `last_name` y `first_name` por separado
- Formato combinado: Si el nombre viene como "Apellido, Nombre", se convierte automáticamente a "Apellido^Nombre"

Esto mejora la interoperabilidad con sistemas que envían nombres en diferentes formatos.

#### Estructura OBR Mejorada
El segmento OBR ahora sigue más fielmente el estándar HL7 v2.5.1:
```
OBR|{set_id}||{test_code}^{test_name}^LOCAL|||{timestamp}|{timestamp}
```

Donde ambos campos de timestamp (posiciones 7 y 8) contienen el mismo valor para máxima compatibilidad.

---

## [1.8.0-rc02] - 2026-03-18

### Mejorado

#### Carga Dinámica de Tipos de Episodio
- El dropdown "Tipo de Episodio" ahora carga los tipos dinámicamente desde la base de datos
- Ya no depende de valores hardcodeados en el código
- Muestra únicamente los tipos que existen en episodios sincronizados desde el sistema central
- El dropdown se deshabilita si no hay tipos disponibles
- Nuevo endpoint: `GET /episodes/types/unique` retorna tipos únicos de episodios

#### Inclusión de Unidad Clínica en Mensajes HL7 A01
- El campo "Unidad Clínica" (ubicacion) ahora se incluye correctamente en los mensajes HL7 ADT^A01
- El segmento PV1.3 ahora tiene formato: `unidad_clinica^habitacion` cuando ambos campos están presentes
- Separación clara entre:
  - **Habitación/Box** (campo `habitacion`): ubicación física como "Box 3" o "Habitación 201"
  - **Unidad Clínica** (campo `ubicacion`): servicio o unidad como "Urgencias", "UCI", etc.
- Los mensajes ORU^R01 también incluyen esta información

### Modificado

#### Eliminación de Datos de Prueba Automáticos
- Eliminado el script `simple_load_patients.py` que cargaba pacientes de prueba
- Eliminado el script `load_test_patients.py`
- Eliminado el script `init_demo_users.py`
- El sistema ahora inicia sin datos de prueba
- Los episodios solo provienen de la sincronización con el sistema central mediante `obtenerDatos`

#### Limpieza de Archivos de Diagnóstico
- Eliminados archivos de diagnóstico y prueba del dropdown:
  - `test_dropdown_real.py`
  - `test_locations_endpoint.py`
  - `test_locations_live.py`
  - `test_locations_query.py`
  - `test_tipo_ubicacion.py`
  - `test_ubicaciones_real.py`
  - `DIAGNOSTICO_DROPDOWN_UBICACIONES.md`
  - `INSTRUCCIONES_DEBUG_DROPDOWN.md`
  - `COMBOBOX_FIX_SUMMARY.md`
  - `test_combobox.md`
  - `verify_combobox_fix.sh`
  - `EJEMPLO_PAYLOAD_OBTENERDATOS.json`
- Eliminados scripts de utilidad obsoletos:
  - `check_database.py`
  - `check_locations.py`
  - `check_schema.py`
  - `fix_ubicaciones.py`
  - `update_locations.py`
  - `verify_db_schema.py`
  - `test_api_locations.sh`

### Archivos Modificados

#### Backend
- `app/routers/episodes.py`:
  - Agregado endpoint `GET /episodes/types/unique` para obtener tipos únicos de episodios
  - Simplificado endpoint `GET /episodes/locations/unique` eliminando logs de depuración
- `app/hl7_builder.py`:
  - Modificado método `build_pv1_segment()` para aceptar parámetro `clinical_unit`
  - El campo PV1.3 ahora combina unidad clínica y habitación: `clinical_unit^room`
  - Actualizado `build_a01_message()` para incluir parámetro `clinical_unit`
  - Actualizado `build_oru_message()` para incluir parámetro `clinical_unit`
- `app/outbox_processor.py`:
  - Actualizado para enviar `habitacion` y `ubicacion` por separado en mensajes A01 y ORU
  - Ahora pasa `location=episode.habitacion` y `clinical_unit=episode.ubicacion`

#### Frontend
- `frontend/src/pages/NewEpisode.tsx`:
  - Eliminada dependencia de `EPISODE_TYPE_LABELS` hardcodeado
  - Agregado estado `availableEpisodeTypes` que se carga dinámicamente
  - Nuevo `useEffect` para cargar tipos de episodio al montar el componente
  - El dropdown de tipos se deshabilita si no hay tipos disponibles
- `frontend/src/lib/api.ts`:
  - Agregada función `getUniqueEpisodeTypes()` para obtener tipos desde el backend

### Flujo de Datos Actualizado

1. **Sincronización desde Sistema Central**:
   - El endpoint `obtenerDatos` trae episodios del sistema central
   - Los episodios se almacenan en la base de datos local con todos sus campos
   - Los campos `tipo` y `ubicacion` se extraen del JSON recibido

2. **Creación de Nuevo Episodio**:
   - El usuario selecciona un "Tipo de Episodio" desde los tipos existentes en la BD
   - El usuario selecciona una "Unidad Clínica" desde las ubicaciones existentes para ese tipo
   - El usuario opcionalmente ingresa "Habitación/Box"
   - Al crear el episodio, se generan mensajes HL7 A28 + A01

3. **Mensaje HL7 A01**:
   - PID.3: MRN del paciente
   - PV1.2: Clase de paciente (E=Emergencia, I=Internado, O=Ambulatorio)
   - **PV1.3**: `ubicacion^habitacion` (ejemplo: "Urgencias^Box 3")
   - PV1.19: Número de episodio
   - PV2.3: Motivo de consulta

### Notas Técnicas

#### Compatibilidad con Versiones Anteriores
- Los episodios antiguos que solo tienen `habitacion` o `ubicacion` siguen funcionando correctamente
- El sistema maneja inteligentemente la combinación de ambos campos en el formato HL7

#### Validación de Datos
- El sistema filtra automáticamente valores vacíos o nulos de los dropdowns
- Las ubicaciones se obtienen únicamente del campo `Ubicacion` del JSON de `obtenerDatos`
- Los tipos de episodio se obtienen del campo `Tipo` de episodios existentes

---

## [1.8.0-rc01] - 2026-03-17

### Mejorado

#### Campo Unidad Clínica en Nuevo Episodio
- **Cambio**: El campo "Unidad Clínica" ahora es un selector estricto con búsqueda (combobox)
- **Comportamiento**:
  - Solo permite seleccionar ubicaciones existentes obtenidas del campo `Ubicacion` del JSON sincronizado desde `obtenerDatos`
  - Las ubicaciones se filtran automáticamente según el tipo de episodio seleccionado (Urgencia, Hospitalizado, Ambulatorio)
  - Incluye búsqueda/filtrado en tiempo real mientras escribes
  - No permite ingresar valores nuevos manualmente
  - El campo se deshabilita automáticamente cuando no hay ubicaciones disponibles para el tipo de episodio seleccionado
  - El valor seleccionado se limpia automáticamente al cambiar el tipo de episodio
  - Muestra mensajes informativos multiidioma según el contexto:
    - Sin datos: "No hay ubicaciones disponibles para este tipo de episodio"
    - Sin sincronización: "No hay ubicaciones disponibles. Sincronice datos del sistema central."
    - Sin resultados de búsqueda: "No se encontraron ubicaciones"
- **Fuente de datos**: Las ubicaciones provienen del campo `Ubicacion` del JSON que se obtiene al sincronizar desde el endpoint `obtenerDatos` del sistema central
- **Endpoint backend**: `GET /episodes/locations/unique?tipo={tipo_episodio}` retorna ubicaciones únicas filtradas por tipo
- **Archivos modificados**:
  - `app/routers/episodes.py:194-207`: Mejorado filtro para excluir ubicaciones vacías
  - `frontend/src/pages/NewEpisode.tsx:31-86`: Implementado combobox con búsqueda, limpieza automática del valor al cambiar tipo, logs de depuración, y corrección para permitir apertura del dropdown al hacer clic
  - `frontend/src/config/lang_es.ts`: Agregados mensajes traducidos al español
  - `frontend/src/config/lang_en.ts`: Agregados mensajes traducidos al inglés
  - `simple_load_patients.py:80-112`: Actualizadas ubicaciones de prueba para coincidir con formato del JSON de ejemplo
  - `update_locations.py`: Script nuevo para actualizar ubicaciones de episodios existentes
  - `check_locations.py`: Script de verificación de ubicaciones en la base de datos
- **Cómo probar con datos de prueba**:
  1. Ejecutar `python3 update_locations.py` para actualizar ubicaciones existentes (ya ejecutado)
  2. Ir a "Nuevo Episodio"
  3. Seleccionar un tipo de episodio (Urgencia, Hospitalizado, Ambulatorio)
  4. Hacer clic en el campo "Unidad Clínica" para ver las ubicaciones disponibles
  5. Opcionalmente escribir para filtrar las ubicaciones
  6. Seleccionar una ubicación de la lista
  7. Cambiar el tipo de episodio y verificar que las ubicaciones se actualicen
- **Cómo probar con datos reales**:
  1. Sincronizar datos desde el sistema central usando el botón "Sincronizar ahora" en la página de episodios
  2. Seguir los pasos 2-7 anteriores

### Revertido

#### Overlay de Carga en Modo Read Only
- Revertidos cambios que agregaban un overlay de carga durante la verificación del modo read only
- Eliminado componente `LoadingOverlay.tsx`
- Removido estado `isCheckingReadOnly` del `UserContext`
- Restaurado comportamiento original del `ProtectedRoute` sin overlay

### Corregido

#### Combobox de Unidad Clínica no se desplegaba
- **Problema**: El combobox de "Unidad Clínica" no se abría al hacer clic y no permitía escribir para buscar ubicaciones
- **Causa**: Faltaba evento `onClick` en el input y el `handleFocusLocation` no validaba disponibilidad de datos
- **Solución**:
  - Agregado evento `onClick` al input para abrir el dropdown (`frontend/src/pages/NewEpisode.tsx:293`)
  - Modificado `handleSearchChange` para abrir el dropdown automáticamente al escribir (`línea 57`)
  - Agregada validación en `handleFocusLocation` para prevenir errores sin datos (`líneas 74-75`)
  - Agregada clase `cursor-pointer` al input para indicar que es clickeable
  - Scripts de prueba y verificación: `check_locations.py`, `test_combobox.md`

### Notas Técnicas

El sistema vuelve a su comportamiento anterior donde la verificación del modo read only no bloquea la interfaz con un overlay de carga.

El combobox de Unidad Clínica ahora responde correctamente a clicks y permite búsqueda de ubicaciones. Ver `test_combobox.md` para guía detallada de pruebas.

---

## [1.6.4] - 2026-03-16

### Corregido

#### Error en endpoint /auth/me
- **Problema**: Error 500 al intentar actualizar usuario debido a referencia a campo `enable_read_only_mode` eliminado
- **Solución**: Removida lógica obsoleta del endpoint PUT `/auth/me` en `app/routers/auth.py:30-31`

#### Reenvío de Mensajes ADT (A28/A01) - CRÍTICO
- **Problema**: Los mensajes A28/A01 se enviaban exitosamente pero NO se reenviaban cuando el servidor central no devolvía los IDs (`pid` y `enctid`)
- **Causa**: El outbox_processor marcaba los eventos como "sent" incluso cuando no se recibían los IDs del servidor central
- **Solución**:
  - Modificado `outbox_processor.py:301-333` para verificar si se recibieron IDs antes de marcar el evento como "sent"
  - Si los mensajes se envían pero NO se reciben IDs, el evento permanece como "pending" y se reintenta
  - Solo se marca como "sent" cuando se actualizan los campos MRN y num_episodio con IDs del central
  - Agregado `retry_failed_events()` en `background_tasks.py:39` para reintentar eventos automáticamente
  - Los episodios ahora se actualizan correctamente con los IDs del servidor central

#### Mensaje HL7 A28 Incompleto
- **Problema**: El mensaje A28 no incluía el segmento PV1 requerido
- **Solución**: Corregido `hl7_builder.py:304-307` para incluir el segmento PV1 en el mensaje A28

#### Condición de Carrera en Modo Read Only
- **Problema**: Al actualizar el listado de episodios, había un lapso de segundos donde el modo Read Only no estaba activo y se podía hacer clic en el botón
- **Solución**:
  - Modificado `UserContext.tsx` para verificar el estado Read Only cada 8 segundos de forma continua
  - El estado se mantiene entre actualizaciones evitando el parpadeo

### Agregado

#### Configuración Global de Modo Read Only con Control de Administrador
- El modo Read Only ahora es un parámetro GLOBAL del sistema, no individual por usuario
- SOLO los usuarios administradores pueden habilitar/deshabilitar esta configuración
- Se almacena en la tabla `sync_state` con la clave `enable_read_only_mode`
- Cuando está habilitado, TODOS los usuarios tienen el modo Read Only activo cuando el central está en línea
- Cuando está deshabilitado, TODOS los usuarios pueden crear episodios y notas incluso con el central en línea
- Por defecto viene habilitado para mantener compatibilidad con el comportamiento anterior

#### Roles de Administrador
- Nuevo campo `is_admin` en la tabla `users` para identificar administradores del sistema
- Solo administradores pueden modificar configuración del sistema (modo Read Only)
- Script `init_demo_users.py` crea:
  - Usuario `admin` con `is_admin=True` (puede cambiar configuración del sistema)
  - Usuario `demo` con `is_admin=False` (usuario regular sin permisos administrativos)

#### Backend
- **Modelos** (`app/models.py`):
  - Removido campo `enable_read_only_mode` del modelo `User`
  - Agregado campo `is_admin` (Boolean, default=False) al modelo `User`
  - Uso de tabla `sync_state` para almacenar configuración global
- **Schemas** (`app/schemas.py`):
  - Removido `enable_read_only_mode` de `UserUpdate` y `User`
  - Agregado campo `is_admin` a schema `User`
  - Agregado schema `SystemSettings` con campo `enable_read_only_mode`
- **Auth Utils** (`app/auth_utils.py`):
  - Nueva función `get_current_admin_user()` que verifica permisos de administrador
- **Routers** (`app/routers/general.py`):
  - Nuevo endpoint GET `/settings` para obtener configuración del sistema (todos los usuarios)
  - Nuevo endpoint PUT `/settings` para actualizar configuración del sistema (solo administradores)

#### Frontend
- **Tipos TypeScript** (`frontend/src/types/index.ts`):
  - Removido campo `enable_read_only_mode` de interfaces User y UserUpdateRequest
  - Agregado campo `is_admin` a interface User
  - Agregado interface `SystemSettings`
- **API** (`frontend/src/lib/api.ts`):
  - Agregado `getSystemSettings()` para obtener configuración del sistema
  - Agregado `updateSystemSettings()` para actualizar configuración del sistema
- **UserContext** (`frontend/src/contexts/UserContext.tsx`):
  - Modificado `checkReadOnlyMode()` para consultar la configuración global del sistema
  - Respeta la configuración global en lugar de la individual por usuario
- **UserSettingsModal** (`frontend/src/components/UserSettingsModal.tsx`):
  - Sección "Configuración del Sistema" visible SOLO para administradores (`user.is_admin`)
  - Agregada descripción clara indicando que afecta a TODOS los usuarios
  - Resaltado visual con fondo ámbar para indicar que es configuración global
  - Usuarios regulares no ven ni pueden modificar esta configuración

#### Base de Datos
- **Migración 007** (`alembic/versions/007_move_read_only_to_global_setting.py`):
  - Remueve columna `enable_read_only_mode` de tabla `users`
  - Agrega entrada en tabla `sync_state` con clave `enable_read_only_mode` y valor por defecto `true`
- **Migración 008** (`alembic/versions/008_add_is_admin_field.py`):
  - Agrega columna `is_admin` (Boolean, default=False) a tabla `users`

### Modificado

#### Reintentos Automáticos
- **Background Tasks** (`app/background_tasks.py:39`):
  - Agregado `retry_failed_events()` al proceso de upstream sync
  - Los eventos fallidos ahora se reintentan automáticamente en cada ciclo

#### Corrección de IDs de Migración
- Normalizados todos los IDs de revisión de Alembic para usar formato corto ('001', '002', etc.)
- Corregidas referencias entre migraciones para mantener la cadena correcta

### Notas Técnicas

#### Flujo de Sincronización Mejorado
1. Se crea un episodio que genera mensajes ADT^A28 + ADT^A01
2. Los mensajes se envían al servidor central
3. El sistema espera recibir IDs (`pid`, `enctid`) en la respuesta
4. Si NO se reciben IDs:
   - El evento permanece como "pending"
   - Se reintenta en el siguiente ciclo de upstream sync (cada 3 minutos)
   - Máximo 5 intentos antes de marcar como "failed"
5. Cuando el servidor responde con IDs (`pid`, `enctid`):
   - El episodio se actualiza con los IDs reales (MRN y num_episodio)
   - El evento se marca como "sent"
   - El episodio se marca como sincronizado

#### Modo Read Only Global
- Es un parámetro del SISTEMA, no del usuario individual
- Afecta a TODOS los usuarios por igual
- Se configura desde la interfaz de configuración de usuario
- El estado se verifica cada 8 segundos para mantener consistencia
- Útil para deshabilitar el modo cuando se necesita trabajar offline incluso con conexión central disponible

## [1.6.3] - 2026-03-06

### Corregido

#### Ordenamiento de Episodios en el Backend
- **Bug crítico**: El endpoint de listado de episodios no tenía ordenamiento, devolviendo resultados en orden aleatorio
- **Causa**: La consulta SQL en `GET /episodes` no incluía cláusula `ORDER BY`
- **Solución**: Agregado `.order_by(models.Episode.fecha_atencion.desc())` para mostrar episodios más recientes primero
- **Archivo modificado**: `app/routers/episodes.py:88`

### Agregado

#### Script de Carga Simple de Pacientes
- Nuevo script `simple_load_patients.py` para cargar datos de prueba sin dependencias del stack completo
- Inserta 10 pacientes de prueba directamente en SQLite
- No requiere backend corriendo ni migraciones aplicadas previamente

#### Script de Aplicación de Migraciones
- Nuevo script `apply_migrations.py` para aplicar migraciones faltantes a bases de datos existentes
- Aplica migraciones 004 (filtros, nombre en users) y 005 (motivo_consulta, nombre en episodes)
- Maneja columnas existentes sin error

#### Configuración de Frontend
- Agregado archivo `frontend/.env` con `VITE_API_BASE_URL=http://localhost:8000`
- Permite que el frontend se conecte al backend local

## [1.6.2] - 2026-03-06

### Corregido

#### Problema de Episodios No Visibles en el Listado
- **Bug crítico**: Los episodios nuevos no aparecían en el listado después de crearlos
- **Causa**: El endpoint de listado de episodios estaba usando `episode.__dict__.copy()` que incluía atributos internos de SQLAlchemy y podía omitir campos necesarios
- **Solución**:
  - Modificado `app/routers/episodes.py` para devolver explícitamente todos los campos del modelo Episode
  - Tanto el endpoint `GET /episodes` (listado) como `POST /episodes` (creación) ahora construyen dictionaries con todos los campos requeridos
  - Se asegura que los campos indexados (`paciente`, `tipo`, `fecha_atencion`, etc.) estén siempre presentes en la respuesta

#### Intervalo de Actualización Inconsistente
- **Bug**: El listado de episodios se actualizaba cada 5 segundos en lugar de cada 15 segundos
- **Causa**: El intervalo de sincronización de estadísticas (`loadSyncStats`) estaba hardcodeado a 5000ms
- **Solución**: Modificado `frontend/src/pages/Episodes.tsx` para usar `EPISODES_REFRESH_INTERVAL` (15000ms) en ambos intervalos

#### Indicador de Tiempo "Justo Ahora" Siempre Visible
- **Bug crítico**: El indicador de última sincronización siempre mostraba "Justo ahora" en lugar del tiempo real transcurrido
- **Causa**: La función `formatTimeAgo` no manejaba correctamente las fechas ISO en formato UTC (sin sufijo 'Z')
- **Solución**:
  - Modificado `frontend/src/lib/timeAgo.ts` para parsear correctamente strings ISO con y sin sufijo 'Z'
  - Agregada validación de fechas inválidas
  - Agregado manejo de diferencias de tiempo negativas (desfase de reloj)


### Modificado

#### .gitignore
- Agregados patrones de archivos Python y de build:
  - `__pycache__`, `*.pyc`, `*.pyo`, `*.pyd`
  - `local.db` (base de datos local)
  - `venv/` (entorno virtual Python)
  - `dist/`, `build/`, `*.egg-info/`
  - `.DS_Store` (archivos de macOS)

### Documentación
- Actualizado README.md con versión correcta (1.6.1)
- Mejorado .gitignore para excluir archivos temporales y de build

---

## [1.6.1] - 2026-03-05

### Agregado

#### Sistema de Internacionalización (i18n)
- Implementado sistema completo de internacionalización para el frontend
- Soporte para español (ES) e inglés (EN)
- **Contexto de Idioma** (`frontend/src/contexts/LanguageContext.tsx`):
  - Nuevo contexto `LanguageProvider` que gestiona el idioma activo en toda la aplicación
  - Hook `useLanguage()` para acceder al idioma y traducciones desde cualquier componente
  - El idioma seleccionado se persiste en `localStorage`
  - Detección automática del idioma del navegador al iniciar por primera vez
  - Cambio de idioma sin necesidad de recargar la página

- **Archivos de Traducción Completos**:
  - `lang_es.ts`: Todas las traducciones en español
  - `lang_en.ts`: Todas las traducciones en inglés
  - Incluye traducciones para:
    - Sistema de modo solo lectura
    - Mensajes comunes (guardar, cancelar, error, éxito)
    - Header (cerrar sesión, configuración, tema, idioma)
    - Login (usuario, contraseña, botones, errores)
    - Episodios (título, botones, estados, tipos)
    - Notas clínicas (campos, botones, placeholders)
    - Historial del paciente
    - Configuración de usuario

- **Selector de Idioma en Header**:
  - Botón con el idioma actual (ES/EN)
  - Menú desplegable para cambiar entre idiomas
  - Cambio instantáneo sin recarga de página
  - Indicación visual del idioma activo

#### Modo Solo Lectura
- El sistema ahora detecta automáticamente si hay conexión con el servidor central al iniciar sesión
- Cuando existe conexión central, el sistema opera en "Modo Solo Lectura":
  - Se muestra una alerta al usuario al momento del login
  - Se deshabilita el botón "Nuevo Episodio" en la vista de episodios
  - Se deshabilita el formulario de "Nueva Nota Clínica"
  - Se muestra un mensaje informativo en color ámbar explicando el modo solo lectura
- El propósito es prevenir duplicación de datos cuando el servidor central está disponible

### Modificado

#### Sistema de Internacionalización
- **Main** (`frontend/src/main.tsx`):
  - Integrado `LanguageProvider` en la jerarquía de contextos
  - El provider envuelve toda la aplicación para proveer acceso global a las traducciones

- **Header** (`frontend/src/components/Header.tsx`):
  - Migrado de sistema i18n antiguo al nuevo `LanguageContext`
  - Implementado cambio de idioma sin recarga de página
  - Selector de idioma integrado con el nuevo contexto

- **Login** (`frontend/src/pages/Login.tsx`):
  - Todos los textos ahora usan el sistema de traducciones
  - Título, campos, botones y mensajes de error traducidos
  - Alerta de modo solo lectura traducida

- **Episodes** (`frontend/src/pages/Episodes.tsx`):
  - Título de la página traducido
  - Botón "Nuevo Episodio" traducido
  - Banner de modo solo lectura traducido

- **ClinicalNote** (`frontend/src/pages/ClinicalNote.tsx`):
  - Banner de modo solo lectura traducido
  - Placeholders del textarea traducidos
  - Botones "Guardar Nota" y "Volver a Episodios" traducidos

#### Frontend
- **UserContext** (`frontend/src/contexts/UserContext.tsx`):
  - Agregado estado `isReadOnlyMode` que se actualiza automáticamente
  - Nueva función `checkReadOnlyMode()` que verifica el estado del servidor central
  - El contexto ahora expone `isReadOnlyMode` para que otros componentes lo utilicen

- **Login** (`frontend/src/pages/Login.tsx`):
  - Al iniciar sesión, verifica conexión con servidor central
  - Muestra alerta informativa si se detecta modo solo lectura
  - La alerta explica claramente las restricciones del modo

- **Episodes** (`frontend/src/pages/Episodes.tsx`):
  - Botón "Nuevo Episodio" se deshabilita cuando `isReadOnlyMode` está activo
  - Se muestra banner informativo en color ámbar explicando el modo solo lectura
  - El banner incluye ícono de advertencia y mensaje descriptivo

- **ClinicalNote** (`frontend/src/pages/ClinicalNote.tsx`):
  - Campo de texto para nueva nota se deshabilita cuando `isReadOnlyMode` está activo
  - Botón "Guardar Nota" se deshabilita cuando `isReadOnlyMode` está activo
  - Se muestra banner informativo en color ámbar explicando la restricción
  - El placeholder del textarea cambia para indicar que no está disponible

### Notas Técnicas

#### Flujo de Detección de Modo Solo Lectura
1. Usuario inicia sesión con credenciales válidas
2. Sistema verifica conexión con servidor central mediante `api.getCentralHealth()`
3. Si `status === 'online'`, se activa el modo solo lectura
4. Se muestra alerta al usuario explicando las restricciones
5. El contexto `UserContext` mantiene el estado `isReadOnlyMode`
6. Los componentes consultan este estado para deshabilitar funcionalidades

#### Componentes Afectados - Modo Solo Lectura
- `UserContext`: Maneja el estado global del modo solo lectura
- `Login`: Muestra alerta inicial al detectar el modo
- `Episodes`: Deshabilita creación de nuevos episodios
- `ClinicalNote`: Deshabilita creación de nuevas notas clínicas

#### Componentes Afectados - Internacionalización
- `LanguageContext`: Nuevo contexto que gestiona el idioma global
- `Header`: Selector de idioma y textos traducidos
- `Login`: Todos los textos traducidos
- `Episodes`: Títulos, botones y alertas traducidas
- `ClinicalNote`: Formularios, botones y alertas traducidas
- `lang_es.ts`: Archivo completo de traducciones en español
- `lang_en.ts`: Archivo completo de traducciones en inglés

### Notas de Uso - Internacionalización

#### Cómo Funciona
1. El idioma se detecta automáticamente del navegador al primer uso
2. El usuario puede cambiar el idioma desde el selector en el header (botón ES/EN)
3. El cambio es instantáneo y se aplica a toda la interfaz
4. La preferencia se guarda en `localStorage` y persiste entre sesiones
5. Para agregar nuevas traducciones, editar `lang_es.ts` y `lang_en.ts`

#### Estructura de Traducciones
```typescript
// Ejemplo de uso en componentes
const { t, language } = useLanguage();

// Acceder a traducciones
t.login.title          // "Iniciar sesión" o "Login"
t.episodes.newEpisode  // "Nuevo Episodio" o "New Episode"
t.readOnlyMode.title   // "Modo Solo Lectura Activo" o "Read-Only Mode Active"

// Verificar idioma actual
language === 'es'  // true o false
```

---

## [1.6.0] - 2026-03-03

### Agregado

#### Actualización Automática de IDs de TrakCare
- El sistema ahora actualiza automáticamente los IDs del episodio cuando recibe respuestas ORU del servidor central
- La respuesta ORU tiene el formato: `{"estado":"<Resp HTTP>","pid":"<Numero TC>","enctid":"<Enc_ID>"}`
- Cuando se recibe esta respuesta:
  - `pid` (Patient ID) actualiza el campo `mrn` del episodio
  - `enctid` (Encounter ID) actualiza el campo `num_episodio` del episodio
- El sistema maneja correctamente respuestas nulas, vacías o con formatos distintos
- Solo actualiza si el valor recibido es diferente al actual para evitar operaciones innecesarias

### Modificado

#### Backend
- **Outbox Processor** (`app/outbox_processor.py:276-281`):
  - Los episodios ya NO se marcan como sincronizados al enviar ADT^A28 + ADT^A01
  - Permanecen con `synced_flag = False` hasta recibir confirmación con IDs de TrakCare
  - Esto mantiene el indicador "Nuevo" visible en el frontend hasta la sincronización completa

- **Outbox Processor** (`app/outbox_processor.py:296-321`):
  - Detecta automáticamente el formato de respuesta ORU
  - Actualiza el campo `mrn` con el `pid` recibido
  - Actualiza el campo `num_episodio` con el `enctid` recibido
  - SOLO marca el episodio como sincronizado (`synced_flag = True`) después de recibir IDs de TrakCare
  - Compara valores antes de actualizar para evitar cambios innecesarios
  - Logs detallados de transiciones de IDs (viejo -> nuevo)

#### Flujo de Sincronización Actualizado
1. Se crea un episodio que genera mensajes ADT^A28 + ADT^A01
2. Los mensajes se envían al servidor central
3. El episodio permanece como "Nuevo" (`synced_flag = False`)
4. Se crea una nota clínica que genera un mensaje ORU^R01
5. El mensaje ORU se envía al servidor central
6. El servidor responde con `{"estado":"200","pid":"123456","enctid":"E789"}`
7. El sistema actualiza automáticamente:
   - `episodes.mrn` = "123456"
   - `episodes.num_episodio` = "E789"
   - `episodes.synced_flag` = `True` (el indicador "Nuevo" desaparece)
8. Todas las notas clínicas asociadas quedan vinculadas al ID correcto de TrakCare

### Notas Técnicas

#### Manejo de Respuestas
El sistema maneja estos escenarios:
- Respuesta vacía o nula: No actualiza, continúa normalmente
- Respuesta sin campos `pid`/`enctid`: No actualiza, continúa normalmente
- Respuesta con formato diferente: No actualiza, continúa normalmente
- Respuesta válida: Actualiza campos `mrn` y `num_episodio`

#### Persistencia de Datos
- Los IDs se actualizan en la misma transacción que marca la nota como sincronizada
- No se crean nuevos campos en la base de datos
- Se reutilizan los campos existentes `mrn` y `num_episodio`
- Las relaciones entre episodios y notas clínicas se mantienen intactas

---

## [1.5.0] - 2026-03-01

### Corregido

#### Script de Carga de Pacientes Demo
- **Bug crítico**: Corregido error en `load_test_patients.py` donde la variable `tipo` (tipo de episodio) se sobrescribía en el bucle de generación de exámenes, causando que todos los pacientes quedaran con tipo "Electrolitos"
- **Sincronización**: Los pacientes demo ahora generan eventos en el outbox correctamente
  - Se crean eventos `OutboxEvent` con `event_type="episode_created"` para cada paciente insertado
  - Cada evento se procesa y sincroniza con el servidor central automáticamente
- **Logs mejorados**: El script ahora muestra información detallada durante la carga:
  - Lista cada paciente insertado con su tipo y número de episodio
  - Cuenta de eventos de sincronización creados
  - Detalles del proceso de sincronización con el servidor central

#### Cambios Técnicos
- **`load_test_patients.py:143`**: Renombrado `tipo` a `tipo_examen` en el bucle de generación de resultados
- **`load_test_patients.py:172`**: Renombrado `alergia` a `alergia_nombre` en el bucle de generación de alergias
- **`load_test_patients.py:263-292`**: Agregada creación de eventos `OutboxEvent` después de insertar cada episodio
- **`load_test_patients.py:15`**: Importado modelo `OutboxEvent` necesario para la sincronización

### Impacto
- Los pacientes demo ahora se generan con tipos de episodio correctos: "Urgencia", "Hospitalizado" o "Ambulatorio"
- La sincronización automática funciona inmediatamente después de la carga
- Logs completos permiten verificar que cada paciente se sincronizó correctamente

---

## [2.1.0] - 2026-03-01

### Agregado

#### Campo Motivo de Consulta
- Nuevo campo `motivo_consulta` en la tabla `episodes`
- Campo de texto área en el formulario "Nuevo Paciente + Episodio"
- El motivo de consulta se envía en los mensajes HL7:
  - Segmento PV2.3 en mensajes ADT^A01 (Admisión)
  - Segmento PV2.3 en mensajes ORU^R01 (Notas clínicas)

#### Campo Nombre de Usuario
- Nuevo campo `nombre` en la tabla `users` para almacenar el nombre completo del usuario
- Campo de texto en la configuración de usuario (modal de settings)
- Nuevo campo `author_nombre` en la tabla `clinical_notes` que captura el nombre del autor al momento de crear la nota
- El nombre del autor se muestra en las notas clínicas para mejor trazabilidad

### Modificado

#### Backend
- **Modelos** (`app/models.py`):
  - Agregado campo `motivo_consulta` a modelo `Episode`
  - Agregado campo `nombre` a modelo `User`
  - Agregado campo `author_nombre` a modelo `ClinicalNote`

- **Schemas** (`app/schemas.py`):
  - Actualizado `EpisodeBase`, `EpisodeCreate`, `EpisodeUpdate` con campo `motivo_consulta`
  - Actualizado `User` y `UserUpdate` con campo `nombre`
  - Actualizado `ClinicalNoteWithAuthor` con campo `author_nombre`

- **HL7 Builder** (`app/hl7_builder.py`):
  - Nuevo método `build_pv2_segment()` para generar segmento PV2
  - Actualizado `build_a01_message()` para incluir segmento PV2 con motivo de consulta
  - Actualizado `build_oru_message()` para incluir segmento PV2 con motivo de consulta

- **Outbox Processor** (`app/outbox_processor.py`):
  - Actualizado para pasar `motivo_consulta` a los métodos del HL7 builder

- **Routers**:
  - `app/routers/notes.py`: Captura y almacena `author_nombre` al crear notas clínicas
  - `app/routers/auth.py`: Permite actualizar el campo `nombre` del usuario

#### Frontend
- **Tipos TypeScript** (`frontend/src/types/index.ts`):
  - Agregado campo `motivo_consulta` a interfaces de Episode
  - Agregado campo `nombre` a interface User
  - Agregado campo `author_nombre` a interface ClinicalNote

- **Componentes**:
  - `NewEpisode.tsx`: Campo de texto área para motivo de consulta
  - `UserSettingsModal.tsx`: Campo de texto para nombre completo del usuario con descripción

#### Base de Datos
- **Migración 005** (`alembic/versions/005_add_motivo_consulta_and_nombre.py`):
  - Agrega columna `motivo_consulta` (Text, nullable) a tabla `episodes`
  - Agrega columna `nombre` (String(200), nullable) a tabla `users`
  - Agrega columna `author_nombre` (String(200), nullable) a tabla `clinical_notes`

### Documentación
- Actualizado README.md con nuevos campos en el modelo de datos
- Agregado este CHANGELOG.md para trackear cambios del proyecto

### Notas Técnicas

#### Mensajes HL7
Los mensajes HL7 ahora incluyen el segmento PV2:
```
PV2|||<motivo_consulta>
```

Este segmento se incluye después del PV1 en:
- Mensajes ADT^A01 (Admisión de paciente)
- Mensajes ORU^R01 (Resultados/Notas clínicas)

#### Flujo de Datos
1. Usuario ingresa motivo de consulta al crear un episodio
2. El campo se almacena en la base de datos local
3. Al sincronizar con el servidor central, se envía en el segmento PV2.3 del mensaje HL7
4. El nombre del usuario se captura al crear notas clínicas para mantener registro histórico

---

## [2.0.0] - Versión anterior

Sistema offline con sincronización bidireccional vía HL7.
