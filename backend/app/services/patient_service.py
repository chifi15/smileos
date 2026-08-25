import unicodedata
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update, text


def _normalize(text: str) -> str:
    """Strip accents and lowercase for accent-insensitive comparison."""
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii").lower()
from sqlalchemy.orm import selectinload

from sqlalchemy import delete as sa_delete
from app.core.database import engine

from app.models.patient import Patient
from app.models.rewards import RewardsAccount, RewardsTransaction
from app.models.odontogram import OdontogramTooth, OdontogramSnapshot, TreatmentQuote
from app.models.treatment import TreatmentPlan, TreatmentPlanItem
from app.models.appointment import Appointment
from app.models.clinical_record import ClinicalRecord
from app.models.finance import FinanceTransaction
from app.models.photo import PatientPhoto
from app.schemas.patient import PatientCreate, PatientUpdate
from app.core.exceptions import NotFoundError, ConflictError


async def create_patient(
    db: AsyncSession, clinic_id: uuid.UUID, data: PatientCreate
) -> Patient:
    max_num = await db.scalar(
        select(func.max(Patient.patient_number)).where(Patient.clinic_id == clinic_id)
    )
    next_number = (max_num or 0) + 1

    patient = Patient(
        clinic_id=clinic_id,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        id_number=data.id_number,
        phone=data.phone,
        phone_secondary=data.phone_secondary,
        email=data.email,
        address=data.address,
        city=data.city,
        country=data.country,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        blood_type=data.blood_type,
        allergies=data.allergies,
        medical_conditions=data.medical_conditions,
        current_medications=data.current_medications,
        chief_complaint=data.chief_complaint,
        referred_by_patient_id=data.referred_by_patient_id,
        patient_number=next_number,
        notes=data.notes,
    )
    db.add(patient)
    await db.flush()

    db.add(RewardsAccount(
        clinic_id=clinic_id,
        patient_id=patient.id,
        total_points=0,
        level="starter",
    ))
    await db.flush()

    # Re-fetch con relaciones cargadas para evitar lazy-load en contexto async
    return await get_patient(db, clinic_id, patient.id)


async def get_patient(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> Patient:
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.rewards_account))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundError("Paciente")
    return patient


async def list_patients(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    search: str | None = None,
    level: str | None = None,
    active_only: bool = True,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Patient], int]:
    base = (
        select(Patient)
        .options(selectinload(Patient.rewards_account))
        .where(Patient.clinic_id == clinic_id)
    )

    if active_only:
        base = base.where(Patient.is_active == True)

    if search:
        term = f"%{_normalize(search.strip())}%"
        base = base.where(
            or_(
                func.lower(func.unaccent(Patient.first_name + " " + Patient.last_name)).like(term),
                Patient.phone.like(f"%{search.strip()}%"),
                func.lower(func.unaccent(func.coalesce(Patient.email, ""))).like(term),
                Patient.id_number.like(f"%{search.strip()}%"),
            )
        )

    if level:
        base = base.join(RewardsAccount, Patient.id == RewardsAccount.patient_id).where(
            RewardsAccount.level == level
        )

    # Contar total antes de paginar
    count_q = select(func.count()).select_from(base.subquery())
    total: int = await db.scalar(count_q) or 0

    # Ordenar y paginar
    base = base.order_by(Patient.patient_number.asc().nullslast())
    base = base.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(base)
    patients = list(result.scalars().all())

    return patients, total


