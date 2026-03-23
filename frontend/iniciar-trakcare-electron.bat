@echo off
echo ========================================
echo TrakCare Offline - Iniciador Electron
echo ========================================
echo.

REM Ir al directorio raíz del proyecto
cd /d "%~dp0.."

echo [1/3] Verificando backend...
echo.

REM Verificar si el backend ya está corriendo
curl -s http://localhost:8000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend ya esta corriendo en http://localhost:8000
    echo.
) else (
    echo [AVISO] Backend NO esta corriendo
    echo.
    echo Debes iniciar el backend primero. Opciones:
    echo.
    echo   1. Ejecutar: setup-backend.bat
    echo   2. O manualmente:
    echo      - cd %CD%
    echo      - python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    echo.
    echo Presiona cualquier tecla para intentar iniciar el backend ahora...
    pause >nul

    echo.
    echo [2/3] Iniciando backend...
    start "TrakCare Backend" cmd /k "cd /d "%CD%" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

    echo Esperando a que el backend inicie...
    timeout /t 5 /nobreak >nul

    REM Verificar nuevamente
    curl -s http://localhost:8000/health >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Backend iniciado correctamente
    ) else (
        echo [ERROR] No se pudo iniciar el backend
        echo Verifica que Python este instalado y las dependencias instaladas
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [3/3] Iniciando aplicacion Electron...
echo.
echo Buscando ejecutable de TrakCare Offline...
echo.

REM Buscar el ejecutable en diferentes ubicaciones posibles
set EXE_FOUND=0

REM 1. En dist-electron/win-unpacked/
if exist "%~dp0dist-electron\win-unpacked\TrakCare Offline.exe" (
    echo Encontrado en: dist-electron\win-unpacked\
    start "" "%~dp0dist-electron\win-unpacked\TrakCare Offline.exe"
    set EXE_FOUND=1
    goto :exe_started
)

REM 2. En archivos de programa (si fue instalado)
if exist "%LOCALAPPDATA%\Programs\TrakCare Offline\TrakCare Offline.exe" (
    echo Encontrado en: Archivos de Programa
    start "" "%LOCALAPPDATA%\Programs\TrakCare Offline\TrakCare Offline.exe"
    set EXE_FOUND=1
    goto :exe_started
)

REM 3. En Program Files
if exist "%ProgramFiles%\TrakCare Offline\TrakCare Offline.exe" (
    echo Encontrado en: Program Files
    start "" "%ProgramFiles%\TrakCare Offline\TrakCare Offline.exe"
    set EXE_FOUND=1
    goto :exe_started
)

:exe_not_found
echo [ERROR] No se encontro el ejecutable de TrakCare Offline
echo.
echo Debes compilar la aplicacion primero:
echo   cd frontend
echo   build-electron.bat
echo.
echo O instalarla desde el instalador generado.
echo.
pause
exit /b 1

:exe_started
echo.
echo ========================================
echo TrakCare Offline iniciado correctamente
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Aplicacion: TrakCare Offline (Electron)
echo.
echo Presiona F12 en la app para abrir DevTools
echo.
echo NO CIERRES ESTA VENTANA si quieres mantener
echo el backend corriendo en segundo plano.
echo.
pause
