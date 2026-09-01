import uuid
from datetime import date
from typing import Optional, Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.services import costos_service as svc
from app.services import audit_service

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
    purchase_date: Optional[date] = None
    image_url: Optional[str] = None


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
    purchase_date: Optional[date]
    image_url: Optional[str]
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


class ProductUsageRecord(BaseModel):
    patient_id: str
    patient_name: str
    date: str
    procedure_name: Optional[str]
    treatment_name: str
    qty_per_procedure: float
    procedure_quantity: int
    total_quantity: float
    transaction_id: str


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
    procedures_synced: int = 0

    class Config:
        from_attributes = True


class LotIn(BaseModel):
    opened_at: date
    expected_portions: Optional[float] = None
    notes: Optional[str] = None


class LotFinishIn(BaseModel):
    finished_at: date


class LotUpdateIn(BaseModel):
    opened_at: Optional[date] = None
    expected_portions: Optional[float] = None
    notes: Optional[str] = None


class LotOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    opened_at: date
    expected_portions: Optional[float]
    used_portions: float
    finished_at: Optional[date]
    notes: Optional[str]
    created_at: Any

    class Config:
        from_attributes = True


class CategoryRenameIn(BaseModel):
    from_category: str
    to_category: str


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
    obj = await svc.create_product(db, current_user.clinic_id, body.model_dump())
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="product.created", resource_type="cost_product", resource_id=str(obj.id),
        description=f"Agregó producto al catálogo: {obj.name}",
    )
    return obj


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
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="product.updated", resource_type="cost_product", resource_id=str(obj.id),
        description=f"Editó producto: {obj.name}",
    )
    return obj


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    products = await svc.get_products(db, current_user.clinic_id)
    target = next((p for p in products if p.id == product_id), None)
    ok = await svc.delete_product(db, current_user.clinic_id, product_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Producto no encontrado"})
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="product.deleted", resource_type="cost_product", resource_id=str(product_id),
        description=f"Eliminó producto: {target.name if target else product_id}",
    )


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
    action_label = "estableció stock" if body.operation == "set" else ("agregó" if body.qty >= 0 else "descontó")
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="product.stock_updated", resource_type="cost_product", resource_id=str(obj.id),
        description=f"Inventario: {action_label} {abs(body.qty):.2g} unidades de {obj.name} (stock actual: {obj.stock_qty:.2g})",
    )
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


# ─── Categories ───────────────────────────────────────────────────────────────

@router.post("/categories/rename", status_code=204)
async def rename_category(
    body: CategoryRenameIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if not body.from_category.strip() or not body.to_category.strip():
        raise HTTPException(status_code=400, detail={"code": "INVALID", "message": "Categorías no pueden estar vacías"})
    await svc.rename_category(db, current_user.clinic_id, body.from_category.strip(), body.to_category.strip())


@router.delete("/categories/{category}", status_code=204)
async def delete_category(
    category: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    reassign_to: str = "otros",
):
    await svc.delete_category(db, current_user.clinic_id, category, reassign_to)


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
    obj = await svc.create_treatment(db, current_user.clinic_id, data, apts)
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.created", resource_type="cost_treatment", resource_id=str(obj.id),
        description=f"Creó plantilla de tratamiento: {obj.name}",
    )
    return obj


@router.put("/treatments/{treatment_id}", response_model=TreatmentOut)
async def update_treatment(
    treatment_id: uuid.UUID,
    body: TreatmentUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    obj = await svc.update_treatment(db, current_user.clinic_id, treatment_id, updates)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento no encontrado"})
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.updated", resource_type="cost_treatment", resource_id=str(obj.id),
        description=f"Editó plantilla de tratamiento: {obj.name}",
    )
    return obj


