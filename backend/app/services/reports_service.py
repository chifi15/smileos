import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, case
from sqlalchemy.orm import selectinload
from app.models.finance import FinanceTransaction
from app.models.patient import Patient
from app.models.treatment import ProcedureCatalog, TreatmentPlanItem
from app.models.user import User

MONTH_NAMES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]


async def get_monthly_trend(db: AsyncSession, clinic_id: uuid.UUID, year: int) -> list[dict]:
    rows = await db.execute(
        select(
            extract("month", FinanceTransaction.transaction_date).label("month"),
            func.sum(
                case((FinanceTransaction.type == "ingreso", FinanceTransaction.amount_cordobas), else_=0)
            ).label("ingresos"),
            func.sum(
                case((FinanceTransaction.type == "egreso", FinanceTransaction.amount_cordobas), else_=0)
            ).label("egresos"),
            func.sum(
                case(
                    (
                        (FinanceTransaction.type == "ingreso") & (FinanceTransaction.operational_cost_snapshot.isnot(None)),
                        FinanceTransaction.operational_cost_snapshot,
                    ),
                    else_=0,
                )
            ).label("costos_op"),
        )
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            extract("year", FinanceTransaction.transaction_date) == year,
        )
        .group_by(extract("month", FinanceTransaction.transaction_date))
        .order_by(extract("month", FinanceTransaction.transaction_date))
    )
    by_month: dict[int, dict] = {
        m: {"month": m, "mes": MONTH_NAMES[m], "ingresos": 0.0, "egresos": 0.0, "utilidad": 0.0}
        for m in range(1, 13)
    }
    for r in rows:
        m = int(r.month)
        ingresos = float(r.ingresos or 0)
        egresos = float(r.egresos or 0)
        costos_op = float(r.costos_op or 0)
        by_month[m]["ingresos"] = round(ingresos, 2)
        by_month[m]["egresos"] = round(egresos, 2)
        by_month[m]["utilidad"] = round(ingresos - egresos - costos_op, 2)
    return list(by_month.values())


async def get_top_procedures(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.procedure_id.isnot(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.procedure_id,
            ProcedureCatalog.name.label("procedure_name"),
            func.sum(FinanceTransaction.amount_cordobas).label("total"),
            func.sum(FinanceTransaction.procedure_quantity).label("quantity"),
        )
        .join(ProcedureCatalog, ProcedureCatalog.id == FinanceTransaction.procedure_id)
        .where(*filters)
        .group_by(FinanceTransaction.procedure_id, ProcedureCatalog.name)
        .order_by(func.sum(FinanceTransaction.amount_cordobas).desc())
        .limit(10)
    )
    return [
        {
            "procedure_id": str(r.procedure_id),
            "procedure_name": r.procedure_name,
            "total": round(float(r.total), 2),
            "quantity": int(r.quantity or 0),
        }
        for r in rows
    ]


async def get_top_procedures_quoted(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    """Procedimientos más cotizados en planes de tratamiento."""
    rows = await db.execute(
        select(
            TreatmentPlanItem.procedure_id,
            ProcedureCatalog.name.label("procedure_name"),
            func.count(TreatmentPlanItem.id).label("quoted"),
            func.sum(TreatmentPlanItem.quoted_price).label("total_cotizado"),
        )
        .join(ProcedureCatalog, ProcedureCatalog.id == TreatmentPlanItem.procedure_id)
        .where(TreatmentPlanItem.clinic_id == clinic_id)
        .group_by(TreatmentPlanItem.procedure_id, ProcedureCatalog.name)
        .order_by(func.count(TreatmentPlanItem.id).desc())
        .limit(10)
    )
    return [
        {
            "procedure_id": str(r.procedure_id),
            "procedure_name": r.procedure_name,
            "quoted": int(r.quoted),
            "total_cotizado": round(float(r.total_cotizado or 0), 2),
        }
        for r in rows
    ]


async def get_top_expenses(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "egreso",
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.category,
            func.sum(FinanceTransaction.amount_cordobas).label("total"),
            func.count(FinanceTransaction.id).label("count"),
        )
        .where(*filters)
        .group_by(FinanceTransaction.category)
        .order_by(func.sum(FinanceTransaction.amount_cordobas).desc())
    )
    results = [
        {
            "category": r.category,
            "total": round(float(r.total), 2),
            "count": int(r.count),
        }
        for r in rows
    ]
    grand_total = sum(r["total"] for r in results)
    for r in results:
        r["pct"] = round(r["total"] / grand_total * 100, 1) if grand_total > 0 else 0.0
    return results


