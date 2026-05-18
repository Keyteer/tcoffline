@echo off
echo ========================================
echo Reparar Dependencias Corruptas
echo ========================================
echo.

echo Este script eliminara node_modules corrupto y reinstalara todo limpio.
echo.
pause

echo [1/3] Eliminando node_modules y package-lock.json...
if exist node_modules (
    echo Eliminando node_modules...
    rmdir /s /q node_modules
)
if exist package-lock.json (
    echo Eliminando package-lock.json...
    del /f /q package-lock.json
)
echo Limpieza completada.

echo.
echo [2/3] Limpiando cache de npm...
call npm cache clean --force
echo Cache limpiado.

echo.
echo [3/3] Instalando dependencias frescas...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Fallo al instalar dependencias
    echo.
    echo Posibles soluciones:
    echo 1. Verifica tu conexion a internet
    echo 2. Ejecuta como Administrador
    echo 3. Verifica que npm funcione: npm --version
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Reparacion completada exitosamente!
echo ========================================
echo.
echo Ahora puedes ejecutar:
echo   - npm run dev           (desarrollo web)
echo   - npm run electron:dev  (desarrollo electron)
echo   - build-electron.bat    (compilar instalador)
echo.

pause
