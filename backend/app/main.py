from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, sos

app = FastAPI(title="Project Guardian API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(sos.router, prefix="/sos", tags=["sos"])
