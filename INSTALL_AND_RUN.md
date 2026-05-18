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

## Bundle de despliegue (sin código fuente)

Para distribuir el backend a un servidor de hospital sin necesidad de código fuente ni cuenta Docker, empaqueta las imágenes junto con los archivos de configuración.

### Crear el bundle

```powershell
# 1. Crear la carpeta del bundle
New-Item -ItemType Directory -Path ..\TcOffline-backend -Force

# 2. Exportar las imágenes Docker
docker save tcoffline-backend postgres:15-alpine -o ..\TcOffline-backend\tcoffline-images.tar

# 3. Copiar el compose de producción y el .env
Copy-Item docker-compose.prod.yml ..\TcOffline-backend\docker-compose.yml
Copy-Item .env ..\TcOffline-backend\.env

# 4. Crear README.txt para despliegue (Opcional)
@"
# How to run:

  cd TcOffline-backend
  docker load -i tcoffline-images.tar
  docker compose up -d

Editar .env antes de iniciar (CENTRAL_URL, JWT_SECRET_KEY, etc.)
> .env contiene credenciales — no compartir públicamente
"@ | Out-File -Encoding utf8 ..\TcOffline-backend\README.txt
```

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

### Build de producción (APK local, sin EAS)

La configuración nativa necesaria (cleartext HTTP) está expresada como plugin en [frontend_ReactNativ/app.json](frontend_ReactNativ/app.json) y se aplica automáticamente durante `expo prebuild`.

> **Solo Windows**: antes de compilar es necesario crear un junction para evitar el límite de 260 caracteres de CMake. Ver [QUICK_FIXES — Límite de rutas en Windows](./QUICK_FIXES.md#límite-de-rutas-en-windows-build-apk).

#### 1. Preparar

```bash
cd frontend_ReactNativ
npm install
npx expo prebuild --platform android   # genera android/ con los plugins aplicados
```

#### 2. Compilar

Desde /android/:

```powershell
# Windows:
.\/gradlew assembleRelease
```

```bash
# Linux/macOS:
./gradlew assembleRelease
```

El APK queda en `frontend_ReactNativ/android/app/build/outputs/apk/release/app-release.apk`.
Por defecto se firma con el **keystore de debug** (adecuado para pruebas internas y sideloading).

#### 3. Firma con keystore de producción **(Opcional)**

Necesario solo si vas a distribuir actualizaciones a usuarios que ya tienen la app instalada, o publicar en Play Store. Con el keystore de debug cada máquina genera una clave distinta, lo que impide instalar actualizaciones sobre versiones anteriores.

>  Solicita el archivo `production-key.jks` y la contraseña a los desarrolladores responsables del proyecto.

1. **Copiar el keystore** recibido a `frontend_ReactNativ/android/app/production-key.jks`.

2. **Editar `android/app/build.gradle`** — añadir dentro de `signingConfigs` y apuntar `release` buildType a él:

   ```gradle
   signingConfigs {
       debug { ... }   // existente, no tocar
       release {
           storeFile file("production-key.jks")
           storePassword "<password>"
           keyAlias "TcOfflineKey"
           keyPassword "<password>"
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           // resto de opciones existentes...
       }
   }
   ```

3. Compilar con `assembleRelease` igual que antes.

> Se recomienda guardar una copia de `production-key.jks` fuera de /android/. Tras un `npx expo prebuild --clean` hay que repetir el paso 2 y volver a copiar el `.jks` a `android/app/`.

#### 4. Instalar en dispositivo

```powershell
adb install -r "frontend_ReactNativ\android\app\build\outputs\apk\release\app-release.apk"
```

Alternativamente copiar el APK al dispositivo e instalar manualmente.

---

## Datos de prueba

```bash
# Carga 10 pacientes con episodios, alergias, laboratorios, imágenes, etc.
python load_test_data.py
```
