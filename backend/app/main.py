from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.redis import get_redis, close_redis

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_redis()
    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title="SmileOS API",
    description="Sistema operativo para clínicas dentales — LATAM",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Error interno del servidor.",
            },
        },
    )


@app.get("/health", tags=["Sistema"])
async def health_check():
    return {"success": True, "data": {"status": "ok", "version": "0.1.0"}}


# Los routers se registran aquí a medida que se implementan los módulos
# from app.api.v1 import auth, patients, appointments, ...
# app.include_router(auth.router, prefix="/api/v1")
