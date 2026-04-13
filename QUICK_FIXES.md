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

## Problemas del Backend (Desarrollo Local)

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

### Error de CORS en desarrollo

**Verificación:**

1. Backend debe estar en `http://localhost:8000`
2. Verifica que CORS esté configurado para la IP/puerto del frontend
3. Reinicia el backend

---

## Frontend React Native

### Expo Go no conecta al backend

1. Verifica que el backend esté en la misma red que el dispositivo
2. Usa la IP de la máquina (no `localhost`) en la configuración del servidor
3. Verifica que el firewall permita conexiones al puerto 8000

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

## Comandos Útiles

### Reiniciar todo (Docker)

```bash
docker compose down
docker compose up -d --build
```

### Reiniciar todo (Desarrollo local)

```bash
# Backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (nueva terminal)
cd frontend_ReactNativ
npx expo start
```

### Verificar que todo funciona

```bash
# Backend health check
curl http://localhost:8000/health

# O abre en navegador
http://localhost:8000/health
```

---

## Contacto

Para problemas no cubiertos aquí:

1. Revisa [CHANGELOG.md](CHANGELOG.md) para ver cambios recientes
2. Revisa [frontend_ReactNativ/DEVELOPMENT.md](frontend_ReactNativ/DEVELOPMENT.md) para desarrollo del frontend móvil
