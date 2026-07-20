import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.schemas.photo import PhotoType, PhotoUpdate
from app.services import photo_service

router = APIRouter(
    prefix="/patients/{patient_id}/photos",
    tags=["Fotografías y Media"],
)


def _serialize(p) -> dict:
    return {
        "id": str(p.id),
        "patient_id": str(p.patient_id),
        "appointment_id": str(p.appointment_id) if p.appointment_id else None,
        "photo_type": p.photo_type,
        "filename": p.filename,
        "mime_type": p.mime_type,
        "file_size_bytes": p.file_size_bytes,
        "caption": p.caption,
        "taken_at": p.taken_at.isoformat() if p.taken_at else None,
        "uploaded_by": {
            "id": str(p.uploaded_by.id),
            "full_name": p.uploaded_by.full_name,
        } if p.uploaded_by else None,
        "file_url": f"/api/v1/patients/{p.patient_id}/photos/{p.id}/file",
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("", status_code=201)
async def upload_photo(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    photo_type: PhotoType = Form(...),
    caption: str | None = Form(default=None),
    appointment_id: uuid.UUID | None = Form(default=None),
):
    photo = await photo_service.upload_photo(
        db,
        user.clinic_id,
        patient_id,
        user.id,
        file,
        photo_type,
        caption,
        appointment_id,
    )
    return {"success": True, "data": _serialize(photo)}


@router.get("")
async def list_photos(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
    photo_type: str | None = Query(default=None),
):
    photos = await photo_service.list_photos(db, user.clinic_id, patient_id, photo_type)
    return {"success": True, "data": [_serialize(p) for p in photos]}


@router.get("/{photo_id}")
async def get_photo(
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: Annotated[object, require_permission("view_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    photo = await photo_service.get_photo(db, user.clinic_id, patient_id, photo_id)
    return {"success": True, "data": _serialize(photo)}


@router.get("/{photo_id}/file")
async def get_photo_file(
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: Annotated[object, require_permission("view_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Sirve el archivo de imagen directamente (autenticado)."""
    photo = await photo_service.get_photo(db, user.clinic_id, patient_id, photo_id)
    from app.core import storage
    data = storage.read_file(photo.storage_path)
    return StreamingResponse(
        iter([data]),
        media_type=photo.mime_type,
        headers={"Content-Disposition": f'inline; filename="{photo.filename}"'},
    )


@router.patch("/{photo_id}")
async def update_photo(
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    body: PhotoUpdate,
    user: Annotated[object, require_permission("manage_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_unset=True)
    photo = await photo_service.update_photo(db, user.clinic_id, patient_id, photo_id, data)
    return {"success": True, "data": _serialize(photo)}


@router.delete("/{photo_id}", status_code=204)
async def delete_photo(
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await photo_service.delete_photo(db, user.clinic_id, patient_id, photo_id)
