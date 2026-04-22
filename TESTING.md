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
| `tests/test_auth.py` | Login, JWT, refresh token, roles, `/auth/me` |
| `tests/test_episodes.py` | CRUD episodios, filtros, paginación |
| `tests/test_notes.py` | CRUD notas clínicas, relación con episodio |
| `tests/test_sync.py` | Estado de sincronización, trigger manual, retry |
| `tests/test_general.py` | Health checks, settings globales, discovery endpoint |

---

## Frontend — Jest

Los tests cubren las librerías puras en `src/lib/`: validación de RUT chileno, formateo de
tiempo relativo, manejo de credenciales y configuración de servidor.

```bash
cd frontend_ReactNativ

# Correr una vez
npm test

# Modo watch (re-ejecuta al guardar)
npm run test:watch

# Con reporte de cobertura
npm run test:coverage
```

---

## Pruebas manuales — archivos .http

El directorio `requests/` contiene archivos `.http` para probar los endpoints directamente
desde VS Code (extensión [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client))
o cualquier cliente compatible (HTTPie, IntelliJ HTTP Client).

| Archivo | Endpoints |
|---------|-----------|
| `requests/auth.http` | Login, refresh, `/auth/me` |
| `requests/episodes.http` | CRUD episodios, tipos, ubicaciones |
| `requests/notes.http` | CRUD notas clínicas |
| `requests/sync.http` | Trigger sync, retry, stats, status |
| `requests/general.http` | Health checks, discovery, settings |

### Uso básico con REST Client (VS Code)

1. Instalar la extensión **REST Client** (`humao.rest-client`)
2. Abrir cualquier archivo en `requests/`
3. Hacer click en **Send Request** sobre el endpoint deseado
4. Ajustar el `@baseUrl` y el token JWT en la cabecera del archivo si es necesario

```http
# Ejemplo: requests/auth.http
@baseUrl = http://localhost:8000

### Login
POST {{baseUrl}}/auth/token
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin123
```
