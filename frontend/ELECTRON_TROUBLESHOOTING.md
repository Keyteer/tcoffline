# Solución de Problemas - Electron App

## ⚠️ Pantalla/Ventana Negra o en Blanco

**PROBLEMA MÁS COMÚN**: La aplicación Electron muestra pantalla negra/blanca al iniciar.

**CAUSA PRINCIPAL**: El backend Python NO está corriendo.

**SOLUCIÓN RÁPIDA**:

### 1. Verificar Backend (PASO CRÍTICO)

La aplicación Electron **REQUIERE** que el backend esté corriendo ANTES de abrirla:

```bash
# Desde el directorio raíz del proyecto
cd ..
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Windows - Opción más fácil**:
```cmd
cd..
setup-backend.bat
```

**Verifica que funcione**:
- Abre http://localhost:8000/health en tu navegador
- Debes ver: `{"status": "ok"}`
- Si NO ves esto, el backend no está corriendo correctamente

### 2. Abrir DevTools
Presiona **F12** o **Ctrl+Shift+I** para abrir las herramientas de desarrollo y ver errores en la consola.

### 3. Verificar Errores Comunes

#### Error: "Failed to fetch" o "Network Error"
- **Causa**: El backend no está corriendo
- **Solución**: Inicia el backend en `http://localhost:8000`

#### Error: "Refused to load..." o "Blocked by CSP"
- **Causa**: Content Security Policy bloqueando scripts
- **Solución**: CSP ahora está configurado en `electron/main.cjs` (no en HTML)

#### Pantalla negra sin errores en consola
- **Causa**: CSP bloqueando carga desde file:// protocol
- **Solución**:
  1. Verifica que `webSecurity: false` en `electron/main.cjs`
  2. Verifica que NO hay CSP en `index.html`
  3. CSP debe estar configurado en `session.defaultSession.webRequest.onHeadersReceived`

#### Pantalla blanca sin errores
- **Causa**: Rutas incorrectas de assets
- **Solución**: Verifica `base: './'` en `vite.config.ts`

### 4. Probar en Modo Desarrollo

Para probar con hot-reload antes de compilar:

```bash
cd frontend
npm install
npm run electron:dev
```

Esto abre la app con DevTools automáticamente.

### 5. Rebuild Completo

Si los problemas persisten:

```bash
cd frontend

# Limpiar todo
rmdir /s /q node_modules
rmdir /s /q dist
rmdir /s /q dist-electron

# Reinstalar
npm install --legacy-peer-deps

# Rebuild
build-electron.bat
```

## Errores de Compilación

### Error: "node_modules.Dependency.Dependencies: ReadMapCB..."

**Síntoma completo:**
```
Error reading package.json: c:\...\node_modules\underscore\package.json
⨯ node_modules.Dependency.Dependencies: ReadMapCB: expect { or n, but found [
```

**Causa**: El directorio `node_modules` está corrupto. Esto puede ocurrir por:
- Instalación interrumpida
- Versiones incompatibles de npm/node
- Corrupción de archivos

**Solución rápida:**
```bash
cd frontend
fix-dependencies.bat
```

**Solución manual:**
```bash
cd frontend

# Eliminar todo
rmdir /s /q node_modules
del /f /q package-lock.json

# Limpiar cache
npm cache clean --force

# Reinstalar
npm install --legacy-peer-deps
```

Después de esto, intenta compilar nuevamente:
```bash
build-electron.bat
```

### Warning: "Expected identifier but found -"

Este warning de CSS es conocido y NO causa problemas. Es un issue de esbuild con ciertos patrones de Tailwind CSS. Puede ser ignorado de forma segura.

### Error: "Cannot find module"

```bash
npm install --legacy-peer-deps
```

### Error: "description is missed in the package.json"

Este es solo un warning, NO un error. Electron-builder funciona igual. Si quieres eliminarlo, agrega a `package.json`:

```json
{
  "description": "Tu descripción aquí",
  "author": "Tu nombre"
}
```

## Configuración del Sistema

### Requisitos Previos
- Node.js 18 o superior
- Python 3.11+ (para el backend)
- Windows 10/11

### Variables de Entorno

La aplicación usa estas variables (ya configuradas):
- `VITE_API_BASE_URL=http://localhost:8000`

### Estructura de Archivos

```
frontend/
├── dist/              # Build de React (temporal)
├── dist-electron/     # Instaladores y ejecutables
├── electron/          # Código de Electron
│   └── main.cjs      # Proceso principal
├── src/              # Código React
└── index.html        # Entry point
```

## Logs y Diagnóstico

### Ver Logs de Electron

Los logs se muestran en la consola donde ejecutaste la app:

```bash
# En desarrollo
npm run electron:dev

# Los logs aparecerán aquí
```

### Verificar Conexión al Backend

Abre `http://localhost:8000/health` en un navegador:
- Si funciona: Backend OK
- Si falla: Backend no está corriendo

## Instalación y Distribución

### Crear Instalador

```bash
cd frontend
build-electron.bat
```

El instalador estará en `frontend/dist-electron/`

### Instalar en Usuario Final

1. Copia el `.exe` al equipo del usuario
2. Ejecuta el instalador
3. Asegúrate que el backend esté instalado como servicio o corriendo
4. Ejecuta "TrakCare Offline" desde el menú inicio

### Desinstalar

Panel de Control > Programas > Desinstalar TrakCare Offline

## Contacto y Soporte

Para problemas adicionales:
1. Revisa los logs en DevTools (F12)
2. Verifica que el backend esté corriendo
3. Comprueba la versión de Node.js: `node --version`
