# Instalación y ejecución

## Requisitos previos

| Herramienta | Versión mínima | Para |
|---|---|---|
| Docker Desktop | 4.x | Backend + base de datos |
| Node.js | 20 LTS | Frontend React Native |
| npm | 10+ | Frontend React Native |

---

## Backend

El backend corre como un stack Docker Compose (FastAPI + PostgreSQL). No se necesita Python local.

### Configuración inicial

```bash
# Ubicarse en la raíz del proyecto
cd tcoffline

# Copiar variables de entorno y ajustar según sea necesario
cp .env.example .env
```

Variables relevantes en `.env`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PG (el default de docker-compose ya está preconfigurado) |
| `CENTRAL_URL` | URL del servidor TrakCare central |
| `CENTRAL_API_USERNAME` / `CENTRAL_API_PASSWORD` | Credenciales para la API central |
| `JWT_SECRET_KEY` | Se autogenera si no se define; definir explícitamente en producción |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. Usar `*` solo en desarrollo |
| `AUTO_SYNC_ENABLED` | `true`: sync automático al iniciar y en background. `false`: solo endpoints manuales |
| `LOG_LEVEL` | Nivel de logging: `WARNING` (prod) o `DEBUG` (dev) |
| `LOG_VERBOSE` | `true`: logs de requests HTTP y conexiones. `false`: solo errores/warnings |

---

## Docker Compose

Hay un único servicio `backend`. El modo se controla editando `.env` y reiniciando el contenedor.

### Iniciar

```bash
docker compose up -d
```

- Backend en `http://localhost:8000`, docs en `/docs`
- Logs JSON con rotación (10 MB × 3 archivos)
- Migraciones y usuarios demo se crean automáticamente al iniciar

Ver logs:

```bash
docker compose logs -f backend
```

Reconstruir solo el backend sin bajar la BD:

```bash
docker compose up --build backend
```

### Cambiar modo (dev ↔ prod)

Editar `.env` y reiniciar:

```bash
# dev: sin sync automático, logs verbosos
AUTO_SYNC_ENABLED=false
LOG_LEVEL=DEBUG
LOG_VERBOSE=true

# prod: sync automático, logs mínimos
AUTO_SYNC_ENABLED=true
LOG_LEVEL=WARNING
LOG_VERBOSE=false
```

```bash
docker compose restart backend
```

Cuando `AUTO_SYNC_ENABLED=false`, usar los endpoints del router `/sync` para disparar sincronizaciones manualmente:

| Endpoint | Descripción |
|---|---|
| `POST /sync/from-central` | Descarga datos del servidor central |
| `POST /sync/trigger` | Procesa eventos outbox pendientes |
| `POST /sync/retry-failed` | Resetea eventos fallidos a pendiente |
| `GET /sync/connection-status` | Estado de conexión al central |
| `GET /sync/stats` | Estadísticas de sincronización |

## Frontend React Native (Expo)

### Configuración inicial

```bash
cd frontend_ReactNativ
npm install
cp .env.example .env
```

Editar `.env`:

```env
EXPO_PUBLIC_SERVER_URL=http://<IP-del-servidor>:8000
```

La app también permite cambiar la URL en runtime desde la pantalla de descubrimiento de servidor.

### Modo desarrollo

Requiere un **development build** instalado en el dispositivo o emulador. Guía oficial:
[Configurar entorno Expo](https://docs.expo.dev/get-started/set-up-your-environment/)

```bash
npm start
# o directamente para Android
npm run android
```

### Build de producción (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure                            # una vez, genera eas.json
eas build --platform android --profile production
eas build --platform ios --profile production
```

Builds locales sin EAS Cloud: [Expo local builds](https://docs.expo.dev/build-reference/local-builds/)

---

## Datos de prueba

```bash
# Carga 10 pacientes con episodios, alergias, laboratorios, imágenes, etc.
python load_test_data.py
```

---

## Checklist de producción

- [ ] Definir `JWT_SECRET_KEY` con valor aleatorio seguro en `.env`
- [ ] Cambiar `CORS_ORIGINS` al dominio/IP real del frontend
- [ ] Configurar backup del volumen Docker `pgdata`
- [ ] Verificar `CENTRAL_URL` y credenciales de API central
