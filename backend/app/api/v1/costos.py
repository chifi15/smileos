import uuid
from typing import Optional, Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.services import costos_service as svc

router = APIRouter(prefix="/costos", tags=["Costos"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ProductIn(BaseModel):
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


class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    unit_price: float
    presentation: str
    portion_description: str
    supplier: Optional[str]
    notes: Optional[str]
    total_cost: Optional[float]
    presentation_qty: Optional[float]
    presentation_unit: Optional[str]
    portion_qty: Optional[float]
    stock_qty: Optional[float]
    min_stock_qty: Optional[float]
    sort_order: int

    class Config:
        from_attributes = True


class ReorderIn(BaseModel):
    ids: List[uuid.UUID]


class StockIn(BaseModel):
    qty: float
    operation: str = "set"


class MinStockIn(BaseModel):
    min_qty: Optional[float]


class AppointmentOut(BaseModel):
    id: uuid.UUID
    number: int
    name: str
    materials: List[Any]
    sort_order: int

    class Config:
        from_attributes = True


class TreatmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    professional_fee_per_hour: float
    total_hours: float
    fixed_costs: float
    clinic_margin_pct: float
    suggested_price: Optional[float]
    procedure_catalog_id: Optional[uuid.UUID]
    sort_order: int
    appointments: List[AppointmentOut]

    class Config:
        from_attributes = True


class AppointmentIn(BaseModel):
    number: int
    name: str
    materials: List[Any] = []


class TreatmentIn(BaseModel):
    name: str
    description: Optional[str] = None
    professional_fee_per_hour: float = 192.0
    total_hours: float = 1.0
    fixed_costs: float = 216.0
    clinic_margin_pct: float = 0.15
    suggested_price: Optional[float] = None
    appointments: List[AppointmentIn] = []


class TreatmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    professional_fee_per_hour: Optional[float] = None
    total_hours: Optional[float] = None
    fixed_costs: Optional[float] = None
    clinic_margin_pct: Optional[float] = None
    suggested_price: Optional[float] = None
    procedure_catalog_id: Optional[uuid.UUID] = None


class AppointmentUpdate(BaseModel):
    name: Optional[str] = None
    materials: Optional[List[Any]] = None


class MergeIn(BaseModel):
    target_id: uuid.UUID
    source_id: uuid.UUID


class FixedCostItemIn(BaseModel):
    id: str
    name: str
    amount: float


class FixedCostsIn(BaseModel):
    patients_per_month: int
    items: List[FixedCostItemIn]


class FixedCostsOut(BaseModel):
    patients_per_month: int
    items: List[Any]

    class Config:
        from_attributes = True


# ─── Products ─────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductOut])
async def list_products(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    products = await svc.get_products(db, current_user.clinic_id)
    return products


@router.post("/products", response_model=ProductOut, status_code=201)
async def create_product(
    body: ProductIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_product(db, current_user.clinic_id, body.model_dump())


@router.put("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    body: ProductIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.update_product(db, current_user.clinic_id, product_id, body.model_dump())
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Producto no encontrado"})
    return obj


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ok = await svc.delete_product(db, current_user.clinic_id, product_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Producto no encontrado"})


@router.post("/products/reorder", status_code=204)
async def reorder_products(
    body: ReorderIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await svc.reorder_products(db, current_user.clinic_id, body.ids)


@router.post("/products/{product_id}/stock", response_model=ProductOut)
async def update_stock(
    product_id: uuid.UUID,
    body: StockIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.update_product_stock(db, current_user.clinic_id, product_id, body.qty, body.operation)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Producto no encontrado"})
    return obj


@router.patch("/products/{product_id}/min-stock", response_model=ProductOut)
async def update_min_stock(
    product_id: uuid.UUID,
    body: MinStockIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.update_min_stock(db, current_user.clinic_id, product_id, body.min_qty)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Producto no encontrado"})
    return obj


# ─── Treatments ───────────────────────────────────────────────────────────────

@router.get("/treatments", response_model=List[TreatmentOut])
async def list_treatments(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_treatments(db, current_user.clinic_id)


@router.post("/treatments", response_model=TreatmentOut, status_code=201)
async def create_treatment(
    body: TreatmentIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude={"appointments"})
    apts = [a.model_dump() for a in body.appointments]
    return await svc.create_treatment(db, current_user.clinic_id, data, apts)


@router.put("/treatments/{treatment_id}", response_model=TreatmentOut)
async def update_treatment(
    treatment_id: uuid.UUID,
    body: TreatmentUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    obj = await svc.update_treatment(db, current_user.clinic_id, treatment_id, updates)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento no encontrado"})
    return obj


@router.delete("/treatments/{treatment_id}", status_code=204)
async def delete_treatment(
    treatment_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ok = await svc.delete_treatment(db, current_user.clinic_id, treatment_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento no encontrado"})


@router.post("/treatments/reorder", status_code=204)
async def reorder_treatments(
    body: ReorderIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await svc.reorder_treatments(db, current_user.clinic_id, body.ids)


@router.post("/treatments/{treatment_id}/appointments", response_model=TreatmentOut)
async def add_appointment(
    treatment_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.add_appointment(db, current_user.clinic_id, treatment_id)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento no encontrado"})
    return obj


@router.put("/treatments/{treatment_id}/appointments/{apt_id}", response_model=TreatmentOut)
async def update_appointment(
    treatment_id: uuid.UUID,
    apt_id: uuid.UUID,
    body: AppointmentUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    obj = await svc.update_appointment(db, current_user.clinic_id, treatment_id, apt_id, updates)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Cita no encontrada"})
    return obj


@router.delete("/treatments/{treatment_id}/appointments/{apt_id}", response_model=TreatmentOut)
async def delete_appointment(
    treatment_id: uuid.UUID,
    apt_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.delete_appointment(db, current_user.clinic_id, treatment_id, apt_id)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Cita no encontrada"})
    return obj


@router.post("/treatments/{treatment_id}/appointments/merge", response_model=TreatmentOut)
async def merge_appointments(
    treatment_id: uuid.UUID,
    body: MergeIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.merge_appointments(db, current_user.clinic_id, treatment_id, body.target_id, body.source_id)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento o citas no encontrados"})
    return obj


# ─── Fixed Costs ──────────────────────────────────────────────────────────────

@router.get("/fixed-costs", response_model=FixedCostsOut)
async def get_fixed_costs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    config = await svc.get_fixed_costs(db, current_user.clinic_id)
    return {"patients_per_month": config.patients_per_month, "items": config.items}


@router.put("/fixed-costs", response_model=FixedCostsOut)
async def update_fixed_costs(
    body: FixedCostsIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    config = await svc.update_fixed_costs(
        db,
        current_user.clinic_id,
        body.patients_per_month,
        [i.model_dump() for i in body.items],
    )
    return {"patients_per_month": config.patients_per_month, "items": config.items}
