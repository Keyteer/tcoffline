@echo off
echo.
echo TrakCare Central Mock - Setup Script
echo ========================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Python 3 no encontrado. Por favor instala Python 3.11 o superior.
    exit /b 1
)

python --version
echo.

echo Creando entorno virtual...
python -m venv venv

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo Entorno virtual creado y activado
) else (
    echo Error al crear entorno virtual
    exit /b 1
)

echo.
echo Instalando dependencias...
python -m pip install -q --upgrade pip
pip install -q -r requirements.txt
echo Dependencias instaladas

echo.
if not exist ".env" (
    echo Configurando variables de entorno...
    copy .env.example .env
    echo Archivo .env creado desde .env.example
) else (
    echo Archivo .env ya existe
)

echo.
echo Inicializando base de datos...
python -c "from app.db import init_db; init_db(); print('Base de datos inicializada')"

echo.
echo Setup completado!
echo.
echo Para iniciar el servidor, ejecuta:
echo.
echo   venv\Scripts\activate
echo   uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
echo.
echo Luego visita: http://localhost:8001/docs
echo.
pause
