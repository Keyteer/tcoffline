#!/bin/bash

set -e

echo ""
echo "================================================"
echo "TrakCare Offline Local - Backend Setup"
echo "================================================"
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 no encontrado"
    echo "        Por favor instala Python 3.12 o superior"
    exit 1
fi

python3 --version
echo ""

# [1/5] Crear entorno virtual
echo "[1/5] Creando entorno virtual..."
if [ -d "venv" ]; then
    echo "      Entorno virtual ya existe, eliminando..."
    rm -rf venv
fi
python3 -m venv venv

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "      OK - Entorno virtual creado"
else
    echo "[ERROR] No se pudo crear entorno virtual"
    exit 1
fi

# [2/5] Instalar dependencias Python
echo ""
echo "[2/5] Instalando dependencias Python..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] No se pudieron instalar dependencias"
    exit 1
fi
echo "      OK - Dependencias instaladas"

# [3/5] Configurar variables de entorno
echo ""
echo "[3/5] Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "      OK - Archivo .env creado"
else
    echo "      OK - Archivo .env ya existe"
fi

# [4/5] Crear base de datos con Alembic
echo ""
echo "[4/5] Creando base de datos con Alembic..."
if [ -f "local.db" ]; then
    echo "      Base de datos existente detectada, eliminando..."
    rm -f local.db local.db-shm local.db-wal 2>/dev/null || true
fi
alembic upgrade head
if [ $? -ne 0 ]; then
    echo "[ERROR] No se pudo crear la base de datos"
    exit 1
fi
echo "      OK - Base de datos creada"

# [5/5] Crear usuarios demo
echo ""
echo "[5/5] Creando usuarios demo..."
python init_demo_users.py
if [ $? -ne 0 ]; then
    echo "[ERROR] No se pudieron crear usuarios demo"
    exit 1
fi

echo ""
echo "================================================"
echo "Backend setup completado exitosamente!"
echo "================================================"
echo ""
echo "PROXIMOS PASOS:"
echo ""
echo "1. Iniciar el backend:"
echo "   source venv/bin/activate"
echo "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "2. API Docs: http://localhost:8000/docs"
echo ""
echo "CREDENCIALES DEMO:"
echo "   Usuario: admin"
echo "   Password: admin"
echo ""
echo "   Usuario: demo"
echo "   Password: demo"
echo ""
echo "================================================"
echo ""
