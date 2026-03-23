@echo off
echo ========================================
echo TrakCare Offline - Build Electron App
echo ========================================
echo.

echo [1/6] Limpiando node_modules corrupto...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
echo Limpieza completada

echo.
echo [2/6] Instalando dependencias limpias...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias
    pause
    exit /b 1
)

echo.
echo [3/6] Limpiando builds anteriores...
if exist dist rmdir /s /q dist
if exist dist-electron rmdir /s /q dist-electron
echo Build anterior eliminado

echo.
echo [4/6] Compilando aplicacion React...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo la compilacion de React
    pause
    exit /b 1
)

echo.
echo [5/6] Creando ejecutable de Windows...
call npm run electron:build:win
if %errorlevel% neq 0 (
    echo ERROR: Fallo la creacion del ejecutable
    pause
    exit /b 1
)

echo.
echo [6/6] Build completado!
echo.
echo El instalador se encuentra en: frontend\dist-electron
echo.
echo Archivos generados:
dir dist-electron\*.exe /b
echo.
echo NOTA: Para probar la aplicacion antes de distribuir:
echo   1. Instala el .exe generado
echo   2. Asegurate que el backend este corriendo en http://localhost:8000
echo   3. Ejecuta TrakCare Offline
echo.
echo Si ves pantalla en blanco:
echo   - Presiona F12 para abrir DevTools
echo   - Revisa la consola para ver errores
echo   - Verifica que el backend este corriendo
echo.

pause
