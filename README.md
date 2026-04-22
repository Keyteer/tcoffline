# TrakCare Offline Local

Sistema offline para gestión de episodios clínicos con sincronización bidireccional con servidor central.

## Características

- Gestión offline de episodios clínicos con JSON completo del paciente
- Sincronización bidireccional automática con servidor central vía HL7 v2.5
- Frontend móvil React Native (Android, iOS, Web) con modo oscuro
- Backend containerizado (Docker + PostgreSQL)
- Autenticación JWT con refresh tokens
- Descubrimiento de servidor vía mDNS y código QR
- Soporte multiidioma (Español / English)

## Arquitectura

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + SQLAlchemy 2.0 + PostgreSQL 15 |
| Frontend | React Native (Expo SDK 54) |
| Contenedores | Docker + Docker Compose |
| Sincronización | HL7 v2.5 |
| Auth | JWT Bearer token + HTTP Basic fallback |

```
project/
├── app/                         # Backend FastAPI
│   ├── main.py                  # Aplicación principal + logging config
│   ├── models.py                # Modelos SQLAlchemy
│   ├── settings.py              # Configuración (env vars)
│   ├── background_tasks.py      # Scheduler de sincronización
│   ├── outbox_processor.py      # Envío HL7 upstream
│   ├── sync_service.py          # Descarga downstream + health check
│   └── routers/                 # Endpoints REST
├── frontend_ReactNativ/         # App móvil Expo
├── alembic/                     # Migraciones PostgreSQL
├── central_mock/                # Mock del servidor central
├── tests/                       # Suite pytest (backend)
├── requests/                    # Archivos .http para pruebas manuales
├── Dockerfile
├── docker-compose.yml           # Perfiles: prod (default) / dev / test
└── entrypoint.sh
```

## Inicio Rápido

```bash
# Levantar backend + DB (modo producción, logs silenciosos)
docker compose up -d

# Levantar en modo desarrollo (logs verbose, debug)
docker compose --profile dev up backend-dev

# API:           http://localhost:8000
# Docs:          http://localhost:8000/docs
# Credenciales:  admin / admin  |  demo / demo
```

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [INSTALL_AND_RUN.md](./INSTALL_AND_RUN.md) | Instalación, configuración, variables de entorno, perfiles Docker |
| [TESTING.md](./TESTING.md) | Tests backend (pytest), tests frontend (Jest), pruebas manuales (.http) |
| [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | Referencia completa de API, modelos de datos, sincronización |
| [QUICK_FIXES.md](./QUICK_FIXES.md) | Soluciones a problemas comunes |
| [CHANGELOG.md](./CHANGELOG.md) | Historial de cambios |
| [frontend_ReactNativ/DEVELOPMENT.md](./frontend_ReactNativ/DEVELOPMENT.md) | Desarrollo del frontend móvil |

---

Uso interno — Todos los derechos reservados
