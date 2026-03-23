from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, users, episodes, hl7
from app.db import init_db

app = FastAPI(
    title="TrakCare Central Mock",
    description="Servicio central mock para recibir y procesar mensajes HL7 desde sistemas offline",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(health.router)
app.include_router(users.router)
app.include_router(episodes.router)
app.include_router(hl7.router)


@app.get("/")
def root():
    return {
        "message": "TrakCare Central Mock API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "health": "/central/health",
            "users": "/central/users",
            "episodes": "/central/episodes",
            "hl7": "/central/hl7"
        }
    }
