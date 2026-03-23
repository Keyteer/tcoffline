@echo off
setlocal enabledelayedexpansion

REM TrakCare Offline Backend - Windows Service Uninstaller (.BAT version)

REM ============================
REM Configuracion por defecto
REM ============================
set "INSTALL_PATH=C:\TrakCareOffline\Backend"
set "SERVICE_NAME=TrakCareOfflineBackend"

echo ========================================================================
echo TrakCare Offline Backend - Desinstalador de Servicio
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
REM Verificar si el servicio existe
REM ============================
sc query %SERVICE_NAME% >nul 2>&1
if %errorlevel% neq 0 (
    echo El servicio '%SERVICE_NAME%' no esta instalado.
    echo.
) else (
    set "NSSM_PATH=%INSTALL_PATH%\nssm.exe"

    echo Deteniendo servicio...
    if exist "!NSSM_PATH!" (
        "!NSSM_PATH!" stop %SERVICE_NAME%
    ) else (
        net stop %SERVICE_NAME% 2>nul
    )
    timeout /t 2 /nobreak >nul

    echo Eliminando servicio...
    if exist "!NSSM_PATH!" (
        "!NSSM_PATH!" remove %SERVICE_NAME% confirm
    ) else (
        sc delete %SERVICE_NAME%
    )

    echo [OK] Servicio desinstalado correctamente.
    echo.
)

REM ============================
REM Preguntar si eliminar archivos
REM ============================
set /p REMOVE_FILES="Desea eliminar los archivos de instalacion en %INSTALL_PATH%? (S/N): "
if /i "%REMOVE_FILES%"=="S" (
    if exist "%INSTALL_PATH%" (
        echo.
        echo Eliminando archivos...
        rd /S /Q "%INSTALL_PATH%"
        if exist "%INSTALL_PATH%" (
            echo [AVISO] No se pudieron eliminar algunos archivos.
            echo Por favor, elimine manualmente: %INSTALL_PATH%
        ) else (
            echo [OK] Archivos eliminados.
        )
    ) else (
        echo El directorio %INSTALL_PATH% no existe.
    )
)

echo.
echo ========================================================================
echo Desinstalacion completada!
echo ========================================================================
echo.
pause
