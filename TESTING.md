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
