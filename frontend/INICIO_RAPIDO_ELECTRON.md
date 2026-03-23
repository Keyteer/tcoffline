# Inicio Rápido - TrakCare Offline (Electron)

## Instrucciones de Uso

### Primera Vez que Ejecutas la Aplicación

Para usar TrakCare Offline en Electron, necesitas **DOS componentes corriendo**:

1. **Backend (Servidor Python)** - Procesa los datos
2. **Frontend (Aplicación Electron)** - Interfaz visual

---

## Paso a Paso

### 1. Iniciar el Backend

**Opción A - Windows (Recomendado):**
```cmd
# Ir al directorio del proyecto
cd C:\ruta\a\tu\proyecto

# Ejecutar script de inicio
setup-backend.bat
```

**Opción B - Manual:**
```bash
# Ir al directorio raíz del proyecto
cd /ruta/al/proyecto

# Activar entorno virtual (si existe)
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Iniciar backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Verificación:**
- Abre tu navegador web
- Ve a: http://localhost:8000/health
- Deberías ver: `{"status": "ok"}`

### 2. Iniciar la Aplicación Electron

Una vez el backend esté corriendo:

- Ejecuta `TrakCare Offline` desde el acceso directo del escritorio
- O ejecuta el archivo `.exe` directamente

---

## Problemas Comunes

### Pantalla Negra o Blanca

**Causa**: El backend no está corriendo

**Solución**:
1. Cierra la aplicación Electron
2. Inicia el backend (ver Paso 1)
3. Verifica que http://localhost:8000/health funcione
4. Vuelve a abrir la aplicación Electron

### Error "Connection Refused" o "Network Error"

**Causa**: El backend no está escuchando en el puerto 8000

**Solución**:
```bash
# Verifica si el puerto está en uso
netstat -ano | findstr :8000

# Si hay otro proceso, detenerlo o cambiar puerto
```

### DevTools Siempre Abierto

Esto es **normal** en el build de producción para facilitar debugging. Puedes:
- Presionar **F12** para ocultar/mostrar
- Cerrar manualmente el panel lateral

---

## Flujo de Trabajo Diario

```
1. Abrir terminal/cmd
2. Ejecutar setup-backend.bat (Windows) o iniciar backend manualmente
3. Esperar mensaje: "Application startup complete"
4. Abrir TrakCare Offline desde el escritorio
5. Trabajar normalmente
6. Al terminar: Cerrar la aplicación Electron y el terminal del backend
```

---

## Configuración Avanzada

### Cambiar Puerto del Backend

Editar archivo `.env` en el directorio raíz:
```env
PORT=8000  # Cambiar a otro puerto si es necesario
```

Luego actualizar `frontend/.env.production`:
```env
VITE_API_BASE_URL=http://localhost:8000  # Cambiar al mismo puerto
```

Recompilar frontend:
```bash
cd frontend
npm run build
npm run electron:build:win
```

---

## Soporte

Para más ayuda, consulta:
- `frontend/README_ELECTRON.md` - Documentación completa
- `frontend/ELECTRON_TROUBLESHOOTING.md` - Solución de problemas
- Logs del backend en la terminal donde lo ejecutaste
- DevTools (F12 en la aplicación Electron)

---

**Versión**: 1.9.0-rc07
**Fecha**: 2026-03-23
