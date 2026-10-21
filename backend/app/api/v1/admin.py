"""
Panel de administración de plataforma — SmileOS.
Protegido por el header X-Admin-Secret (no requiere cuenta de usuario).
"""
import uuid
from datetime import datetime
from typing import Annotated, Optional, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.models.clinic import Clinic, ClinicSettings
from app.models.user import User
from app.models.patient import Patient
from app.models.costos import CostProduct, CostTreatment, FixedCostsConfig
from app.services import costos_service

settings = get_settings()

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Auth ─────────────────────────────────────────────────────────────────────

def _require_admin(x_admin_secret: str = Header(default="")) -> None:
    if not settings.admin_secret or x_admin_secret != settings.admin_secret:
        raise HTTPException(status_code=403, detail="Admin access required.")


AdminAuth = Depends(_require_admin)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PlanUpdate(BaseModel):
    plan: str
    plan_expires_at: Optional[datetime] = None


class AdminProductIn(BaseModel):
    name: str
    category: str = "otros"
    unit_price: float = 0.0
    presentation: str = ""
    portion_description: str = ""
    supplier: Optional[str] = None
    notes: Optional[str] = None
    total_cost: Optional[float] = None
    presentation_qty: Optional[float] = None
    presentation_unit: Optional[str] = None
    portion_qty: Optional[float] = None
    stock_qty: Optional[float] = None
    min_stock_qty: Optional[float] = None


class AdminProductBulkIn(BaseModel):
    products: list[AdminProductIn]


class AdminAppointmentIn(BaseModel):
    number: int
    name: str
    materials: list[Any] = []


class AdminTreatmentIn(BaseModel):
    name: str
    description: Optional[str] = None
    professional_fee_per_hour: float = 192.0
    total_hours: float = 1.0
    fixed_costs: float = 216.0
    clinic_margin_pct: float = 0.15
    suggested_price: Optional[float] = None
    appointments: list[AdminAppointmentIn] = []


class AdminFixedCostItemIn(BaseModel):
    id: str
    name: str
    amount: float


