# TrakCare Offline - Frontend

Frontend de la aplicación TrakCare Offline construido con React + TypeScript + Vite.

## Descripción

Esta aplicación frontend permite a los médicos trabajar offline con episodios de pacientes, registrar notas clínicas y sincronizar con el sistema central cuando hay conexión disponible.

## Tecnologías

- **React 18** - Framework de interfaz de usuario
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **React Router** - Navegación
- **Tailwind CSS** - Estilos

## Requisitos Previos

- Node.js 18 o superior
- npm o yarn
- Backend API corriendo en `http://localhost:8000`

## Instalación

```bash
cd frontend
npm install
```

## Variables de Entorno

Crea un archivo `.env` en la carpeta `frontend/` basado en `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Desarrollo

Para iniciar el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Build de Producción

```bash
npm run build
```

Los archivos de producción se generan en la carpeta `dist/`

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/     # Componentes reutilizables
│   │   ├── EpisodesTable.tsx
│   │   ├── Header.tsx
│   │   ├── PatientHistorySidebar.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── Tabs.tsx
│   ├── hooks/          # Custom hooks
│   │   └── useConnectionStatus.ts
│   ├── lib/            # Librerías y utilidades
│   │   ├── api.ts      # Cliente API
│   │   └── auth.ts     # Autenticación
│   ├── pages/          # Páginas de la aplicación
│   │   ├── ClinicalNote.tsx
│   │   ├── Episodes.tsx
│   │   ├── Login.tsx
│   │   └── NewEpisode.tsx
│   ├── types/          # Definiciones TypeScript
│   │   └── index.ts
│   ├── App.tsx         # Componente raíz
│   ├── main.tsx        # Punto de entrada
│   └── index.css       # Estilos globales
├── public/             # Archivos estáticos
├── index.html          # HTML base
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Funcionalidades

### Autenticación
- Login con usuario y contraseña
- Autenticación Basic con header Bearer
- Protección de rutas con `ProtectedRoute`

### Listado de Episodios
- Vista tabular de episodios por tipo (Urgencia, Hospitalizado, Ambulatorio)
- Tabs dinámicos basados en tipos disponibles en la base de datos
- Filtrado por tipo de episodio
- Información: Paciente, RUN, MRN, Ubicación, Fecha

### Nota Clínica
- Editor de notas offline
- Sidebar colapsable con antecedentes del paciente
  - Encuentros previos (diagnósticos, medicamentos, indicaciones)
  - Resultados de exámenes (laboratorio, imágenes)
- Información del paciente y episodio
- Guardado local de notas

### Estado de Conexión
- Indicador visual del estado online/offline
- Verificación periódica de conexión con el backend
- Información de última verificación

## Credenciales de Prueba

Usuario: `admin`
Contraseña: `admin123`

## API Endpoints

El frontend consume los siguientes endpoints del backend:

- `POST /auth/me` - Autenticación
- `GET /episodes` - Listado de episodios
- `GET /episodes/{id}` - Detalle de episodio
- `POST /episodes/{id}/notes` - Crear nota clínica
- `GET /health` - Estado del servidor

## Notas de Desarrollo

- El frontend parsea el campo `data_json` de cada episodio para extraer información completa del JSON original
- Los tabs se generan dinámicamente basados en los tipos de episodios disponibles
- La aplicación está optimizada para funcionar offline con sincronización posterior
- Los antecedentes históricos se cargan desde el campo `Antecedentes` del JSON almacenado

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview del build
npm run preview

# Lint
npm run lint
```

## Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.
