# Soluciones Rápidas - TrakCare Offline

Guía de soluciones rápidas para problemas comunes.

## Problemas del Frontend Electron

### Pantalla Negra o en Blanco

**Solución rápida:**

1. Presiona **F12** para ver errores en DevTools
2. Verifica que el backend esté corriendo: Abre `http://localhost:8000/health`
3. Si el backend no responde, inícialo:
   ```bash
   cd C:\TrakCareOffline\Backend
   venv\Scripts\activate
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

**Si ves ventana negra sin errores:**
- Problema de CSP bloqueando scripts desde file://
- Asegúrate de usar la versión 1.9.0-rc07 o superior
- Recompila con: `cd frontend && build-electron.bat`

**Guía completa**: [frontend/ELECTRON_TROUBLESHOOTING.md](frontend/ELECTRON_TROUBLESHOOTING.md)

---

### Error: node_modules corrupto

**Síntoma:**
```
Error reading package.json: ...\node_modules\underscore\package.json
⨯ node_modules.Dependency.Dependencies: ReadMapCB...
```

**Solución rápida:**
```bash
cd frontend
fix-dependencies.bat
```

**Solución manual:**
```bash
cd frontend
rmdir /s /q node_modules
del /f /q package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

---

### Build Electron falla

**Solución:**
```bash
cd frontend

# Limpiar todo
rmdir /s /q dist
rmdir /s /q dist-electron
rmdir /s /q node_modules

# Reinstalar y compilar
npm install --legacy-peer-deps
build-electron.bat
```

---

## Problemas del Backend

### Python no encontrado (Windows)

**Síntoma:**
```
Python no encontrado o no es válido
```

**Causa**: Python de Microsoft Store no funciona correctamente.

**Solución:**

1. Desinstala Python de Microsoft Store (si lo tienes)
2. Descarga Python oficial desde https://www.python.org/downloads/
3. Durante instalación, marca:
   - ☑ Add Python to PATH
   - ☑ Install for all users
4. Instala en: `C:\Python312` (no usar AppData)
5. Reinicia la terminal
6. Verifica: `python --version`
7. Ejecuta nuevamente `setup-backend.bat`

---

### Error al instalar dependencias Python

**Solución:**
```bash
# Eliminar entorno virtual corrupto
rmdir /s /q venv

# Recrear
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

### Base de datos no existe

**Solución:**
```bash
# Activar entorno virtual
venv\Scripts\activate

# Aplicar migraciones
alembic upgrade head

# Crear usuarios demo
python init_demo_users.py
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

### Puerto 3000 o 5173 en uso (Frontend)

**Solución:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <número> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

---

### Error de CORS en desarrollo

**Verificación:**

1. Backend debe estar en `http://localhost:8000`
2. Frontend debe estar en `http://localhost:3000` (o 5173)
3. Verifica `.env` en frontend:
   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```
4. Reinicia ambos servidores

---

## Problemas de Producción

### Servicio Backend no inicia

**Verificar logs:**
```bash
# Ver estado del servicio
sc query TrakCareOfflineBackend

# Ver logs (ubicación configurada en NSSM)
C:\TrakCareOffline\Backend\logs\
```

**Reiniciar servicio:**
```bash
# Como Administrador
net stop TrakCareOfflineBackend
net start TrakCareOfflineBackend
```

---

### Aplicación Electron instalada no abre

**Verificación:**

1. Verifica que el servicio backend esté corriendo:
   ```bash
   sc query TrakCareOfflineBackend
   ```

2. Si no está corriendo:
   ```bash
   net start TrakCareOfflineBackend
   ```

3. Abre la aplicación y presiona F12 para ver errores

---

## Warnings que puedes ignorar

### CSS Warning: "Expected identifier but found -"

**Es seguro ignorarlo.** Es un issue conocido de esbuild con Tailwind CSS. No afecta funcionalidad.

### npm audit warnings

**Para desarrollo es OK.** Si quieres corregirlos:
```bash
npm audit fix --legacy-peer-deps
```

### "description is missed in package.json"

**Es solo informativo.** No afecta el build de Electron.

---

## Comandos Útiles

### Reiniciar todo (Desarrollo)

```bash
# Backend
cd <proyecto>
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (nueva terminal)
cd frontend
npm run dev
```

### Verificar que todo funciona

```bash
# Backend health check
curl http://localhost:8000/health

# O abre en navegador
http://localhost:8000/health
```

### Ver versión actual

```bash
# Backend
type package.json | findstr version

# Frontend
cd frontend
type package.json | findstr version
```

---

## Contacto

Para problemas no cubiertos aquí:

1. Revisa [CHANGELOG.md](CHANGELOG.md) para ver cambios recientes
2. Revisa [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) para instalación completa
3. Revisa [frontend/ELECTRON_TROUBLESHOOTING.md](frontend/ELECTRON_TROUBLESHOOTING.md) para problemas de Electron
