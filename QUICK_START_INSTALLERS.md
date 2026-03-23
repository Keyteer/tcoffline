# Inicio Rápido - Instaladores TrakCare Offline

Esta guía te ayudará a generar los instaladores de producción para TrakCare Offline.

## 📦 Resumen

TrakCare Offline se distribuye como dos componentes:

1. **Backend**: Servicio de Windows que corre en segundo plano
2. **Frontend**: Aplicación de escritorio Electron

---

## 🔧 Backend - Instalador del Servicio

### ¿Qué hace?

El instalador del backend (`install-backend-service.bat`):
- ✅ Instala el backend como servicio de Windows
- ✅ Configura inicio automático con el sistema
- ✅ Crea logs automáticos
- ✅ Gestiona el entorno virtual de Python
- ✅ Usa NSSM para gestión del servicio
- ✅ Máxima compatibilidad con Windows (archivo .BAT)

### Cómo usar

**Para el administrador del sistema:**

1. Clic derecho en `install-backend-service.bat`
2. Seleccionar "Ejecutar como administrador"
3. Seguir las instrucciones en pantalla
4. Elegir si iniciar el servicio ahora

**Comandos útiles después de instalar:**

```cmd
REM Iniciar servicio
net start TrakCareOfflineBackend

REM Detener servicio
net stop TrakCareOfflineBackend

REM Ver logs
type C:\TrakCareOffline\Backend\service-output.log
```

### Desinstalar

Clic derecho en `uninstall-backend-service.bat` > "Ejecutar como administrador"

---

## 🖥️ Frontend - Aplicación Electron

### ¿Qué genera?

El proceso de build genera:
- Instalador NSIS (`.exe`) con asistente completo
- Aplicación instalable en Windows
- Accesos directos automáticos
- Integración con el menú inicio

### Cómo compilar el instalador

**Opción 1: Usar el script automatizado (Recomendado)**

En Windows:
```cmd
cd frontend
build-electron.bat
```

En Linux/Mac:
```bash
cd frontend
chmod +x build-electron.sh
./build-electron.sh
```

**Opción 2: Comandos manuales**

```bash
cd frontend

# Instalar dependencias
npm install --legacy-peer-deps

# Compilar React + Generar instalador
npm run electron:build:win
```

### Dónde encontrar el instalador

Después de compilar, el instalador estará en:
```
frontend/dist-electron/TrakCare Offline Setup X.X.X.exe
```

Este archivo `.exe` es el que se distribuye a los usuarios finales.

---

## 🎨 Personalizar el Icono (Opcional)

### Método 1: Generador HTML

1. Abrir `frontend/create-icon.html` en un navegador
2. Click en "Descargar Icono (PNG)"
3. Convertir PNG a ICO en https://convertio.co/es/png-ico/
4. Guardar como `frontend/electron/icon.ico`
5. Recompilar la aplicación

### Método 2: Icono personalizado

1. Crear imagen PNG de 256x256 píxeles con el logo oficial
2. Convertir a ICO usando herramientas online o ImageMagick
3. Guardar como `frontend/electron/icon.ico`
4. Recompilar

---

## 📋 Proceso Completo de Distribución

### Paso 1: Preparar el Backend

```cmd
REM El backend se distribuye como script de instalación
REM No requiere compilación previa
REM Los archivos necesarios están en el repositorio
```

### Paso 2: Compilar el Frontend

```cmd
cd frontend
build-electron.bat
```

### Paso 3: Distribuir a los Usuarios

Proporcionar a los usuarios:

1. **Script del backend**: `install-backend-service.bat`
2. **Instalador del frontend**: `TrakCare Offline Setup X.X.X.exe`

### Paso 4: Instrucciones para el Usuario Final

1. Clic derecho en `install-backend-service.bat` > "Ejecutar como administrador"
2. Ejecutar `TrakCare Offline Setup X.X.X.exe`
3. Seguir el asistente de instalación
4. Iniciar la aplicación desde el menú inicio

---

## 🔍 Verificación de la Instalación

### Verificar Backend

```cmd
REM Estado del servicio
sc query TrakCareOfflineBackend

REM Probar API (con curl si está disponible)
curl http://localhost:8000/health

REM Ver logs
type C:\TrakCareOffline\Backend\service-output.log
```

### Verificar Frontend

1. Abrir TrakCare Offline desde el menú inicio
2. La aplicación debe conectarse automáticamente al backend
3. Intentar iniciar sesión

---

## 🛠️ Configuración Avanzada

### Cambiar Puerto del Backend

Editar `C:\TrakCareOffline\Backend\.env`:
```env
PORT=8000
```

Si cambia el puerto, también debe actualizar el frontend antes de compilar:

Editar `frontend/.env.production`:
```env
VITE_API_URL=http://localhost:NUEVO_PUERTO
```

Luego recompilar el frontend.

### Instalación en Ruta Personalizada

Para personalizar la ruta de instalación, editar las variables al inicio de `install-backend-service.bat`:

```cmd
set "INSTALL_PATH=D:\MiRuta\Backend"
```

### Nombre de Servicio Personalizado

Para cambiar el nombre del servicio, editar las variables al inicio de `install-backend-service.bat`:

```cmd
set "SERVICE_NAME=MiServicioPersonalizado"
```

---

## 📚 Documentación Completa

Para más detalles, consultar:

- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)**: Guía completa de instalación
- **[frontend/README_ELECTRON.md](frontend/README_ELECTRON.md)**: Documentación técnica de Electron
- **[CHANGELOG.md](CHANGELOG.md)**: Historial de cambios

---

## ❓ Solución de Problemas Comunes

### El servicio no inicia

```cmd
REM Ver errores
type C:\TrakCareOffline\Backend\service-error.log

REM Reinstalar (ejecutar como Administrador)
uninstall-backend-service.bat
install-backend-service.bat
```

### Error al compilar Electron

```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run electron:build:win
```

### El frontend no se conecta

1. Verificar que el servicio backend está corriendo
2. Verificar firewall de Windows (permitir puerto 8000)
3. Verificar `.env.production` antes de compilar

---

## 📞 Soporte

Para problemas técnicos:
1. Revisar logs del backend
2. Abrir DevTools en la aplicación (F12)
3. Consultar la documentación completa

---

**Versión**: 1.9.0-rc06
**Última actualización**: 2026-03-23
