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

### Verificar que todo funciona

```bash
# Backend health check
curl http://localhost:8000/health

# O abre en navegador
http://localhost:8000/health
```

---

Para más información: [INSTALL_AND_RUN.md](./INSTALL_AND_RUN.md) · [TESTING.md](./TESTING.md) · [CHANGELOG.md](./CHANGELOG.md)
