@echo off
REM Script to load test data for TrakCare Offline Local (Windows)
REM Usage: load_test_data.bat

echo ===================================================================
echo   TrakCare Offline Local - Carga de Datos de Prueba
echo ===================================================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo [1/3] Creando entorno virtual...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
    echo       %CHECKMARK% Entorno virtual creado
)

REM Activate virtual environment and install dependencies
echo [2/3] Instalando dependencias...
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Error al instalar dependencias
    call venv\Scripts\deactivate.bat
    pause
    exit /b 1
)
echo       %CHECKMARK% Dependencias instaladas

REM Run the data loader script
echo [3/3] Cargando datos de prueba...
echo.
python load_test_data.py
if errorlevel 1 (
    echo.
    echo [ERROR] Error al cargar datos de prueba
    call venv\Scripts\deactivate.bat
    pause
    exit /b 1
)

call venv\Scripts\deactivate.bat

echo.
echo ===================================================================
echo   %CHECKMARK% Proceso completado
echo ===================================================================
pause
