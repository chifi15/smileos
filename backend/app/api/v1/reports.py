from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission, RequirePaidPlan
from app.services import reports_service

router = APIRouter(prefix="/reports", tags=["Reportes"], dependencies=[RequirePaidPlan])


@router.get("/finances/summary")
async def finances_summary(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int = Query(...),
):
    data = await reports_service.get_full_summary(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/monthly-trend")
async def monthly_trend(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
):
    data = await reports_service.get_monthly_trend(db, user.clinic_id, year)
    return {"success": True, "data": data}


@router.get("/finances/top-procedures")
async def top_procedures(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_procedures(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/top-procedures-quoted")
async def top_procedures_quoted(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_procedures_quoted(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/top-expenses")
async def top_expenses(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_expenses(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/by-doctor")
async def by_doctor(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_doctor_report(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/top-patients")
async def top_patients(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    from app.services.finance_service import get_income_by_patient
    data = await get_income_by_patient(db, user.clinic_id, year, month)
    return {"success": True, "data": data[:10]}


@router.get("/finances/materials-by-month")
async def materials_by_month(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
):
    data = await reports_service.get_materials_by_month(db, user.clinic_id, year)
    return {"success": True, "data": data}


@router.get("/finances/income-detail")
async def income_detail(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_income_detail(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/expense-detail")
async def expense_detail(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_expense_detail(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/op-costs-breakdown")
async def op_costs_breakdown(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_op_costs_breakdown(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/material-usage")
async def material_usage(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    product_id: str = Query(...),
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    import uuid as _uuid
    data = await reports_service.get_material_usage(
        db, user.clinic_id, _uuid.UUID(product_id), year, month
    )
    return {"success": True, "data": data}


@router.get("/finances/top-materials")
async def top_materials(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_materials(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/drilldown")
async def drilldown(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    kind: str = Query(..., pattern="^(doctor|treatment|patient|expense)$"),
    key: str = Query(...),
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    from fastapi import HTTPException
    try:
        data = await reports_service.get_drilldown(db, user.clinic_id, kind, key, year, month)
    except ValueError:
        raise HTTPException(status_code=422, detail="Parámetros inválidos")
    return {"success": True, "data": data}


@router.get("/finances/budget-vs-actual")
async def budget_vs_actual(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_budget_vs_actual(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.put("/finances/budget-link")
async def budget_link(
    body: dict,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    import uuid as _uuid
    from fastapi import HTTPException
    fixed_id = str(body.get("fixed_cost_id") or "")
    cat = body.get("category_id")
    if not fixed_id:
        raise HTTPException(status_code=422, detail="fixed_cost_id requerido")
    try:
        cat_id = _uuid.UUID(cat) if cat else None
    except ValueError:
        raise HTTPException(status_code=422, detail="category_id inválido")
    ok = await reports_service.set_budget_link(db, user.clinic_id, fixed_id, cat_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return {"success": True}


@router.get("/finances/doctor-account")
async def doctor_account(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_doctor_account(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.put("/finances/doctor-commission")
async def doctor_commission(
    body: dict,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    import uuid as _uuid
    from fastapi import HTTPException
    try:
        doctor_id = _uuid.UUID(str(body.get("doctor_id")))
        raw = body.get("pct")
        pct = None if raw in (None, "") else float(raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Datos inválidos")
    if pct is not None and not (0 <= pct <= 100):
        raise HTTPException(status_code=422, detail="El porcentaje debe estar entre 0 y 100")
    ok = await reports_service.set_doctor_commission(db, user.clinic_id, doctor_id, pct)
    if not ok:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return {"success": True}


@router.get("/finances/distribution")
async def distribution(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_distribution(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.put("/finances/distribution-config")
async def distribution_config(
    body: dict,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from fastapi import HTTPException
    try:
        rep = float(body.get("reposicion_pct"))
        mej = float(body.get("mejoras_pct"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Datos inválidos")
    if not (0 <= rep <= 100 and 0 <= mej <= 100 and rep + mej <= 100):
        raise HTTPException(status_code=422, detail="Los porcentajes deben estar entre 0 y 100 y sumar máximo 100")
    await reports_service.set_distribution_config(db, user.clinic_id, rep, mej)
    return {"success": True}
