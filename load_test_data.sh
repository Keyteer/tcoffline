#!/bin/bash
# Script to load test data for TrakCare Offline Local
# Usage: ./load_test_data.sh

echo "==================================================================="
echo "  TrakCare Offline Local - Carga de Datos de Prueba"
echo "==================================================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "[1/3] Creando entorno virtual..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] No se pudo crear el entorno virtual."
        echo "        Instale python3-venv con: sudo apt install python3-venv"
        exit 1
    fi
    echo "      ✓ Entorno virtual creado"
fi

# Activate virtual environment and install dependencies
echo "[2/3] Instalando dependencias..."
source venv/bin/activate
pip install -q -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Error al instalar dependencias"
    deactivate
    exit 1
fi
echo "      ✓ Dependencias instaladas"

# Run the data loader script
echo "[3/3] Cargando datos de prueba..."
echo ""
python3 load_test_data.py
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Error al cargar datos de prueba"
    deactivate
    exit 1
fi

deactivate

echo ""
echo "==================================================================="
echo "  ✓ Proceso completado"
echo "==================================================================="
