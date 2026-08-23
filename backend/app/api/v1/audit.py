import uuid
import math
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["Auditoría"])

RESOURCE_TYPE_LABELS: dict[str, str] = {
    "patient": "Paciente",
    "appointment": "Cita",
    "treatment_plan": "Plan de tratamiento",
    "treatment_item": "Ítem de tratamiento",
    "odontogram": "Odontograma",
    "evolution": "Evolución clínica",
    "finance": "Finanzas",
    "reward": "Smile Rewards",
    "photo": "Fotografía",
    "settings": "Configuración",
    "user": "Usuario",
    "cost_product": "Producto",
    "cost_treatment": "Costos operativos",
    "cost_product_lot": "Lote de producto",
    "fixed_costs": "Costos fijos",
    "procedure_catalog": "Precios de catálogo",
}


def _serialize(entry) -> dict:
    return {
        "id": str(entry.id),
        "action": entry.action,
        "resource_type": entry.resource_type,
        "resource_type_label": RESOURCE_TYPE_LABELS.get(entry.resource_type or "", entry.resource_type or ""),
        "resource_id": entry.resource_id,
        "description": entry.description,
        "changes": entry.changes,
        "patient_id": str(entry.patient_id) if entry.patient_id else None,
        "user": {
            "id": str(entry.user.id),
            "full_name": entry.user.full_name,
        } if entry.user else None,
        "created_at": entry.created_at.isoformat(),
    }


@router.get("")
async def get_audit_feed(
    user: Annotated[object, require_permission("view_settings")],
    db: Annotated[AsyncSession, Depends(get_db)],
    resource_type: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
):
    entries, total = await audit_service.list_feed(
        db,
        clinic_id=user.clinic_id,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    return {
        "success": True,
        "data": [_serialize(e) for e in entries],
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": math.ceil(total / per_page) if total else 0,
        },
    }


@router.get("/patients/{patient_id}")
async def get_patient_history(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    resource_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
):
    entries, total = await audit_service.list_feed(
        db,
        clinic_id=user.clinic_id,
        patient_id=patient_id,
        resource_type=resource_type,
        page=page,
        per_page=per_page,
    )
    return {
        "success": True,
        "data": [_serialize(e) for e in entries],
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": math.ceil(total / per_page) if total else 0,
        },
    }
