#!/bin/bash

set -e

echo ""
echo "================================================"
echo "TrakCare Offline Local - Frontend Setup"
echo "================================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js no encontrado"
    echo "        Por favor instala Node.js 18 o superior"
    echo "        Descarga: https://nodejs.org/"
    exit 1
fi

node --version
npm --version
echo ""

# [1/3] Configurar variables de entorno
echo "[1/3] Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "      OK - Archivo .env creado"
else
    echo "      OK - Archivo .env ya existe"
fi

# [2/3] Instalar dependencias
echo ""
echo "[2/3] Instalando dependencias..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] No se pudieron instalar dependencias"
    exit 1
fi
echo "      OK - Dependencias instaladas"

# [3/3] Arreglar vulnerabilidades
echo ""
echo "[3/3] Arreglando vulnerabilidades..."
npm audit fix --force
echo "      OK - Vulnerabilidades procesadas"

echo ""
echo "================================================"
echo "Frontend setup completado exitosamente!"
echo "================================================"
echo ""
echo "PROXIMOS PASOS:"
echo ""
echo "1. Asegurate de que el backend este corriendo en http://localhost:8000"
echo ""
echo "2. Iniciar el frontend:"
echo "   npm run dev"
echo ""
echo "3. Acceder a la aplicacion:"
echo "   Frontend: http://localhost:5173"
echo ""
echo "================================================"
echo ""
