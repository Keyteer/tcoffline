# Soluciones Rápidas - TrakCare Offline

Guía de soluciones rápidas para problemas comunes.

## Problemas del Backend (Docker)

### Contenedores no inician

```bash
# Ver logs
docker compose logs backend
docker compose logs db

# Recrear contenedores
docker compose down
docker compose up -d --build
```

### Base de datos no se conecta

**Verificar que PostgreSQL esté corriendo:**
```bash
docker compose ps
# db debe estar "healthy"
```

**Si la base está corrupta, recrear volumen:**
```bash
docker compose down -v
docker compose up -d
```

---

## Problemas de Desarrollo

### Puerto 8000 en uso

**Solución Windows:**
```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :8000

# Matar proceso (reemplaza PID con el número que te dio)
taskkill /PID <número> /F
```

**Solución Linux/Mac:**
```bash
# Ver proceso
lsof -i :8000

# Matar proceso
kill -9 <PID>
```

---

### Error de CORS en desarrollo

El backend acepta peticiones desde cualquier origen (`*`) — no requiere configuración adicional. Si sigues viendo errores CORS:

1. Verifica que el backend esté en `http://localhost:8000`
2. Reinicia el backend

---

## Frontend React Native

### Expo Go no conecta al backend

1. Verifica que el backend esté en la misma red que el dispositivo
2. Usa la IP de la máquina (no `localhost`) en la configuración del servidor
3. Verifica que el firewall permita conexiones al puerto 8000

### APK de producción no conecta al backend (HTTP bloqueado)

Android 9+ bloquea tráfico HTTP en texto claro por defecto. Esto ya está resuelto: el plugin `expo-build-properties` en [frontend_ReactNativ/app.json](frontend_ReactNativ/app.json) inyecta `android:usesCleartextTraffic="true"` en el `AndroidManifest.xml` durante `expo prebuild`.

**No editar `android/app/src/main/AndroidManifest.xml` ni `android/app/src/main/res/xml/network_security_config.xml` manualmente** — los cambios se perderán en el próximo prebuild. Si hace falta cambiar la config de red, ajustar el bloque `expo-build-properties` en `app.json`.

### Limpieza de caché Expo

```bash
cd frontend_ReactNativ
npx expo start -c
```

### Dependencias corruptas

```bash
cd frontend_ReactNativ
rm -rf node_modules
npm install
```

---

### Límite de rutas en Windows (build APK)

CMake 3.22 (incluido en el Android SDK) no soporta rutas largas aunque el registro de Windows tenga Long Paths habilitado. Al compilar aparece:

```
ninja: error: Filename longer than 260 characters
```

**Solución**: crear un junction (enlace de directorio) que acorte la ruta base. Solo se necesita hacer una vez por máquina:

```powershell
# Ejecutar desde la raíz del proyecto (tcoffline/)
cmd /c mklink /J C:\tc "$PWD\frontend_ReactNativ"
```

> **Importante**: el junction debe apuntar a `frontend_ReactNativ/`, no a `frontend_ReactNativ/android/`. Gradle resuelve las rutas a `node_modules` subiendo al directorio padre de `android/`, y ese padre tiene que ser la carpeta con `node_modules`.

El junction sobrevive reinicios. Para borrarlo (no elimina los archivos reales):

```powershell
cmd /c rmdir C:\tc
```

> Si ejecutas `npx expo prebuild --clean`, la carpeta `android/` se regenera en el mismo path, por lo que el junction seguirá funcionando. El plugin `expo-build-properties` re-aplica el cleartext traffic automáticamente. Si tenías una firma de producción configurada manualmente en `build.gradle`, tendrás que repetirla. Ver [Build de producción](./INSTALL_AND_RUN.md#build-de-producción-apk-local-sin-eas).

---

### Ver logs de la app Android (ADB)

Requiere USB debugging habilitado en el dispositivo y conexión USB.

**Verificar que el dispositivo está detectado:**
```bash
adb devices
```

**Capturar logs en tiempo real** (lanzar la app inmediatamente después):
```bash
adb logcat --clear
adb logcat *:E ReactNativeJS:V AndroidRuntime:V
```

**Filtrar solo errores de la app (PowerShell):**
```powershell
adb logcat *:E ReactNativeJS:V 2>&1 | Select-String "ReactNativeJS|FATAL|com.anonymous"
```

Salir con `Ctrl+C`.

---

## Comandos Útiles

### Reiniciar todo (Docker)

```bash
docker compose down
docker compose up -d --build
```

### Verificar que todo funciona

```bash
# Backend health check
curl http://localhost:8000/health

# O abre en navegador
http://localhost:8000/health
```

---

Para más información: [INSTALL_AND_RUN.md](./INSTALL_AND_RUN.md) · [TESTING.md](./TESTING.md) · [CHANGELOG.md](./CHANGELOG.md)