async def get_doctor_report(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.doctor_id,
            User.full_name.label("doctor_name"),
            func.sum(FinanceTransaction.amount_cordobas).label("ingresos"),
            func.count(FinanceTransaction.id).label("transacciones"),
            func.sum(FinanceTransaction.operational_cost_snapshot).label("costos_op"),
        )
        .outerjoin(User, User.id == FinanceTransaction.doctor_id)
        .where(*filters)
        .group_by(FinanceTransaction.doctor_id, User.full_name)
        .order_by(func.sum(FinanceTransaction.amount_cordobas).desc())
    )
    return [
        {
            "doctor_id": str(r.doctor_id) if r.doctor_id else None,
            "doctor_name": r.doctor_name or "Sin doctor",
            "ingresos": round(float(r.ingresos or 0), 2),
            "transacciones": int(r.transacciones),
            "costos_op": round(float(r.costos_op or 0), 2),
        }
        for r in rows
    ]


async def get_full_summary(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int,
) -> dict:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        extract("year", FinanceTransaction.transaction_date) == year,
        extract("month", FinanceTransaction.transaction_date) == month,
    ]
    row = await db.execute(
        select(
            func.sum(
                case((FinanceTransaction.type == "ingreso", FinanceTransaction.amount_cordobas), else_=0)
            ).label("ingresos"),
            func.sum(
                case((FinanceTransaction.type == "egreso", FinanceTransaction.amount_cordobas), else_=0)
            ).label("egresos"),
            func.sum(
                case(
                    (
                        (FinanceTransaction.type == "ingreso") & (FinanceTransaction.operational_cost_snapshot.isnot(None)),
                        FinanceTransaction.operational_cost_snapshot,
                    ),
                    else_=0,
                )
            ).label("costos_op"),
            func.count(
                case((FinanceTransaction.type == "ingreso", FinanceTransaction.id))
            ).label("n_ingresos"),
            func.count(
                case((FinanceTransaction.type == "egreso", FinanceTransaction.id))
            ).label("n_egresos"),
        )
        .where(*filters)
    )
    r = row.one()
    ingresos = float(r.ingresos or 0)
    egresos = float(r.egresos or 0)
    costos_op = float(r.costos_op or 0)
    utilidad = ingresos - egresos - costos_op
    margen = round(utilidad / ingresos * 100, 1) if ingresos > 0 else 0.0
    return {
        "ingresos_brutos": round(ingresos, 2),
        "egresos": round(egresos, 2),
        "costos_operativos": round(costos_op, 2),
        "ingreso_neto": round(ingresos - egresos, 2),
        "utilidad_neta": round(utilidad, 2),
        "margen_pct": margen,
        "count_ingresos": int(r.n_ingresos),
        "count_egresos": int(r.n_egresos),
    }


async def get_income_detail(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(FinanceTransaction)
        .where(*filters)
        .options(
            selectinload(FinanceTransaction.patient),
            selectinload(FinanceTransaction.procedure),
            selectinload(FinanceTransaction.doctor),
        )
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
        .limit(100)
    )
    txs = list(rows.scalars().all())
    return [
        {
            "id": str(t.id),
            "date": t.transaction_date.isoformat(),
            "patient_name": t.patient.full_name if t.patient else None,
            "procedure_name": t.procedure.name if t.procedure else None,
            "doctor_name": t.doctor.full_name if t.doctor else None,
            "description": t.description,
            "amount": float(t.amount_cordobas),
        }
        for t in txs
    ]


async def get_expense_detail(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    from app.models.finance import ExpenseCategory

    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "egreso",
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(FinanceTransaction)
        .where(*filters)
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
        .limit(100)
    )
    txs = list(rows.scalars().all())

    cat_rows = await db.execute(
        select(ExpenseCategory.key, ExpenseCategory.label)
        .where(ExpenseCategory.clinic_id == clinic_id)
    )
    cat_labels: dict[str, str] = {r.key: r.label for r in cat_rows}

    return [
        {
            "id": str(t.id),
            "date": t.transaction_date.isoformat(),
            "category": t.category,
            "category_label": cat_labels.get(t.category, t.category),
            "description": t.description,
            "amount": float(t.amount_cordobas),
            "invoice_number": t.invoice_number,
        }
        for t in txs
    ]


