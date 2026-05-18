#!/bin/bash

echo "========================================"
echo "TrakCare Offline - Build Electron App"
echo "========================================"
echo ""

echo "[1/4] Instalando dependencias..."
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo "ERROR: Fallo al instalar dependencias"
    exit 1
fi

echo ""
echo "[2/4] Compilando aplicacion React..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Fallo la compilacion de React"
    exit 1
fi

echo ""
echo "[3/4] Creando ejecutable de Windows..."
npm run electron:build:win
if [ $? -ne 0 ]; then
    echo "ERROR: Fallo la creacion del ejecutable"
    exit 1
fi

echo ""
echo "[4/4] Build completado!"
echo ""
echo "El instalador se encuentra en: frontend/dist-electron"
echo ""
echo "Archivos generados:"
ls -lh dist-electron/*.exe 2>/dev/null || echo "No se encontraron archivos .exe"
echo ""
