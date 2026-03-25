@echo off
setlocal enabledelayedexpansion

REM TrakCare Offline Backend - Windows Service Installer (.BAT version)
REM Este script instala el backend como un servicio de Windows usando NSSM

REM ============================
REM Configuracion por defecto
REM ============================
set "INSTALL_PATH=C:\TrakCareOffline\Backend"
set "SERVICE_NAME=TrakCareOfflineBackend"
set "SERVICE_DISPLAY_NAME=TrakCare Offline Backend Service"
set "PYTHON_PATH="

echo ========================================================================
echo TrakCare Offline Backend - Instalador de Servicio Windows
echo ========================================================================
echo.

REM ============================
REM Verificar privilegios de administrador
REM ============================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Este script requiere privilegios de administrador.
    echo Por favor, ejecute este archivo como Administrador.
    echo.
    echo Clic derecho en el archivo ^> Ejecutar como administrador
    pause
    exit /b 1
)

echo [OK] Ejecutando con privilegios de administrador
echo.

REM ============================
REM Detectar Python
REM ============================
echo Buscando Python instalado...
echo.

set "FOUND_PYTHON="
set "PYTHON_PATH="

REM Buscar Python usando 'where' command primero
where python.exe >nul 2>&1
if !errorlevel! equ 0 (
    for /f "delims=" %%i in ('where python.exe') do (
        set "TEST_PATH=%%i"
        REM Evitar el redirect de Windows Store en System32
        echo !TEST_PATH! | find /i "WindowsApps" >nul
        if !errorlevel! neq 0 (
            echo !TEST_PATH! | find /i "System32" >nul
            if !errorlevel! neq 0 (
                "%%i" --version >nul 2>&1
                if !errorlevel! equ 0 (
                    set "PYTHON_PATH=%%i"
                    set "FOUND_PYTHON=1"
                    goto :python_found
                )
            )
        )
    )
)

REM Buscar en ubicaciones comunes de instalacion
set "PYTHON_DIRS=C:\Python313 C:\Python312 C:\Python311 C:\Python310 C:\Python39"
for %%D in (%PYTHON_DIRS%) do (
    if exist "%%D\python.exe" (
        "%%D\python.exe" --version >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_PATH=%%D\python.exe"
            set "FOUND_PYTHON=1"
            goto :python_found
        )
    )
)

REM Buscar en %LOCALAPPDATA%\Programs\Python
if exist "%LOCALAPPDATA%\Programs\Python" (
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
        if exist "%%D\python.exe" (
            "%%D\python.exe" --version >nul 2>&1
            if !errorlevel! equ 0 (
                set "PYTHON_PATH=%%D\python.exe"
                set "FOUND_PYTHON=1"
                goto :python_found
            )
        )
    )
)

REM Buscar en %APPDATA%\Local\Programs\Python
if exist "%APPDATA%\Local\Programs\Python" (
    for /d %%D in ("%APPDATA%\Local\Programs\Python\Python*") do (
        if exist "%%D\python.exe" (
            "%%D\python.exe" --version >nul 2>&1
            if !errorlevel! equ 0 (
                set "PYTHON_PATH=%%D\python.exe"
                set "FOUND_PYTHON=1"
                goto :python_found
            )
        )
    )
)

REM Buscar en ProgramFiles
for /d %%D in ("%ProgramFiles%\Python*") do (
    if exist "%%D\python.exe" (
        "%%D\python.exe" --version >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_PATH=%%D\python.exe"
            set "FOUND_PYTHON=1"
            goto :python_found
        )
    )
)

:python_found
if not defined FOUND_PYTHON (
    echo ERROR: No se pudo encontrar Python instalado.
    echo.
    echo Por favor, instale Python 3.11 o superior desde:
    echo https://www.python.org/downloads/
    echo.
    echo Durante la instalacion, asegurese de marcar "Add Python to PATH"
    echo.
    echo NOTA: Evite instalar Python desde Microsoft Store.
    echo       Descargue el instalador oficial desde python.org
    pause
    exit /b 1
)

echo [OK] Python encontrado: %PYTHON_PATH%

REM Verificar que Python funciona correctamente
"%PYTHON_PATH%" --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: Python encontrado pero no responde correctamente.
    echo Ruta: %PYTHON_PATH%
    echo.
    echo Por favor, reinstale Python desde:
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Mostrar version de Python
"%PYTHON_PATH%" --version
echo.

REM ============================
REM Crear directorio de instalacion
REM ============================
echo Creando directorio de instalacion: %INSTALL_PATH%
if not exist "%INSTALL_PATH%" (
    mkdir "%INSTALL_PATH%"
)
echo [OK] Directorio creado
echo.

REM ============================
REM Copiar archivos del backend
REM ============================
echo Copiando archivos del backend...
set "CURRENT_DIR=%~dp0"

xcopy /E /I /Y "%CURRENT_DIR%app" "%INSTALL_PATH%\app" >nul
echo   [OK] Copiado: app\
xcopy /E /I /Y "%CURRENT_DIR%alembic" "%INSTALL_PATH%\alembic" >nul
echo   [OK] Copiado: alembic\
copy /Y "%CURRENT_DIR%alembic.ini" "%INSTALL_PATH%\" >nul
echo   [OK] Copiado: alembic.ini
copy /Y "%CURRENT_DIR%requirements.txt" "%INSTALL_PATH%\" >nul
echo   [OK] Copiado: requirements.txt