async def get_op_costs_breakdown(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.operational_cost_snapshot.isnot(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.procedure_id,
            ProcedureCatalog.name.label("procedure_name"),
            func.count(FinanceTransaction.id).label("count"),
            func.sum(FinanceTransaction.operational_cost_snapshot).label("total"),
            func.avg(FinanceTransaction.operational_cost_snapshot).label("avg"),
        )
        .outerjoin(ProcedureCatalog, ProcedureCatalog.id == FinanceTransaction.procedure_id)
        .where(*filters)
        .group_by(FinanceTransaction.procedure_id, ProcedureCatalog.name)
        .order_by(func.sum(FinanceTransaction.operational_cost_snapshot).desc())
    )
    return [
        {
            "procedure_id": str(r.procedure_id) if r.procedure_id else None,
            "procedure_name": r.procedure_name or "Sin procedimiento",
            "count": int(r.count),
            "avg_op_cost": round(float(r.avg or 0), 2),
            "total_op_cost": round(float(r.total or 0), 2),
        }
        for r in rows
    ]


async def get_top_materials(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    from app.models.costos import CostTreatment, CostProduct

    # 1. Treatments linked to a procedure in the catalog
    result = await db.execute(
        select(CostTreatment)
        .where(
            CostTreatment.clinic_id == clinic_id,
            CostTreatment.procedure_catalog_id.isnot(None),
        )
        .options(selectinload(CostTreatment.appointments))
    )
    treatments = list(result.scalars().all())
    if not treatments:
        return []

    # 2. Map procedure_catalog_id -> {productId -> total_qty_per_procedure}
    proc_to_materials: dict[str, dict[str, float]] = {}
    for treatment in treatments:
        proc_str = str(treatment.procedure_catalog_id)
        merged: dict[str, float] = {}
        for apt in treatment.appointments:
            for mat in (apt.materials or []):
                pid = mat.get("productId")
                qty = float(mat.get("quantity", 0))
                if pid and qty > 0:
                    merged[pid] = merged.get(pid, 0.0) + qty
        if merged:
            # Accumulate across treatments that share the same procedure
            existing = proc_to_materials.get(proc_str, {})
            for pid, qty in merged.items():
                existing[pid] = existing.get(pid, 0.0) + qty
            proc_to_materials[proc_str] = existing

    if not proc_to_materials:
        return []

    # 3. Finance transactions for those procedures in the requested period
    proc_ids = [uuid.UUID(pid) for pid in proc_to_materials.keys()]
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.procedure_id.in_(proc_ids),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    tx_result = await db.execute(select(FinanceTransaction).where(*filters))
    transactions = list(tx_result.scalars().all())
    if not transactions:
        return []

    # 4. Aggregate units per product
    material_units: dict[str, float] = {}
    for tx in transactions:
        proc_str = str(tx.procedure_id)
        mats = proc_to_materials.get(proc_str, {})
        proc_qty = tx.procedure_quantity or 1
        for pid, qty_per_proc in mats.items():
            material_units[pid] = material_units.get(pid, 0.0) + qty_per_proc * proc_qty

    # 5. Load product details
    product_ids = [uuid.UUID(pid) for pid in material_units.keys()]
    prod_result = await db.execute(
        select(CostProduct).where(
            CostProduct.clinic_id == clinic_id,
            CostProduct.id.in_(product_ids),
        )
    )
    products = {str(p.id): p for p in prod_result.scalars().all()}

    # 6. Build result list
    rows = []
    for pid, total_units in material_units.items():
        product = products.get(pid)
        if not product:
            continue
        total_units_r = round(total_units, 4)
        total_cost = round(total_units_r * (product.unit_price or 0.0), 2)
        rows.append({
            "product_id": pid,
            "name": product.name,
            "category": product.category,
            "unit_price": product.unit_price or 0.0,
            "total_units": total_units_r,
            "total_cost": total_cost,
        })

    rows.sort(key=lambda x: x["total_units"], reverse=True)
    return rows[:20]