class AdminFixedCostsIn(BaseModel):
    patients_per_month: int = 40
    fee_per_hour: float = 192.0
    items: list[AdminFixedCostItemIn] = []


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/clinics")
async def list_clinics(
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Lista todas las clínicas registradas con métricas básicas."""
    clinics_result = await db.execute(
        select(Clinic).options(selectinload(Clinic.settings)).order_by(Clinic.created_at.desc())
    )
    clinics = list(clinics_result.scalars().all())

    # Patient count per clinic
    pt_rows = await db.execute(
        select(Patient.clinic_id, func.count(Patient.id).label("cnt"))
        .where(Patient.is_active == True)
        .group_by(Patient.clinic_id)
    )
    patient_counts = {str(r.clinic_id): r.cnt for r in pt_rows}

    # User + owner per clinic
    user_rows = await db.execute(
        select(User.clinic_id, User.email, User.role, func.count(User.id).over(partition_by=User.clinic_id).label("total"))
        .where(User.is_active == True)
    )
    user_data: dict[str, dict] = {}
    for row in user_rows:
        cid = str(row.clinic_id)
        if cid not in user_data:
            user_data[cid] = {"count": row.total, "owner_email": None}
        if row.role == "clinic_owner" and not user_data[cid]["owner_email"]:
            user_data[cid]["owner_email"] = row.email

    rows = []
    for c in clinics:
        cid = str(c.id)
        ud = user_data.get(cid, {})
        rows.append({
            "id": cid,
            "name": c.name,
            "slug": c.slug,
            "plan": c.plan,
            "plan_expires_at": c.plan_expires_at.isoformat() if c.plan_expires_at else None,
            "is_active": c.is_active,
            "patient_count": patient_counts.get(cid, 0),
            "user_count": ud.get("count", 0),
            "owner_email": ud.get("owner_email"),
            "display_name": c.settings.display_name if c.settings else c.name,
            "created_at": c.created_at.isoformat(),
        })
    return {"success": True, "data": rows}


@router.get("/clinics/{clinic_id}")
async def get_clinic(
    clinic_id: uuid.UUID,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Detalle completo de una clínica para el panel de admin."""
    clinic = await db.scalar(select(Clinic).where(Clinic.id == clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clínica no encontrada.")

    products_result = await db.execute(
        select(CostProduct).where(CostProduct.clinic_id == clinic_id).order_by(CostProduct.category, CostProduct.name)
    )
    products = [
        {
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "unit_price": p.unit_price,
            "presentation": p.presentation,
            "presentation_unit": p.presentation_unit,
            "stock_qty": p.stock_qty,
            "min_stock_qty": p.min_stock_qty,
        }
        for p in products_result.scalars().all()
    ]

    treatments_result = await db.execute(
        select(CostTreatment).where(CostTreatment.clinic_id == clinic_id).order_by(CostTreatment.name)
    )
    treatments = [
        {
            "id": str(t.id),
            "name": t.name,
            "professional_fee_per_hour": t.professional_fee_per_hour,
            "total_hours": t.total_hours,
            "suggested_price": t.suggested_price,
        }
        for t in treatments_result.scalars().all()
    ]

    fixed_costs = await costos_service.get_fixed_costs(db, clinic_id)
    await db.commit()

    return {
        "success": True,
        "data": {
            "products": products,
            "treatments": treatments,
            "fixed_costs": {
                "patients_per_month": fixed_costs.patients_per_month,
                "fee_per_hour": fixed_costs.fee_per_hour,
                "items": fixed_costs.items or [],
            },
        },
    }


@router.patch("/clinics/{clinic_id}/plan")
async def update_plan(
    clinic_id: uuid.UUID,
    body: PlanUpdate,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cambia el plan de una clínica."""
    clinic = await db.scalar(select(Clinic).where(Clinic.id == clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="Clínica no encontrada.")
    clinic.plan = body.plan
    clinic.plan_expires_at = body.plan_expires_at
    await db.commit()
    return {"success": True, "data": {"plan": clinic.plan, "plan_expires_at": clinic.plan_expires_at}}


@router.post("/clinics/{clinic_id}/products", status_code=201)
async def add_product(
    clinic_id: uuid.UUID,
    body: AdminProductIn,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Agrega un producto al inventario de la clínica."""
    data = body.model_dump()
    obj = await costos_service.create_product(db, clinic_id, data)
    await db.commit()
    return {"success": True, "data": {"id": str(obj.id), "name": obj.name}}


@router.post("/clinics/{clinic_id}/products/bulk", status_code=201)
async def add_products_bulk(
    clinic_id: uuid.UUID,
    body: AdminProductBulkIn,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Agrega varios productos a la vez al inventario de la clínica."""
    created = []
    for product_data in body.products:
        obj = await costos_service.create_product(db, clinic_id, product_data.model_dump())
        created.append({"id": str(obj.id), "name": obj.name})
    await db.commit()
    return {"success": True, "data": created}


@router.delete("/clinics/{clinic_id}/products/{product_id}", status_code=204)
async def delete_product(
    clinic_id: uuid.UUID,
    product_id: uuid.UUID,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Elimina un producto del inventario de la clínica."""
    product = await db.scalar(
        select(CostProduct).where(CostProduct.id == product_id, CostProduct.clinic_id == clinic_id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    await db.delete(product)
    await db.commit()


@router.post("/clinics/{clinic_id}/treatments", status_code=201)
async def add_treatment(
    clinic_id: uuid.UUID,
    body: AdminTreatmentIn,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Agrega un tratamiento de costos a la clínica."""
    data = body.model_dump(exclude={"appointments"})
    apts = [a.model_dump() for a in body.appointments]
    obj = await costos_service.create_treatment(db, clinic_id, data, apts)
    await db.commit()
    return {"success": True, "data": {"id": str(obj.id), "name": obj.name}}


@router.delete("/clinics/{clinic_id}/treatments/{treatment_id}", status_code=204)
async def delete_treatment(
    clinic_id: uuid.UUID,
    treatment_id: uuid.UUID,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Elimina un tratamiento de costos de la clínica."""
    treatment = await db.scalar(
        select(CostTreatment).where(CostTreatment.id == treatment_id, CostTreatment.clinic_id == clinic_id)
    )
    if not treatment:
        raise HTTPException(status_code=404, detail="Tratamiento no encontrado.")
    await db.delete(treatment)
    await db.commit()


@router.put("/clinics/{clinic_id}/fixed-costs")
async def set_fixed_costs(
    clinic_id: uuid.UUID,
    body: AdminFixedCostsIn,
    _: Annotated[None, AdminAuth],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Establece costos fijos y honorarios de la clínica."""
    items_dicts = [i.model_dump() for i in body.items]
    await costos_service.update_fixed_costs(db, clinic_id, body.patients_per_month, items_dicts)
    await costos_service.update_honorarios(db, clinic_id, body.fee_per_hour)
    await db.commit()
    return {"success": True, "data": {"patients_per_month": body.patients_per_month, "fee_per_hour": body.fee_per_hour}}
