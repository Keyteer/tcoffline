# Guía de Instalación - TrakCare Offline

Esta guía detalla cómo instalar y configurar TrakCare Offline en Windows como aplicación de escritorio profesional.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación del Backend (Servicio Windows)](#instalación-del-backend)
3. [Instalación del Frontend (Aplicación Electron)](#instalación-del-frontend)
4. [Configuración](#configuración)
5. [Desinstalación](#desinstalación)

---

## Requisitos Previos

### Software Necesario

1. **Python 3.11 o superior**
   - Descargar desde: https://www.python.org/downloads/
   - Durante la instalación, marcar "Add Python to PATH"

2. **Node.js 18 o superior** (solo para compilar el frontend)
   - Descargar desde: https://nodejs.org/
   - Seleccionar la versión LTS

3. **Privilegios de Administrador**
   - La instalación del servicio requiere permisos de administrador

---

## Instalación del Backend

El backend se instala como un servicio de Windows que se ejecuta automáticamente al iniciar el sistema.

### Pasos de Instalación

1. **Ejecutar el instalador como Administrador**
   - Clic derecho en `install-backend-service.bat`
   - Seleccionar "Ejecutar como administrador"

2. **Seguir las instrucciones en pantalla**
   - El script detectará Python automáticamente
   - Creará el directorio de instalación
   - Instalará todas las dependencias
   - Configurará el servicio de Windows

3. **Cuando se solicite, elegir si iniciar el servicio**
   - Escribir `S` para iniciar ahora
   - Escribir `N` para iniciar más tarde

4. **Verificar instalación**
   ```cmd
   REM Ver estado del servicio
   sc query TrakCareOfflineBackend

   REM Ver logs
   type C:\TrakCareOffline\Backend\service-output.log
   ```

**Nota**: Si necesita personalizar la ruta de instalación, edite las variables al inicio del archivo `.bat` antes de ejecutar.

### Qué hace el instalador

- ✅ Detecta automáticamente Python instalado
- ✅ Crea directorio de instalación en `C:\TrakCareOffline\Backend`
- ✅ Copia todos los archivos necesarios del backend
- ✅ Crea entorno virtual de Python
- ✅ Instala todas las dependencias
- ✅ Descarga NSSM (Non-Sucking Service Manager)
- ✅ Registra el servicio en Windows
- ✅ Configura inicio automático
- ✅ Crea archivos de log

### Configuración del Backend

Editar el archivo `.env` en la ruta de instalación:

```bash
# C:\TrakCareOffline\Backend\.env

# Base de datos
DATABASE_URL=sqlite:///./local.db

# Seguridad
SECRET_KEY=cambiar-esta-clave-secreta-por-una-segura

# API Central (opcional)
CENTRAL_API_URL=http://servidor-central:8000

# Puerto del servicio (no cambiar sin ajustar el frontend)
PORT=8000
```

**Importante**: Después de editar `.env`, reiniciar el servicio:
```powershell
Restart-Service TrakCareOfflineBackend
```

### Comandos Útiles del Servicio

```powershell
# Iniciar servicio
net start TrakCareOfflineBackend

# Detener servicio
net stop TrakCareOfflineBackend

# Reiniciar servicio
Restart-Service TrakCareOfflineBackend

# Ver estado
sc query TrakCareOfflineBackend

# Ver logs en tiempo real
Get-Content C:\TrakCareOffline\Backend\service-output.log -Wait

# Ver errores
Get-Content C:\TrakCareOffline\Backend\service-error.log
```

---

## Instalación del Frontend

El frontend se compila como una aplicación Electron standalone que se instala como cualquier programa Windows.

### Opción A: Usar el Instalador Precompilado (Recomendado)

Si ya tiene el archivo `.exe` del instalador:

1. Ejecutar `TrakCare Offline Setup X.X.X.exe`
2. Seguir el asistente de instalación
3. Elegir la carpeta de instalación
4. Crear accesos directos en escritorio y menú inicio
5. Finalizar instalación

La aplicación estará disponible en:
- Menú Inicio > TrakCare Offline
- Acceso directo en el escritorio (si se seleccionó)

### Opción B: Compilar desde Código Fuente

Si necesita compilar el frontend usted mismo:

1. **Abrir PowerShell o CMD en el directorio del proyecto**
   ```cmd
   cd C:\ruta\al\proyecto\trakcare-offline\frontend
   ```

2. **Instalar dependencias**
   ```cmd
   npm install --legacy-peer-deps
   ```

3. **Compilar la aplicación**
   ```cmd
   npm run build
   ```

4. **Generar el instalador de Windows**
   ```cmd
   npm run electron:build:win
   ```

   O usar el script proporcionado:
   ```cmd
   build-electron.bat
   ```

5. **Ubicar el instalador**
   El instalador se generará en:
   ```
   frontend\dist-electron\TrakCare Offline Setup X.X.X.exe
   ```

6. **Ejecutar el instalador** como se describe en la Opción A

### Personalización del Icono (Opcional)

Para usar un icono personalizado:

1. Crear o conseguir una imagen PNG de 256x256 píxeles
2. Convertir a formato ICO usando:
   - https://convertio.co/es/png-ico/
   - ImageMagick: `convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
3. Guardar como `frontend/electron/icon.ico`
4. Recompilar la aplicación

---

## Configuración

### Configuración del Frontend

La aplicación Electron se conecta al backend local por defecto (`http://localhost:8000`).

Si necesita cambiar la URL del backend, editar antes de compilar:

**frontend/.env.production**
```env
VITE_API_URL=http://localhost:8000
```

Luego recompilar la aplicación.

### Primera Ejecución

1. **Asegurarse que el servicio backend está corriendo**
   ```powershell
   Get-Service TrakCareOfflineBackend
   ```
   Debe mostrar `Status: Running`

2. **Iniciar TrakCare Offline** desde el menú inicio

3. **Iniciar sesión**
   - Usuario predeterminado: (configurar en el backend)
   - Contraseña: (configurar en el backend)

### Inicializar Base de Datos

Si es la primera instalación:

```powershell
cd C:\TrakCareOffline\Backend

# Activar entorno virtual
.\venv\Scripts\activate

# Aplicar migraciones
python -m alembic upgrade head

# Crear usuarios demo (opcional)
python init_demo_users.py

# Cargar datos de prueba (opcional)
python load_test_data.py
```

---

## Desinstalación

### Desinstalar el Backend (Servicio)

1. **Ejecutar el desinstalador como Administrador**
   - Clic derecho en `uninstall-backend-service.bat`
   - Seleccionar "Ejecutar como administrador"

2. **Confirmar eliminación de archivos** cuando se solicite

### Desinstalar el Frontend

1. Ir a **Configuración de Windows > Aplicaciones**
2. Buscar "TrakCare Offline"
3. Click en "Desinstalar"
4. Seguir el asistente

O desde PowerShell:
```powershell
# Listar aplicaciones instaladas
Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*TrakCare*" }

# Desinstalar (obtener el IdentifyingNumber del comando anterior)
$app = Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -eq "TrakCare Offline" }
$app.Uninstall()
```

---

## Verificación de la Instalación

### Verificar Backend

```powershell
# Verificar que el servicio está corriendo
Get-Service TrakCareOfflineBackend

# Probar API
curl http://localhost:8000/health

# Ver logs recientes
Get-Content C:\TrakCareOffline\Backend\service-output.log -Tail 20
```

### Verificar Frontend

1. Abrir TrakCare Offline desde el menú inicio
2. Verificar que se conecta al backend
3. Intentar iniciar sesión
4. Verificar funcionalidades básicas:
   - Lista de episodios
   - Crear nuevo episodio
   - Ver notas clínicas

---

## Solución de Problemas

### El servicio no inicia

```cmd
REM Ver errores detallados
type C:\TrakCareOffline\Backend\service-error.log

REM Reinstalar el servicio (ejecutar como Administrador)
uninstall-backend-service.bat
install-backend-service.bat
```

### El frontend no se conecta al backend

1. Verificar que el servicio está corriendo: `Get-Service TrakCareOfflineBackend`
2. Verificar firewall de Windows: permitir puerto 8000
3. Probar acceso manual: abrir navegador en `http://localhost:8000/health`
4. Verificar logs del servicio

### Error de permisos

Todos los comandos de instalación/desinstalación requieren **ejecutarse como Administrador**.

### Puerto 8000 ya está en uso

Otro servicio está usando el puerto 8000:

```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :8000

# Detener el proceso (usar PID del comando anterior)
taskkill /PID <PID> /F

# O cambiar el puerto del backend editando el servicio
```

---

## Actualizaciones

### Actualizar Backend

1. Detener el servicio
2. Hacer backup de la base de datos y `.env`
3. Ejecutar el instalador nuevamente (sobrescribirá archivos)
4. Restaurar `.env` si fue reemplazado
5. Iniciar el servicio

### Actualizar Frontend

1. Desinstalar versión anterior
2. Instalar nueva versión desde el nuevo `.exe`

---

## Ubicaciones de Archivos

### Backend
- **Instalación**: `C:\TrakCareOffline\Backend\`
- **Base de datos**: `C:\TrakCareOffline\Backend\local.db`
- **Configuración**: `C:\TrakCareOffline\Backend\.env`
- **Logs**: `C:\TrakCareOffline\Backend\service-*.log`
- **Entorno virtual**: `C:\TrakCareOffline\Backend\venv\`

### Frontend
- **Instalación**: `C:\Program Files\TrakCare Offline\`
- **Datos de usuario**: `%APPDATA%\trakcare-offline-ui\`
- **Accesos directos**: Escritorio y Menú Inicio

---

## Soporte

Para obtener ayuda adicional:
- Revisar logs del backend: `C:\TrakCareOffline\Backend\service-output.log`
- Revisar logs del frontend: Presionar F12 en la aplicación > Console
- Consultar el archivo CHANGELOG.md para cambios recientes
- Consultar FUNCIONALIDADES.md para documentación de características

---

**Versión del documento**: 1.0
**Última actualización**: 2024-03-23
