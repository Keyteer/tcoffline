@echo off
REM ============================================================================
REM TrakCare Offline Local v2.2.0 - Backend Setup Script (Windows)
REM ============================================================================
REM Este script configura automaticamente el entorno backend completo:
REM 1. Verifica Python 3.12+
REM 2. Crea entorno virtual Python
REM 3. Instala todas las dependencias
REM 4. Configura variables de entorno (.env)
REM 5. Crea y migra la base de datos SQLite
REM 6. Crea usuarios demo (admin/admin123, demo/demo123)
REM ============================================================================

echo.
echo ============================================================================
echo TrakCare Offline Local v2.2.0 - Backend Setup
echo ============================================================================
echo.

REM Verificar Python
echo [1/6] Verificando Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado
    echo         Por favor instala Python 3.12 o superior
    echo         Descarga: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
python --version
echo       OK - Python encontrado
echo.

REM Crear entorno virtual
echo [2/6] Creando entorno virtual...
if exist "venv" (
    echo       Entorno virtual existente detectado, eliminando...
    rmdir /s /q venv
)
python -m venv venv
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] No se pudo crear el entorno virtual
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo       OK - Entorno virtual creado y activado
echo.

REM Actualizar pip
echo [3/6] Actualizando pip...
python -m pip install -q --upgrade pip
echo       OK - pip actualizado
echo.

REM Instalar dependencias
echo [4/6] Instalando dependencias Python...
echo       Esto puede tomar varios minutos...
pip install -q -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] No se pudieron instalar las dependencias
    echo         Revisa que requirements.txt exista y sea valido
    pause
    exit /b 1
)
echo       OK - Dependencias instaladas
echo.

REM Configurar .env
echo [5/6] Configurando variables de entorno...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo       OK - Archivo .env creado desde .env.example
    ) else (
        echo [WARN] No se encontro .env.example, continuando sin .env
    )
) else (
    echo       OK - Archivo .env ya existe
)
echo.

REM Crear base de datos
echo [6/6] Creando base de datos...
if exist "local.db" (
    echo       Base de datos existente detectada, eliminando...
    del /f local.db 2>nul
)
if exist "local.db-shm" del /f local.db-shm 2>nul
if exist "local.db-wal" del /f local.db-wal 2>nul
alembic upgrade head
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo crear la base de datos
    echo         Verifica que alembic.ini y las migraciones existan
    pause
    exit /b 1
)
echo       OK - Base de datos creada
echo.

REM Crear usuarios demo
echo [7/7] Creando usuarios demo...
python init_demo_users.py
if %errorlevel% neq 0 (
    echo [ERROR] No se pudieron crear los usuarios demo
    pause
    exit /b 1
)
echo.

echo ============================================================================
echo SETUP COMPLETADO EXITOSAMENTE!
echo ============================================================================
echo.
echo PROXIMOS PASOS:
echo.
echo 1. Activar entorno virtual:
echo    venv\Scripts\activate
echo.
echo 2. Iniciar servidor backend:
echo    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
echo 3. Acceder a API Docs:
echo    http://localhost:8000/docs
echo.
echo CREDENCIALES DEMO:
echo    Admin:   admin / admin
echo    Usuario: demo / demo
echo.
echo COMANDOS OPCIONALES:
echo    Cargar pacientes de prueba:  python load_test_patients.py
echo    Ver estado de migraciones:   alembic current
echo    Ver historial de migraciones: alembic history
echo.
echo ============================================================================
echo.
pause

