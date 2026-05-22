# Testing

---

## Backend — pytest

Los tests corren dentro de Docker contra una base de datos PostgreSQL separada (`tcoffline_test`),
que se crea automáticamente.

### Correr tests

```bash
# Suite completa
docker compose --profile test run --rm test

# Filtrar por archivo
docker compose --profile test run --rm test tests/test_auth.py -v

# Filtrar por nombre de test
docker compose --profile test run --rm test -k "test_login" -v

# Con reporte de cobertura
docker compose --profile test run --rm test --cov=app --cov-report=term-missing
```

Los directorios `app/` y `tests/` están montados como volúmenes, por lo que los cambios se
reflejan en la siguiente ejecución sin reconstruir la imagen.

Solo es necesario reconstruir si cambia `requirements.txt`:

```bash
docker compose build test
```

### Archivos de test

| Archivo | Cubre |
|---------|-------|
| `tests/conftest.py` | Fixtures: base de datos de test, cliente HTTP, usuarios |
| `tests/test_auth.py` | Login, JWT, roles, `/auth/me` |
| `tests/test_episodes.py` | CRUD episodios, filtros, paginación |
| `tests/test_notes.py` | CRUD notas clínicas, relación con episodio |
| `tests/test_sync.py` | Estado de sincronización, trigger manual, retry, conteos sobre la BD real (`pending_events`, `failed_events`) |
| `tests/test_general.py` | Health checks (incluye `/health/central` con `httpx.Client` mockeado, requiere auth), settings globales |
| `tests/test_hl7_builder.py` | Unit tests de `HL7MessageBuilder`: MSH, escape de separadores, normalización de género, PID/PV1/PV2, mensajes A28/A01/A03/ORU (sin BD ni HTTP) |

---

## Frontend — Jest

Los tests cubren las librerías en `src/lib/`: validación de RUT chileno, formateo de
tiempo relativo, parseo de voz, manejo de credenciales, configuración de servidor,
local store offline-first, outbox de mutaciones pendientes y cliente API
(store-first reads, refresh de tokens en 401, manejo de errores).

```bash
cd frontend_ReactNativ

# Correr una vez
npm test

# Modo watch (re-ejecuta al guardar)
npm run test:watch

# Con reporte de cobertura
npm run test:coverage
```

### Archivos de test

| Archivo | Cubre |
|---------|-------|
| `src/lib/__tests__/rutValidation.test.ts` | Validación y formato de RUT chileno |
| `src/lib/__tests__/timeAgo.test.ts` | Formato de tiempo relativo ("hace 5 min") |
| `src/lib/__tests__/speechParsers.test.ts` | Parseo de transcripciones de voz |
| `src/lib/__tests__/auth.test.ts` | Almacenamiento de tokens en `SecureStore` |
| `src/lib/__tests__/serverConfig.test.ts` | Persistencia de URL del servidor local |
| `src/lib/__tests__/localStore.test.ts` | Envelope `{data, timestamp}`, lecturas/escrituras por scope, `clearAll` preservando `outbox_queue` |
| `src/lib/__tests__/outbox.test.ts` | Enqueue/remove/clear, FIFO, ids únicos, `localEpisodePseudoId`, `retargetNotesForLocalEpisode` |
| `src/lib/__tests__/api.test.ts` | `verifyCredentials`, logout en 401, `APIError` (404/422), patrón store-first con `onUpdate`, bypass de local store para queries filtradas |
| `src/lib/__tests__/_inMemoryStorage.ts` | Helper compartido: reemplaza el mock de `AsyncStorage` por un `Map` con estado real (ignorado por Jest según `testPathIgnorePatterns`) |

---

## Pruebas manuales — archivos .http

El directorio `requests/` contiene dos archivos `.http` para VS Code
([REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client))
y un script para generar los payloads HL7.

| Archivo | Uso |
|---------|-----|
| `requests/backend.http` | Hospital server: crear episodio, crear nota, sync/outbox |
| `requests/tc.http` | Central HIS: enviar un mensaje HL7 al endpoint `/hl7inbound` |
| `requests/build_hl7.py` | Genera los payloads JSON para `tc.http` |

### Hospital server (`backend.http`)

1. Instalar **REST Client** (`humao.rest-client`)
2. Abrir `requests/backend.http` y ejecutar **Login** primero (captura el token)
3. Ejecutar **Create Episode** o **Create Note** según sea necesario

Los endpoints simples (GET listas, health checks, settings) están disponibles en `/docs`.

### Central HIS — HL7 (`tc.http`)

1. Editar las variables en la cabecera de `requests/build_hl7.py` (paciente, episodio, nota)
2. Generar el payload:
   ```bash
   python requests/build_hl7.py a28   # o a01 | a03 | oru | (sin args = todos)
   ```
3. En `tc.http`, cambiar la línea `< ./hl7_a28.json` al archivo deseado y enviar