REM Copiar o crear archivo .env
if exist "%CURRENT_DIR%.env" (
    copy /Y "%CURRENT_DIR%.env" "%INSTALL_PATH%\" >nul
    echo   [OK] Copiado: .env ^(configuracion existente^)
) else (
    if exist "%CURRENT_DIR%.env.example" (
        copy /Y "%CURRENT_DIR%.env.example" "%INSTALL_PATH%\.env" >nul
        echo   [AVISO] Creado: .env ^(desde .env.example^)
        echo   IMPORTANTE: Edite %INSTALL_PATH%\.env con su configuracion
    )
)
echo.

REM ============================
REM Crear entorno virtual
REM ============================
echo Creando entorno virtual de Python...
"%PYTHON_PATH%" -m venv "%INSTALL_PATH%\venv"
if %errorlevel% neq 0 (
    echo ERROR: No se pudo crear el entorno virtual.
    pause
    exit /b 1
)
echo [OK] Entorno virtual creado
echo.

REM ============================
REM Instalar dependencias
REM ============================
echo Instalando dependencias de Python...
echo (Esto puede tardar varios minutos...)
"%INSTALL_PATH%\venv\Scripts\pip.exe" install -r "%INSTALL_PATH%\requirements.txt"
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas
echo.

REM ============================
REM Descargar NSSM si no existe
REM ============================
echo Verificando NSSM ^(Non-Sucking Service Manager^)...
set "NSSM_PATH=%INSTALL_PATH%\nssm.exe"

if not exist "%NSSM_PATH%" (
    echo Descargando NSSM...

    REM Usar PowerShell para descargar
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip'}"

    if exist "%TEMP%\nssm.zip" (
        echo Extrayendo NSSM...
        powershell -Command "& {Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%TEMP%\nssm' -Force}"

        REM Copiar version 64-bit
        copy /Y "%TEMP%\nssm\nssm-2.24\win64\nssm.exe" "%NSSM_PATH%" >nul

        REM Limpiar
        del /F /Q "%TEMP%\nssm.zip" >nul 2>&1
        rd /S /Q "%TEMP%\nssm" >nul 2>&1

        echo [OK] NSSM descargado exitosamente
    ) else (
        echo ERROR: No se pudo descargar NSSM.
        echo Por favor, descargue manualmente desde https://nssm.cc/release/nssm-2.24.zip
        pause
        exit /b 1
    )
) else (
    echo [OK] NSSM ya existe
)
echo.

REM ============================
REM Crear script de inicio
REM ============================
echo Creando script de inicio del servicio...
set "START_SCRIPT=%INSTALL_PATH%\start-service.bat"

(
echo @echo off
echo cd /d "%INSTALL_PATH%"
echo call venv\Scripts\activate.bat
echo set DATABASE_URL=sqlite:///./local.db
echo set SECRET_KEY=your-secret-key-change-this
echo uvicorn app.main:app --host 0.0.0.0 --port 8000
) > "%START_SCRIPT%"

echo [OK] Script de inicio creado
echo.

REM ============================
REM Detener servicio existente si existe
REM ============================
sc query %SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo Deteniendo servicio existente...
    "%NSSM_PATH%" stop %SERVICE_NAME%
    timeout /t 2 /nobreak >nul
    "%NSSM_PATH%" remove %SERVICE_NAME% confirm
    timeout /t 2 /nobreak >nul
    echo [OK] Servicio existente eliminado
)

REM ============================
REM Instalar servicio con NSSM
REM ============================
echo Instalando servicio de Windows...
"%NSSM_PATH%" install %SERVICE_NAME% "%START_SCRIPT%"

REM Configurar servicio
"%NSSM_PATH%" set %SERVICE_NAME% DisplayName "%SERVICE_DISPLAY_NAME%"
"%NSSM_PATH%" set %SERVICE_NAME% Description "TrakCare Offline Backend API - FastAPI Service"
"%NSSM_PATH%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_PATH%" set %SERVICE_NAME% AppDirectory "%INSTALL_PATH%"
"%NSSM_PATH%" set %SERVICE_NAME% AppStdout "%INSTALL_PATH%\service-output.log"
"%NSSM_PATH%" set %SERVICE_NAME% AppStderr "%INSTALL_PATH%\service-error.log"
"%NSSM_PATH%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM_PATH%" set %SERVICE_NAME% AppRotateOnline 1
"%NSSM_PATH%" set %SERVICE_NAME% AppRotateBytes 1048576

echo [OK] Servicio instalado exitosamente!
echo.

REM ============================
REM Informacion del servicio
REM ============================
echo ========================================================================
echo Informacion del Servicio
echo ========================================================================
echo Nombre: %SERVICE_NAME%
echo Ruta de instalacion: %INSTALL_PATH%
echo Puerto: 8000
echo URL API: http://localhost:8000
echo.
echo ========================================================================
echo Comandos utiles
echo ========================================================================
echo Iniciar servicio:  net start %SERVICE_NAME%
echo Detener servicio:  net stop %SERVICE_NAME%
echo Estado servicio:   sc query %SERVICE_NAME%
echo Ver logs:          type "%INSTALL_PATH%\service-output.log"
echo.

REM ============================
REM Preguntar si iniciar el servicio
REM ============================
set /p START_NOW="Desea iniciar el servicio ahora? (S/N): "
if /i "%START_NOW%"=="S" (
    echo.
    echo Iniciando servicio...
    net start %SERVICE_NAME%
    timeout /t 3 /nobreak >nul

    sc query %SERVICE_NAME% | find "RUNNING" >nul
    if !errorlevel! equ 0 (
        echo.
        echo [OK] Servicio iniciado correctamente!
        echo El backend esta disponible en http://localhost:8000
    ) else (
        echo.
        echo [AVISO] El servicio no se inicio correctamente.
        echo Revise los logs en: %INSTALL_PATH%\service-error.log
    )
)

echo.
echo ========================================================================
echo Instalacion completada!
echo ========================================================================
echo.
pause
