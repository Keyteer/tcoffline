#!/bin/bash

echo ""
echo "TrakCare Central Mock - Setup Script"
echo "====================================="
echo ""

if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 no encontrado. Por favor instala Python 3.11 o superior."
    exit 1
fi

python3 --version
echo ""

echo "Creando entorno virtual..."
python3 -m venv venv

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "Entorno virtual creado y activado"
else
    echo "Error al crear entorno virtual"
    exit 1
fi

echo ""
echo "Instalando dependencias..."
python -m pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "Dependencias instaladas"

echo ""
if [ ! -f ".env" ]; then
    echo "Configurando variables de entorno..."
    cp .env.example .env
    echo "Archivo .env creado desde .env.example"
else
    echo "Archivo .env ya existe"
fi

echo ""
echo "Inicializando base de datos..."
python -c "from app.db import init_db; init_db(); print('Base de datos inicializada')"

echo ""
echo "Setup completado!"
echo ""
echo "Para iniciar el servidor, ejecuta:"
echo ""
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8001"
echo ""
echo "Luego visita: http://localhost:8001/docs"
echo ""