async def update_patient(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    data: PatientUpdate,
) -> Patient:
    patient = await get_patient(db, clinic_id, patient_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    await db.flush()
    # Re-fetch para obtener timestamps actualizados y relaciones cargadas
    return await get_patient(db, clinic_id, patient_id)


async def set_referral(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    referrer_patient_id: uuid.UUID | None,
) -> tuple[Patient, bool]:
    """
    Asigna o limpia el referidor del paciente.
    Retorna (patient_actualizado, puntos_otorgados).
    Los puntos se otorgan solo si es la primera vez (referred_by_patient_id era None).
    """
    from app.core.exceptions import ValidationError
    from app.services import rewards_service

    if referrer_patient_id is not None and referrer_patient_id == patient_id:
        raise ValidationError("Un paciente no puede referirse a sí mismo.")

    patient = await get_patient(db, clinic_id, patient_id)
    was_none = patient.referred_by_patient_id is None
    is_new_referrer = referrer_patient_id != patient.referred_by_patient_id

    if not is_new_referrer:
        return patient, False

    # Validar que el referidor pertenece a la misma clínica
    if referrer_patient_id is not None:
        referrer = await db.execute(
            select(Patient).where(
                Patient.id == referrer_patient_id,
                Patient.clinic_id == clinic_id,
                Patient.is_active == True,  # noqa: E712
            )
        )
        if not referrer.scalar_one_or_none():
            raise ValidationError("El paciente referidor no existe o no está activo.")

    patient.referred_by_patient_id = referrer_patient_id
    await db.flush()

    # Solo otorgamos puntos si es la primera asignación
    points_awarded = False
    if referrer_patient_id is not None and was_none:
        await rewards_service.grant_referral_bonus(db, clinic_id, referrer_patient_id)
        points_awarded = True

    return await get_patient(db, clinic_id, patient_id), points_awarded


async def deactivate_patient(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> None:
    patient = await get_patient(db, clinic_id, patient_id)
    patient.is_active = False
    await db.flush()


async def delete_patient_permanent(
    clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> None:
    """Elimina el paciente y todos sus registros vinculados en orden seguro."""
    pid = {"pid": patient_id}
    async with engine.begin() as conn:
        # Existencia verificada aquí para no tocar la sesión ORM en absoluto.
        row = await conn.execute(
            text("SELECT 1 FROM patients WHERE id = :pid AND clinic_id = :cid LIMIT 1"),
            {"pid": patient_id, "cid": clinic_id},
        )
        if not row.first():
            raise NotFoundError("Paciente")
        # Primero lo que referencia appointments (FK sin ondelete → deben ir antes)
        await conn.execute(text("DELETE FROM clinical_records WHERE patient_id = :pid"), pid)
        await conn.execute(
            text("DELETE FROM rewards_transactions WHERE account_id IN (SELECT id FROM rewards_accounts WHERE patient_id = :pid)"),
            pid,
        )
        await conn.execute(text("DELETE FROM patient_photos WHERE patient_id = :pid"), pid)
        await conn.execute(
            text("DELETE FROM treatment_plan_items WHERE treatment_plan_id IN (SELECT id FROM treatment_plans WHERE patient_id = :pid)"),
            pid,
        )
        # Ahora appointments es seguro (ningún hijo lo referencia ya)
        await conn.execute(text("DELETE FROM appointments WHERE patient_id = :pid"), pid)
        # Resto de tablas hijas del paciente
        await conn.execute(text("DELETE FROM treatment_plans WHERE patient_id = :pid"), pid)
        await conn.execute(text("DELETE FROM odontogram_teeth WHERE patient_id = :pid"), pid)
        await conn.execute(text("DELETE FROM odontogram_snapshots WHERE patient_id = :pid"), pid)
        await conn.execute(text("DELETE FROM treatment_quotes WHERE patient_id = :pid"), pid)
        await conn.execute(text("DELETE FROM patient_evolutions WHERE patient_id = :pid"), pid)
        await conn.execute(text("DELETE FROM rewards_accounts WHERE patient_id = :pid"), pid)
        await conn.execute(text("UPDATE finance_transactions SET patient_id = NULL WHERE patient_id = :pid"), pid)
        await conn.execute(text("UPDATE patients SET referred_by_patient_id = NULL WHERE referred_by_patient_id = :pid"), pid)
        await conn.execute(text("DELETE FROM patients WHERE id = :pid"), pid)
    # engine.begin() hace commit automático al salir del bloque (o rollback si hay error)


async def get_patient_segments(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Segmenta pacientes activos en 3 categorías de reactivación."""
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=182)
    twelve_months_ago = now - timedelta(days=365)

    sql = text("""
        WITH last_visit AS (
            SELECT patient_id, MAX(completed_at) AS last_completed
            FROM appointments
            WHERE clinic_id = :cid AND status = 'completed'
            GROUP BY patient_id
        ),
        incomplete_tx AS (
            SELECT DISTINCT tp.patient_id
            FROM treatment_plans tp
            JOIN treatment_plan_items tpi ON tpi.treatment_plan_id = tp.id
            WHERE tp.clinic_id = :cid
              AND tp.status IN ('active', 'on_hold')
              AND tpi.status NOT IN ('completed', 'cancelled')
        )
        SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.phone,
            p.patient_number,
            p.first_visit_date,
            lv.last_completed AS last_visit,
            CASE WHEN itx.patient_id IS NOT NULL THEN true ELSE false END AS has_incomplete_treatment
        FROM patients p
        LEFT JOIN last_visit lv ON lv.patient_id = p.id
        LEFT JOIN incomplete_tx itx ON itx.patient_id = p.id
        WHERE p.clinic_id = :cid AND p.is_active = true
        ORDER BY p.patient_number ASC NULLS LAST
    """)

    result = await db.execute(sql, {"cid": str(clinic_id)})
    rows = result.fetchall()

    incomplete_treatment: list[dict] = []
    pending_review: list[dict] = []
    dormant: list[dict] = []

    for row in rows:
        patient_data = {
            "id": str(row.id),
            "full_name": f"{row.first_name} {row.last_name}",
            "phone": row.phone,
            "patient_number": row.patient_number,
            "last_visit": row.last_visit.isoformat() if row.last_visit else None,
            "first_visit_date": row.first_visit_date.isoformat() if row.first_visit_date else None,
        }

        if row.has_incomplete_treatment:
            incomplete_treatment.append(patient_data)
            continue

        last_known = row.last_visit
        if last_known is None and row.first_visit_date:
            from datetime import date as _date
            last_known = datetime(
                row.first_visit_date.year,
                row.first_visit_date.month,
                row.first_visit_date.day,
                tzinfo=timezone.utc,
            )

        if last_known is None or last_known < twelve_months_ago:
            dormant.append(patient_data)
        elif last_known < six_months_ago:
            pending_review.append(patient_data)

    return {
        "incomplete_treatment": {"count": len(incomplete_treatment), "patients": incomplete_treatment},
        "pending_review": {"count": len(pending_review), "patients": pending_review},
        "dormant": {"count": len(dormant), "patients": dormant},
    }


async def search_patients_simple(
    db: AsyncSession, clinic_id: uuid.UUID, q: str, limit: int = 10
) -> list[Patient]:
    """Búsqueda rápida para autocompletar. Si q está vacío retorna los más recientes."""
    base_q = (
        select(Patient)
        .options(selectinload(Patient.rewards_account))
        .where(Patient.clinic_id == clinic_id, Patient.is_active == True)
    )
    if q.strip():
        term = f"%{_normalize(q.strip())}%"
        base_q = base_q.where(
            or_(
                func.lower(func.unaccent(Patient.first_name + " " + Patient.last_name)).like(term),
                Patient.phone.like(f"%{q.strip()}%"),
            )
        ).order_by(Patient.first_name, Patient.last_name)
    else:
        base_q = base_q.order_by(Patient.created_at.desc())
    result = await db.execute(base_q.limit(limit))
    return list(result.scalars().all())