@router.delete("/treatments/{treatment_id}", status_code=204)
async def delete_treatment(
    treatment_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    treatments = await svc.get_treatments(db, current_user.clinic_id)
    target = next((t for t in treatments if t.id == treatment_id), None)
    ok = await svc.delete_treatment(db, current_user.clinic_id, treatment_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento no encontrado"})
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.deleted", resource_type="cost_treatment", resource_id=str(treatment_id),
        description=f"Eliminó plantilla de tratamiento: {target.name if target else treatment_id}",
    )


@router.post("/treatments/{treatment_id}/duplicate", response_model=TreatmentOut, status_code=201)
async def duplicate_treatment(
    treatment_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.duplicate_treatment(db, current_user.clinic_id, treatment_id)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tratamiento no encontrado"})
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.duplicated", resource_type="cost_treatment", resource_id=str(obj.id),
        description=f"Duplicó plantilla de tratamiento: {obj.name}",
    )
    return obj


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
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.appointment_added", resource_type="cost_treatment", resource_id=str(treatment_id),
        description=f"Agregó nueva cita a tratamiento: {obj.name}",
    )
    return obj


@router.post("/treatments/{treatment_id}/appointments/{apt_id}/duplicate", response_model=TreatmentOut, status_code=201)
async def duplicate_appointment(
    treatment_id: uuid.UUID,
    apt_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.duplicate_appointment(db, current_user.clinic_id, treatment_id, apt_id)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Cita no encontrada"})
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.appointment_duplicated", resource_type="cost_treatment", resource_id=str(treatment_id),
        description=f"Duplicó cita en tratamiento: {obj.name}",
    )
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
    if "materials" in updates:
        apt = next((a for a in obj.appointments if a.id == apt_id), None)
        apt_name = apt.name if apt else "cita"
        await audit_service.log(
            db, clinic_id=current_user.clinic_id, user_id=current_user.id,
            action="treatment.materials_updated", resource_type="cost_treatment", resource_id=str(treatment_id),
            description=f"Actualizó materiales de \"{apt_name}\" en tratamiento: {obj.name}",
        )
    return obj


@router.delete("/treatments/{treatment_id}/appointments/{apt_id}", response_model=TreatmentOut)
async def delete_appointment(
    treatment_id: uuid.UUID,
    apt_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    treatments = await svc.get_treatments(db, current_user.clinic_id)
    target_t = next((t for t in treatments if t.id == treatment_id), None)
    target_a = next((a for a in target_t.appointments if a.id == apt_id), None) if target_t else None
    obj = await svc.delete_appointment(db, current_user.clinic_id, treatment_id, apt_id)
    if not obj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Cita no encontrada"})
    apt_label = f'"{target_a.name}" ' if target_a else ""
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.appointment_deleted", resource_type="cost_treatment", resource_id=str(treatment_id),
        description=f"Eliminó cita {apt_label}de tratamiento: {obj.name}",
    )
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
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="treatment.appointments_merged", resource_type="cost_treatment", resource_id=str(treatment_id),
        description=f"Fusionó citas en tratamiento: {obj.name}",
    )
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
    # Capture old values before update
    old_cfg = await svc.get_fixed_costs(db, current_user.clinic_id)
    old_patients = old_cfg.patients_per_month
    old_by_id = {str(item["id"]): dict(item) for item in (old_cfg.items or [])}

    config, synced = await svc.update_fixed_costs(
        db,
        current_user.clinic_id,
        body.patients_per_month,
        [i.model_dump() for i in body.items],
    )

    # Build diff
    new_by_id = {str(i.id): i for i in body.items}
    items_changed, items_added, items_removed = [], [], []

    for item_id, new_item in new_by_id.items():
        if item_id in old_by_id:
            old = old_by_id[item_id]
            change: dict = {}
            if old["name"] != new_item.name:
                change["name_from"] = old["name"]
            if float(old["amount"]) != float(new_item.amount):
                change["amount_from"] = float(old["amount"])
                change["amount_to"] = float(new_item.amount)
            if change:
                change["name"] = new_item.name
                items_changed.append(change)
        else:
            items_added.append({"name": new_item.name, "amount": float(new_item.amount)})

    for item_id, old in old_by_id.items():
        if item_id not in new_by_id:
            items_removed.append({"name": old["name"], "amount": float(old["amount"])})

    changes: dict = {}
    if old_patients != body.patients_per_month:
        changes["patients_per_month"] = {"from": old_patients, "to": body.patients_per_month}
    if items_changed:
        changes["items_changed"] = items_changed
    if items_added:
        changes["items_added"] = items_added
    if items_removed:
        changes["items_removed"] = items_removed

    # Build human-readable description
    parts = []
    if "patients_per_month" in changes:
        parts.append(f"Pacientes/mes: {old_patients} → {body.patients_per_month}")
    for c in items_changed:
        if "amount_from" in c:
            parts.append(f"{c['name']}: C$ {c['amount_from']:.2f} → C$ {c['amount_to']:.2f}")
        elif "name_from" in c:
            parts.append(f"Renombrado '{c['name_from']}' → '{c['name']}'")
    for c in items_added:
        parts.append(f"Agregado '{c['name']}': C$ {c['amount']:.2f}")
    for c in items_removed:
        parts.append(f"Eliminado '{c['name']}': C$ {c['amount']:.2f}")

    description = "Actualizó costos fijos" + (f": {'; '.join(parts)}" if parts else f" ({len(body.items)} conceptos, {body.patients_per_month} pacientes/mes)")

    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="fixed_costs.updated", resource_type="fixed_costs", resource_id=str(current_user.clinic_id),
        description=description,
        metadata=changes or None,
    )
    return {"patients_per_month": config.patients_per_month, "items": config.items, "procedures_synced": synced}


