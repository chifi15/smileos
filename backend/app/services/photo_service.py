import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.photo import PatientPhoto, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.core import storage
from app.core.exceptions import NotFoundError, ValidationError

_MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

_LOAD_OPTIONS = [
    selectinload(PatientPhoto.uploaded_by),
]


async def _get_photo(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, photo_id: uuid.UUID
) -> PatientPhoto:
    result = await db.execute(
        select(PatientPhoto)
        .where(
            PatientPhoto.id == photo_id,
            PatientPhoto.clinic_id == clinic_id,
            PatientPhoto.patient_id == patient_id,
            PatientPhoto.is_active == True,  # noqa: E712
        )
        .options(*_LOAD_OPTIONS)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise NotFoundError("Fotografía")
    return photo


async def _verify_patient(db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Patient.id).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    if not result.scalar_one_or_none():
        raise NotFoundError("Paciente")


async def upload_photo(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    uploaded_by_id: uuid.UUID,
    file: UploadFile,
    photo_type: str,
    caption: str | None,
    appointment_id: uuid.UUID | None,
    taken_at_date: date | None = None,
) -> PatientPhoto:
    await _verify_patient(db, clinic_id, patient_id)

    # Validar MIME
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            f"Tipo de archivo no permitido: {file.content_type}. "
            f"Formatos aceptados: JPEG, PNG, WebP."
        )

    data = await file.read()

    # Validar tamaño
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            f"El archivo excede el tamaño máximo de {MAX_FILE_SIZE_BYTES // (1024*1024)} MB."
        )

    # Validar que la cita, si se indica, pertenece al paciente de esta clínica
    if appointment_id:
        appt_result = await db.execute(
            select(Appointment.id).where(
                Appointment.id == appointment_id,
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == patient_id,
            )
        )
        if not appt_result.scalar_one_or_none():
            raise ValidationError("La cita indicada no pertenece a este paciente.")

    photo_id = uuid.uuid4()
    ext = _MIME_TO_EXT[file.content_type]
    storage_path = storage.build_storage_path(clinic_id, patient_id, photo_id, ext)

    storage.save_file(storage_path, data)

    if taken_at_date:
        taken_at = datetime(taken_at_date.year, taken_at_date.month, taken_at_date.day, tzinfo=timezone.utc)
    else:
        taken_at = datetime.now(timezone.utc)

    photo = PatientPhoto(
        id=photo_id,
        clinic_id=clinic_id,
        patient_id=patient_id,
        uploaded_by_id=uploaded_by_id,
        appointment_id=appointment_id,
        photo_type=photo_type,
        storage_path=storage_path,
        filename=file.filename or f"{photo_id}.{ext}",
        mime_type=file.content_type,
        file_size_bytes=len(data),
        caption=caption,
        taken_at=taken_at,
    )
    db.add(photo)
    await db.flush()
    return await _get_photo(db, clinic_id, patient_id, photo_id)


async def list_photos(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    photo_type: str | None = None,
) -> list[PatientPhoto]:
    await _verify_patient(db, clinic_id, patient_id)
    q = select(PatientPhoto).where(
        PatientPhoto.clinic_id == clinic_id,
        PatientPhoto.patient_id == patient_id,
        PatientPhoto.is_active == True,  # noqa: E712
    )
    if photo_type:
        q = q.where(PatientPhoto.photo_type == photo_type)
    q = q.options(*_LOAD_OPTIONS).order_by(PatientPhoto.sort_order.asc(), PatientPhoto.taken_at.desc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_photo(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, photo_id: uuid.UUID
) -> PatientPhoto:
    return await _get_photo(db, clinic_id, patient_id, photo_id)


async def update_photo(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    data: dict,
) -> PatientPhoto:
    photo = await _get_photo(db, clinic_id, patient_id, photo_id)

    if "appointment_id" in data and data["appointment_id"] is not None:
        appt_result = await db.execute(
            select(Appointment.id).where(
                Appointment.id == data["appointment_id"],
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == patient_id,
            )
        )
        if not appt_result.scalar_one_or_none():
            raise ValidationError("La cita indicada no pertenece a este paciente.")

    for k, v in data.items():
        setattr(photo, k, v)

    await db.flush()
    return await _get_photo(db, clinic_id, patient_id, photo_id)


async def delete_photo(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, photo_id: uuid.UUID
) -> None:
    photo = await _get_photo(db, clinic_id, patient_id, photo_id)
    photo.is_active = False
    # El archivo físico se mantiene; se puede hacer un GC periódico en versiones futuras.


async def get_photo_file_path(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, photo_id: uuid.UUID
) -> Path:
    photo = await _get_photo(db, clinic_id, patient_id, photo_id)
    path = storage.get_local_path(photo.storage_path)
    if not path.exists():
        raise NotFoundError("Archivo de fotografía")
    return path


async def reorder_photos(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    photo_ids: list[uuid.UUID],
) -> None:
    await _verify_patient(db, clinic_id, patient_id)
    for i, photo_id in enumerate(photo_ids):
        result = await db.execute(
            select(PatientPhoto).where(
                PatientPhoto.id == photo_id,
                PatientPhoto.clinic_id == clinic_id,
                PatientPhoto.patient_id == patient_id,
                PatientPhoto.is_active == True,  # noqa: E712
            )
        )
        photo = result.scalar_one_or_none()
        if photo:
            photo.sort_order = i
    await db.flush()
