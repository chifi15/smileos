from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import get_settings
from app.core.redis import get_redis, close_redis
from app.core.exceptions import SmileOSException

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await get_redis()
    except Exception:
        pass  # Redis is optional; app runs without it
    yield
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


@app.exception_handler(SmileOSException)
async def smileos_exception_handler(request: Request, exc: SmileOSException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {}
    message = first_error.get("msg", "Error de validación.").replace("Value error, ", "")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": message},
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": "Error interno del servidor."},
        },
    )


@app.get("/health", tags=["Sistema"])
async def health_check():
    return {"success": True, "data": {"status": "ok", "version": "0.1.0"}}


# Routers
from app.api.v1 import auth, patients, appointments, catalog, treatments, dashboard, photos, odontogram, finances  # noqa: E402
from app.api.v1.odontogram import quote_router  # noqa: E402
from app.api.v1.settings import settings_router, users_router  # noqa: E402
from app.api.v1.rewards import router as rewards_router, levels_router  # noqa: E402
app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(rewards_router, prefix="/api/v1")
app.include_router(levels_router, prefix="/api/v1")
app.include_router(catalog.router, prefix="/api/v1")
app.include_router(treatments.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(photos.router, prefix="/api/v1")
app.include_router(odontogram.router, prefix="/api/v1")
app.include_router(quote_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(finances.router, prefix="/api/v1")
