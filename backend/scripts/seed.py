"""
Script de seed: crea la clínica demo, usuario owner y procedimientos del catálogo.
Uso: python -m scripts.seed
"""
import asyncio
import uuid
from datetime import time

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import get_settings
from app.core.security import hash_password
from app.models import (
    Clinic, ClinicSettings, WorkingHours,
    User, ProcedureCatalog,
)

settings = get_settings()

engine = create_async_engine(settings.database_url)
AsyncSession_ = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

WORKING_HOURS_DEFAULT = [
    # (day_of_week, is_working, morn_open, morn_close, aft_open, aft_close)
    (0, False, None, None, None, None),        # Domingo
    (1, True, time(8, 0), time(12, 0), time(14, 0), time(18, 0)),  # Lunes
    (2, True, time(8, 0), time(12, 0), time(14, 0), time(18, 0)),  # Martes
    (3, True, time(8, 0), time(12, 0), time(14, 0), time(18, 0)),  # Miércoles
    (4, True, time(8, 0), time(12, 0), time(14, 0), time(18, 0)),  # Jueves
    (5, True, time(8, 0), time(12, 0), time(14, 0), time(18, 0)),  # Viernes
    (6, True, time(8, 0), time(12, 0), None, None),                # Sábado
]

PROCEDURES_SEED = [
    ("Consulta General", "CONS-001", "preventivo", 30, None),
    ("Limpieza Dental (Profilaxis)", "LIMP-001", "preventivo", 45, None),
    ("Extracción Simple", "EXTR-001", "quirurgico", 30, None),
    ("Extracción Compleja / Cordal", "EXTR-002", "quirurgico", 60, None),
    ("Obturación (Resina)", "OBT-001", "restaurativo", 45, None),
    ("Endodoncia Unirradicular", "ENDO-001", "endodoncia", 60, None),
    ("Endodoncia Multirradicular", "ENDO-002", "endodoncia", 90, None),
    ("Corona Unitaria", "PROT-001", "protesis", 60, None),
    ("Blanqueamiento Dental", "BLAN-001", "estetico", 60, None),
    ("Ortodoncia - Instalación", "ORT-001", "ortodoncia", 90, None),
    ("Emergencia Dental", "EMER-001", "emergencia", 30, None),
]


async def seed():
    async with AsyncSession_() as session:
        async with session.begin():
            # 1. Clínica
            clinic_id = uuid.uuid4()
            clinic = Clinic(
                id=clinic_id,
                name="Clínica Dental SmileOS",
                slug="smileos-masaya",
                is_active=True,
            )
            session.add(clinic)

            # 2. Configuración de la clínica
            clinic_settings = ClinicSettings(
                clinic_id=clinic_id,
                display_name="Clínica Dental SmileOS",
                legal_name="Clínica Dental SmileOS",
                city="Masaya",
                country="NI",
                currency_code="NIO",
                currency_symbol="C$",
                default_appointment_duration_minutes=30,
                appointment_slot_size_minutes=15,
            )
            session.add(clinic_settings)

            # 3. Horarios de trabajo
            for day, is_working, m_open, m_close, a_open, a_close in WORKING_HOURS_DEFAULT:
                wh = WorkingHours(
                    clinic_id=clinic_id,
                    day_of_week=day,
                    is_working_day=is_working,
                    morning_open=m_open,
                    morning_close=m_close,
                    afternoon_open=a_open,
                    afternoon_close=a_close,
                )
                session.add(wh)

            # 4. Usuario owner
            owner = User(
                clinic_id=clinic_id,
                email="admin@smileos.ni",
                password_hash=hash_password("SmileOS2026!"),
                full_name="Dr. Admin SmileOS",
                role="clinic_owner",
                is_active=True,
                must_change_password=True,
            )
            session.add(owner)

            # 5. Catálogo de procedimientos
            for name, code, category, duration, price in PROCEDURES_SEED:
                proc = ProcedureCatalog(
                    clinic_id=clinic_id,
                    name=name,
                    code=code,
                    category=category,
                    default_duration_minutes=duration,
                    default_price=price,
                    is_active=True,
                    is_system=True,
                )
                session.add(proc)

        print("✓ Seed completado.")
        print(f"  Clínica ID : {clinic_id}")
        print(f"  Email      : admin@smileos.ni")
        print(f"  Contraseña : SmileOS2026!  (cambiar en primer login)")


if __name__ == "__main__":
    asyncio.run(seed())
