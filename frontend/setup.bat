@echo off
echo.
echo ================================================
echo TrakCare Offline Local - Frontend Setup
echo ================================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no encontrado
    echo        Por favor instala Node.js 18 o superior
    echo        Descarga: https://nodejs.org/
    exit /b 1
)

node --version
npm --version
echo.

REM [1/3] Configurar variables de entorno
echo [1/3] Configurando variables de entorno...
if not exist ".env" (
    copy .env.example .env >nul
    echo       OK - Archivo .env creado
) else (
    echo       OK - Archivo .env ya existe
)

REM [2/3] Instalar dependencias
echo.
echo [2/3] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] No se pudieron instalar dependencias
    exit /b 1
)
echo       OK - Dependencias instaladas

REM [3/3] Arreglar vulnerabilidades
echo.
echo [3/3] Arreglando vulnerabilidades...
call npm audit fix --force
echo       OK - Vulnerabilidades procesadas

echo.
echo ================================================
echo Frontend setup completado exitosamente!
echo ================================================
echo.
echo PROXIMOS PASOS:
echo.
echo 1. Asegurate de que el backend este corriendo en http://localhost:8000
echo.
echo 2. Iniciar el frontend:
echo    npm run dev
echo.
echo 3. Acceder a la aplicacion:
echo    Frontend: http://localhost:5173
echo.
echo ================================================
echo.
pause