# ─── Product Lots ──────────────────────────────────────────────────────────────

@router.get("/products/{product_id}/lots", response_model=List[LotOut])
async def list_lots(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_lots(db, current_user.clinic_id, product_id)


@router.post("/products/{product_id}/lots", response_model=LotOut, status_code=201)
async def open_lot(
    product_id: uuid.UUID,
    body: LotIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    lot = await svc.open_lot(db, current_user.clinic_id, product_id, body.opened_at, body.expected_portions, body.notes)
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="lot.opened", resource_type="cost_product_lot", resource_id=str(lot.id),
        description=f"Abrió nuevo lote de producto (abierto: {body.opened_at})",
    )
    return lot


@router.patch("/products/{product_id}/lots/{lot_id}", response_model=LotOut)
async def update_lot(
    product_id: uuid.UUID,
    lot_id: uuid.UUID,
    body: LotUpdateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    lot = await svc.update_lot(db, current_user.clinic_id, lot_id, data)
    if not lot:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lote no encontrado"})
    return lot


@router.patch("/products/{product_id}/lots/{lot_id}/finish", response_model=LotOut)
async def finish_lot(
    product_id: uuid.UUID,
    lot_id: uuid.UUID,
    body: LotFinishIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    lot = await svc.finish_lot(db, current_user.clinic_id, lot_id, body.finished_at)
    if not lot:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lote no encontrado"})
    await audit_service.log(
        db, clinic_id=current_user.clinic_id, user_id=current_user.id,
        action="lot.finished", resource_type="cost_product_lot", resource_id=str(lot.id),
        description=f"Marcó lote como agotado (cerrado: {body.finished_at}, usado: {lot.used_portions:.2g} porciones)",
    )
    return lot


@router.delete("/products/{product_id}/lots/{lot_id}", status_code=204)
async def delete_lot(
    product_id: uuid.UUID,
    lot_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ok = await svc.delete_lot(db, current_user.clinic_id, lot_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lote no encontrado"})


@router.get("/products/{product_id}/patient-usage", response_model=List[ProductUsageRecord])
async def get_product_patient_usage(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_product_patient_usage(db, current_user.clinic_id, product_id)
