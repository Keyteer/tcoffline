# TrakCare Offline - Aplicación Electron

Este directorio contiene la aplicación de escritorio TrakCare Offline construida con Electron.

## Desarrollo

### Requisitos Previos

- Node.js 18 o superior
- npm 9 o superior
- **Python 3.11+ con el backend de TrakCare corriendo**

### PASO CRÍTICO: Iniciar el Backend Primero

**ANTES DE EJECUTAR LA APLICACIÓN ELECTRON**, debes tener el backend corriendo:

```bash
# Desde el directorio raíz del proyecto
cd ..
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

O en Windows:
```cmd
cd..
setup-backend.bat
```

Verifica que funcione abriendo http://localhost:8000/health en tu navegador.

**Si no inicias el backend primero, verás una pantalla negra o blanca en la aplicación Electron.**

### Instalación de Dependencias

```bash
npm install --legacy-peer-deps
```

### Modo Desarrollo

Ejecutar la aplicación en modo desarrollo con hot-reload:

```bash
npm run electron:dev
```

Esto iniciará:
1. Servidor de desarrollo Vite en http://localhost:3000
2. Ventana Electron que carga la aplicación
3. DevTools abierto automáticamente para debugging

### Compilación Web (sin Electron)

Para compilar solo la aplicación web React:

```bash
npm run build
```

Los archivos compilados estarán en `dist/`.

## Compilación de la Aplicación Electron

### Compilar para Windows

```bash
npm run electron:build:win
```

O usar el script proporcionado:

**Windows:**
```cmd
build-electron.bat
```

**Linux/Mac:**
```bash
chmod +x build-electron.sh
./build-electron.sh
```

### Salida de la Compilación

El proceso generará:

- **Instalador NSIS**: `dist-electron/TrakCare Offline Setup X.X.X.exe`
  - Instalador completo con asistente
  - Crea accesos directos
  - Registro en Windows

- **Aplicación portable** (opcional): `dist-electron/win-unpacked/`
  - Versión sin instalar
  - Ejecutable directo

### Estructura de Archivos Electron

```
frontend/
├── electron/
│   ├── main.cjs           # Proceso principal de Electron
│   ├── preload.cjs        # Script preload (seguridad)
│   ├── icon.ico           # Icono de la aplicación
│   └── icon-placeholder.txt
├── dist/                  # Build de React (generado)
├── dist-electron/         # Instaladores (generado)
└── package.json
```

## Configuración

### Variables de Entorno

Crear archivo `.env.production` con:

```env
VITE_API_URL=http://localhost:8000
```

### Personalización del Icono

1. Crear imagen PNG de 256x256 píxeles
2. Convertir a ICO:
   - Online: https://convertio.co/es/png-ico/
   - ImageMagick: `convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
3. Guardar como `electron/icon.ico`
4. Recompilar

### Configuración del Instalador

Editar `package.json` sección `build`:

```json
{
  "build": {
    "appId": "com.trakcare.offline",
    "productName": "TrakCare Offline",
    "win": {
      "target": "nsis",
      "icon": "electron/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    }
  }
}
```

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo web |
| `npm run build` | Compilar aplicación web |
| `npm run electron:dev` | Desarrollo con Electron |
| `npm run electron:build` | Compilar app Electron |
| `npm run electron:build:win` | Compilar para Windows |
| `npm run pack` | Empaquetar sin crear instalador |
| `npm run dist` | Crear instalador de distribución |

## Depuración

### Abrir DevTools

En la aplicación Electron, presionar:
- **F12**: Abrir/cerrar DevTools
- **Ctrl+R**: Recargar aplicación
- **F11**: Pantalla completa

### Logs de Electron

Los logs del proceso principal se muestran en la consola donde ejecutó `npm run electron:dev`.

Los logs de la aplicación React están en DevTools (F12).

## Despliegue

### Requisitos del Sistema del Usuario Final

- Windows 10 o superior (64-bit)
- 200 MB de espacio en disco
- 4 GB de RAM (recomendado)

### Distribución del Instalador

1. Compilar la aplicación: `npm run electron:build:win`
2. El instalador está en: `dist-electron/TrakCare Offline Setup X.X.X.exe`
3. Distribuir este archivo `.exe` a los usuarios
4. Los usuarios ejecutan el instalador y siguen el asistente

### Actualización de Versión

Editar `package.json`:

```json
{
  "version": "1.9.0"
}
```

Luego recompilar. El número de versión aparecerá en:
- Nombre del instalador
- Panel de control de Windows
- Menú "Acerca de" en la aplicación

## Solución de Problemas

### Pantalla en Blanco o Negra al Ejecutar

**CAUSA PRINCIPAL**: El backend NO está corriendo.

**SOLUCIÓN**:

1. **SIEMPRE inicia el backend primero**:
   ```bash
   # Desde directorio raíz del proyecto
   cd ..
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. **Verifica que el backend responda**:
   - Abre http://localhost:8000/health en tu navegador
   - Deberías ver: `{"status": "ok"}`

3. **Luego inicia Electron**:
   ```bash
   cd frontend
   npm run electron:dev
   ```

4. **Si el problema persiste**:
   - Presiona **F12** en la app Electron para ver DevTools
   - Busca errores de red (Network errors)
   - Revisa la consola terminal donde ejecutaste electron

Ver guía completa: [ELECTRON_TROUBLESHOOTING.md](./ELECTRON_TROUBLESHOOTING.md)

### Warning CSS: "Expected identifier but found -"

Este warning de esbuild con Tailwind CSS es conocido y puede ser **ignorado de forma segura**. No afecta la funcionalidad.

### Error: Cannot find module 'electron'

```bash
npm install --legacy-peer-deps
```

### El instalador no se genera

Verificar que electron-builder está instalado:

```bash
npm list electron-builder
npm install electron-builder --save-dev --legacy-peer-deps
```

### La aplicación no se conecta al backend

1. Verificar que el backend está corriendo en http://localhost:8000
2. Probar manualmente: Abrir `http://localhost:8000/health` en navegador
3. Verificar archivo `.env.production` (debe existir)
4. Limpiar y recompilar:
   ```bash
   rmdir /s /q dist dist-electron
   build-electron.bat
   ```

### Error de firma de código (Code Signing)

Para distribución profesional, se recomienda firmar el código con certificado:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "password"
    }
  }
}
```

Sin firma, Windows mostrará advertencias de seguridad al instalar.

## Arquitectura

### Proceso Principal (main.cjs)

- Crea la ventana de la aplicación
- Gestiona ciclo de vida de la app
- Maneja menús nativos
- Proporciona APIs nativas

### Proceso Renderer (React App)

- Interfaz de usuario completa
- Se comunica con el backend via HTTP
- Mismo código que la versión web

### Seguridad

- `nodeIntegration: false` - No exponer APIs de Node.js
- `contextIsolation: true` - Aislar contextos
- `webSecurity: true` - Habilitar seguridad web

## Recursos Adicionales

- [Documentación de Electron](https://www.electronjs.org/docs)
- [Documentación de electron-builder](https://www.electron.build/)
- [Guía de Seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security)

---

**Versión**: 1.8.0-rc02
**Actualizado**: 2024-03-23
