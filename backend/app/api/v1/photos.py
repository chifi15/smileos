import asyncio
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Form, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.exceptions import NotFoundError
from app.schemas.photo import PhotoType, PhotoUpdate, PhotoReorderRequest
from app.services import photo_service, audit_service

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
        "sort_order": p.sort_order,
        "pdf_edit": p.pdf_edit,
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
    taken_at: date | None = Form(default=None),
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
        taken_at_date=taken_at,
    )
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="photo.uploaded", resource_type="photo", resource_id=str(photo.id),
        description=f'Subió fotografía tipo "{photo_type}"',
        patient_id=patient_id,
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


@router.put("/reorder")
async def reorder_photos(
    patient_id: uuid.UUID,
    body: PhotoReorderRequest,
    user: Annotated[object, require_permission("manage_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await photo_service.reorder_photos(db, user.clinic_id, patient_id, body.order)
    return {"success": True}


@router.get("/{photo_id}")
async def get_photo(
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: Annotated[object, require_permission("view_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    photo = await photo_service.get_photo(db, user.clinic_id, patient_id, photo_id)
    return {"success": True, "data": _serialize(photo)}


_THUMB_WIDTHS = (200, 400, 800)
# Una miniatura a la vez: el servidor tiene solo 512 MB de RAM y varias en paralelo lo reiniciaban.
_THUMB_LOCK = asyncio.Semaphore(1)


def _make_thumb(data: bytes, width: int) -> bytes:
    """Reduce la imagen a `width` px de ancho máximo (JPEG liviano). Respeta la orientación EXIF."""
    import io
    from PIL import Image, ImageOps

    img = Image.open(io.BytesIO(data))
    if img.format == "JPEG":
        # Decodifica el JPEG ya reducido (usa una fracción de la memoria: clave en 512 MB de RAM).
        img.draft("RGB", (width * 2, width * 2))
    img = ImageOps.exif_transpose(img)
    img.thumbnail((width, width * 4), reducing_gap=2.0)
    if img.mode not in ("RGB", "L"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        alpha = img.convert("RGBA")
        bg.paste(alpha, mask=alpha.split()[-1])
        img = bg
    out = io.BytesIO()
    img.convert("RGB").save(out, "JPEG", quality=78, optimize=True)
    return out.getvalue()


@router.get("/{photo_id}/file")
async def get_photo_file(
    patient_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: Annotated[object, require_permission("view_photos")],
    db: Annotated[AsyncSession, Depends(get_db)],
    w: int | None = Query(default=None, ge=1, le=4000, description="Ancho máximo de la miniatura"),
):
    """Sirve el archivo de imagen directamente (autenticado). Con ?w= devuelve una miniatura liviana."""
    from fastapi.concurrency import run_in_threadpool
    from app.core import storage

    photo = await photo_service.get_photo(db, user.clinic_id, patient_id, photo_id)
    headers = {
        "Content-Disposition": f'inline; filename="{photo.filename}"',
        # Las fotos no cambian: el navegador puede reutilizarlas sin volver a pedirlas.
        "Cache-Control": "private, max-age=86400",
    }

    if w:
        width = next((t for t in _THUMB_WIDTHS if w <= t), _THUMB_WIDTHS[-1])
        thumb_path = f"{photo.storage_path}.w{width}.jpg"
        try:
            if await run_in_threadpool(storage.file_exists, thumb_path):
                thumb = await run_in_threadpool(storage.read_file, thumb_path)
            else:
                async with _THUMB_LOCK:
                    original = await run_in_threadpool(storage.read_file, photo.storage_path)
                    thumb = await run_in_threadpool(_make_thumb, original, width)
                    del original
                await run_in_threadpool(storage.save_file, thumb_path, thumb)
            return StreamingResponse(iter([thumb]), media_type="image/jpeg", headers=headers)
        except (FileNotFoundError, OSError):
            raise NotFoundError("Archivo de fotografía")
        except Exception:
            pass  # si falla la miniatura, se sirve el original

    try:
        data = await run_in_threadpool(storage.read_file, photo.storage_path)
    except (FileNotFoundError, OSError):
        raise NotFoundError("Archivo de fotografía")
    return StreamingResponse(iter([data]), media_type=photo.mime_type, headers=headers)


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
    photo = await photo_service.get_photo(db, user.clinic_id, patient_id, photo_id)
    photo_type = photo.photo_type
    await photo_service.delete_photo(db, user.clinic_id, patient_id, photo_id)
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="photo.deleted", resource_type="photo", resource_id=str(photo_id),
        description=f'Eliminó fotografía tipo "{photo_type}"',
        patient_id=patient_id,
    )
