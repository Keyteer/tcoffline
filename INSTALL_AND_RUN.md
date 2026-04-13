# Instalación y ejecución

## Requisitos previos

| Herramienta | Versión mínima | Para |
|---|---|---|
| Docker Desktop | 4.x | Backend + base de datos |
| Node.js | 20 LTS | React Native |
| npm | 10+ | React Native |

---

## Backend

El backend corre como un stack Docker Compose (FastAPI + PostgreSQL). No se necesita Python local.

### Configuración inicial

```bash
# 1. Clonar/ubicarse en la raíz del proyecto
cd tcoffline

# 2. Copiar variables de entorno y ajustar según sea necesario
cp .env.example .env
```

Las variables más relevantes en `.env`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PG (los defaults de docker-compose ya están preconfigurados) |
| `CENTRAL_URL` | URL del servidor TrakCare central |
| `CENTRAL_API_USERNAME` / `CENTRAL_API_PASSWORD` | Credenciales para la API central |
| `JWT_SECRET_KEY` | Se autogenera si no se define; definir explícitamente en producción |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. Usar `*` solo en desarrollo |

### Modo desarrollo

```bash
docker compose up --build
```

- Backend disponible en `http://localhost:8000`
- Documentación interactiva en `http://localhost:8000/docs`
- La base de datos persiste en el volumen Docker `pgdata`
- Las migraciones Alembic y la creación de usuarios demo se ejecutan automáticamente al iniciar

Para ver logs en tiempo real:

```bash
docker compose logs -f backend
```

Para reconstruir solo el backend sin bajar la base de datos:

```bash
docker compose up --build backend
```

### Tests

Los tests corren dentro de Docker contra una base de datos PostgreSQL separada (`tcoffline_test`), que se crea automáticamente.

```bash
# Correr la suite completa (56 tests)
docker compose --profile test run --rm test

# Filtrar por archivo
docker compose --profile test run --rm test tests/test_auth.py -v

# Filtrar por nombre de test
docker compose --profile test run --rm test -k "test_login" -v

# Con reporte de cobertura
docker compose --profile test run --rm test --cov=app --cov-report=term-missing
```

Los directorios `app/` y `tests/` están montados como volúmenes en el servicio `test`, por lo que los cambios al código se reflejan en la siguiente ejecución sin necesidad de reconstruir la imagen.

Solo es necesario reconstruir si cambia `requirements.txt`:

```bash
docker compose build test
```

### Build de producción

La imagen de producción usa multi-stage build para minimizar el tamaño final.

```bash
# Construir imagen
docker compose build backend

# Levantar en producción
docker compose up -d
```

Para producción, asegurarse de:
- Definir `JWT_SECRET_KEY` con un valor seguro en `.env`
- Cambiar `CORS_ORIGINS` al dominio/IP real del frontend
- Cambiar `ENVIRONMENT=production`
- Usar un volumen con backup para `pgdata`

---

## Frontend React Native (Expo)

El frontend es una app Expo con soporte para Android, iOS y Web.

### Configuración inicial

```bash
cd frontend_ReactNativ

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
```

Editar `.env` y ajustar la URL del backend:

```env
EXPO_PUBLIC_SERVER_URL=http://<IP-del-servidor>:8000
```

La app también tiene una pantalla de descubrimiento de servidor que permite cambiar la URL en runtime, por lo que este valor es solo el default inicial.

### Modo desarrollo

Para desarrollo local se requiere un **development build** instalado en el dispositivo o emulador. Seguir la guía oficial de Expo:

> **[Configurar entorno de desarrollo (Expo docs)](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&buildEnv=local&platform=android&device=physical)**

Una vez configurado el entorno y con el build instalado, iniciar el servidor de desarrollo:

```bash
npm start
# o directamente para Android
npm run android
```

### Tests

Los tests usan Jest con el preset `jest-expo`. Cubren las librerías puras en `src/lib/`: validación de RUT chileno, formateo de tiempo relativo, manejo de credenciales y configuración de servidor.

```bash
# Correr una vez
npm test

# Modo watch (re-ejecuta al guardar)
npm run test:watch

# Con reporte de cobertura
npm run test:coverage
```

### Build de producción

Para distribuir la app en producción se usa EAS Build (Expo Application Services):

```bash
# Instalar EAS CLI (una vez)
npm install -g eas-cli

# Login en Expo
eas login

# Configurar el proyecto (una vez, genera eas.json)
eas build:configure

# Build para Android (APK o AAB)
eas build --platform android --profile production

# Build para iOS
eas build --platform ios --profile production
```

Para builds locales sin EAS Cloud, consultar la sección **"Local builds"** en la documentación de Expo:
[https://docs.expo.dev/build-reference/local-builds/](https://docs.expo.dev/build-reference/local-builds/)
