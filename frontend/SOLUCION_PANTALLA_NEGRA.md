# Solución al Problema de Pantalla Negra en Electron

## Problema

Al ejecutar la aplicación TrakCare Offline desde Electron, solo se ve una ventana negra.

## Causa Raíz

La aplicación Electron intenta conectarse al backend Python en `http://localhost:8000`, pero el backend **NO está corriendo**, causando que la aplicación no pueda cargar datos.

## Estado Actual (v1.9.0-rc07)

Desde la versión 1.9.0-rc07, la aplicación ahora muestra un **mensaje de error útil** en lugar de una pantalla negra cuando el backend no está disponible. Este mensaje incluye:

- Explicación clara del problema
- Instrucciones paso a paso para solucionarlo
- Botón para reintentar la conexión
- Botón para verificar el backend en el navegador

Si aún ves pantalla negra, presiona **F12** para abrir DevTools y verificar errores de consola.

## Solución

### Opción 1: Script Automático (Recomendado)

Ejecuta el script que inicia automáticamente ambos componentes:

```cmd
frontend\iniciar-trakcare-electron.bat
```

Este script:
1. Verifica si el backend está corriendo
2. Si no lo está, lo inicia automáticamente
3. Lanza la aplicación Electron
4. Mantiene el backend corriendo en segundo plano

### Opción 2: Manual

**Paso 1 - Iniciar Backend:**
```cmd
REM Desde el directorio raíz del proyecto
cd C:\ruta\al\proyecto
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

O usa el script incluido:
```cmd
setup-backend.bat
```

**Paso 2 - Verificar Backend:**
Abre http://localhost:8000/health en tu navegador.
Debes ver: `{"status": "ok"}`

**Paso 3 - Abrir Electron:**
Ahora sí puedes abrir la aplicación TrakCare Offline desde el escritorio.

## Cambios Implementados

Para facilitar el debugging de este y otros problemas:

### 1. DevTools Siempre Abierto

La aplicación Electron ahora abre DevTools automáticamente en modo producción. Esto permite ver errores inmediatamente.

**Archivo modificado:** `frontend/electron/main.cjs`
```javascript
// Open DevTools always in packaged app to help debug
if (!isDev) {
  mainWindow.webContents.openDevTools();
}
```

Puedes ocultar DevTools presionando **F12**.

### 2. Documentación Mejorada

Se crearon/actualizaron los siguientes documentos:

- **INICIO_RAPIDO_ELECTRON.md** - Guía paso a paso para usuarios nuevos
- **README_ELECTRON.md** - Documentación completa actualizada con énfasis en el backend
- **ELECTRON_TROUBLESHOOTING.md** - Solución de problemas con sección destacada
- **iniciar-trakcare-electron.bat** - Script que automatiza el inicio de backend + frontend

### 3. Logs Mejorados

El archivo `main.cjs` ya incluye logging detallado:
- Logs de carga de URL
- Logs de errores de carga
- Logs de consola del renderer process

## Verificación

Para verificar que todo funciona:

1. **Cierra completamente** la aplicación Electron si está abierta
2. **Cierra el backend** si está corriendo
3. Ejecuta `frontend\iniciar-trakcare-electron.bat`
4. La aplicación debe:
   - Iniciar el backend automáticamente
   - Abrir la ventana de Electron
   - Mostrar la pantalla de login (no pantalla negra)
   - Tener DevTools abierto en el lado derecho

## Preguntas Frecuentes

### ¿Por qué DevTools está siempre abierto?

Para facilitar el debugging. Si hay un error, puedes verlo inmediatamente en la consola. Presiona F12 para ocultarlo si molesta.

### ¿Puedo cerrar el terminal del backend?

No mientras uses la aplicación Electron. El backend debe estar corriendo todo el tiempo que uses la app.

### ¿Hay forma de incluir el backend dentro del .exe?

Técnicamente sí, usando PyInstaller para compilar el backend a .exe y luego iniciarlo desde Electron. Esto está fuera del scope actual pero puede implementarse en el futuro.

### El script iniciar-trakcare-electron.bat no encuentra el ejecutable

Necesitas compilar la aplicación primero:
```cmd
cd frontend
build-electron.bat
```

Esto genera el ejecutable en `dist-electron/win-unpacked/TrakCare Offline.exe`

### ¿Qué puerto usa el backend?

Por defecto 8000. Si necesitas cambiarlo:
1. Edita `.env` en raíz: `PORT=8001`
2. Edita `frontend/.env.production`: `VITE_API_BASE_URL=http://localhost:8001`
3. Recompila frontend

## Comandos Útiles

```cmd
REM Ver si el backend está corriendo
curl http://localhost:8000/health

REM Ver qué está usando el puerto 8000
netstat -ano | findstr :8000

REM Compilar la app Electron
cd frontend
build-electron.bat

REM Limpiar y recompilar desde cero
cd frontend
rmdir /s /q node_modules dist dist-electron
npm install --legacy-peer-deps
build-electron.bat
```

## Resumen

**Problema**: Pantalla negra en Electron
**Causa**: Backend no está corriendo
**Solución**: Siempre iniciar backend ANTES de Electron
**Herramienta**: Usar `iniciar-trakcare-electron.bat` para automatizar

---

**Fecha de solución**: 2026-03-23
**Versión**: 1.9.0-rc07
