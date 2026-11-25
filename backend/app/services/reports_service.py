import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, case
from sqlalchemy.orm import selectinload
from app.models.finance import FinanceTransaction
from app.models.patient import Patient
from app.models.costos import CostTreatment as _CT
from app.models.user import User

MONTH_NAMES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]


async def _covered_expr(db: AsyncSession, clinic_id: uuid.UUID):
    """Expresión SQL: monto de egresos en categorías ya cubiertas por costos operativos (no se restan de la utilidad)."""
    from app.services.finance_service import get_covered_category_keys
    keys = await get_covered_category_keys(db, clinic_id)
    if not keys:
        return func.coalesce(func.sum(case((FinanceTransaction.id.is_(None), 0), else_=0)), 0)
    return func.sum(
        case(
            (
                (FinanceTransaction.type == "egreso") & (FinanceTransaction.category.in_(list(keys))),
                FinanceTransaction.amount_cordobas,
            ),
            else_=0,
        )
    )


async def get_monthly_trend(db: AsyncSession, clinic_id: uuid.UUID, year: int) -> list[dict]:
    covered = await _covered_expr(db, clinic_id)
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
            covered.label("cubiertos"),
        )
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            FinanceTransaction.deleted_at.is_(None),
            extract("year", FinanceTransaction.transaction_date) == year,
        )
        .group_by(extract("month", FinanceTransaction.transaction_date))
        .order_by(extract("month", FinanceTransaction.transaction_date))
    )
    by_month: dict[int, dict] = {
        m: {"month": m, "mes": MONTH_NAMES[m], "ingresos": 0.0, "egresos": 0.0, "costos_op": 0.0, "utilidad": 0.0}
        for m in range(1, 13)
    }
    for r in rows:
        m = int(r.month)
        ingresos = float(r.ingresos or 0)
        egresos = float(r.egresos or 0)
        costos_op = float(r.costos_op or 0)
        cubiertos = float(r.cubiertos or 0)
        by_month[m]["ingresos"] = round(ingresos, 2)
        by_month[m]["egresos"] = round(egresos, 2)
        by_month[m]["costos_op"] = round(costos_op, 2)
        by_month[m]["utilidad"] = round(ingresos - (egresos - cubiertos) - costos_op, 2)
    return list(by_month.values())


async def get_top_procedures(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.cost_treatment_id.isnot(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.cost_treatment_id,
            _CT.name.label("procedure_name"),
            func.sum(FinanceTransaction.amount_cordobas).label("total"),
            func.sum(FinanceTransaction.procedure_quantity).label("quantity"),
        )
        .join(_CT, _CT.id == FinanceTransaction.cost_treatment_id)
        .where(*filters)
        .group_by(FinanceTransaction.cost_treatment_id, _CT.name)
        .order_by(func.sum(FinanceTransaction.amount_cordobas).desc())
        .limit(10)
    )
    return [
        {
            "procedure_id": str(r.cost_treatment_id),
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
    """Procedimientos más frecuentes en transacciones de finanzas."""
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.cost_treatment_id.isnot(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.cost_treatment_id,
            _CT.name.label("procedure_name"),
            func.count(FinanceTransaction.id).label("quoted"),
            func.sum(FinanceTransaction.amount_cordobas).label("total_cotizado"),
        )
        .join(_CT, _CT.id == FinanceTransaction.cost_treatment_id)
        .where(*filters)
        .group_by(FinanceTransaction.cost_treatment_id, _CT.name)
        .order_by(func.count(FinanceTransaction.id).desc())
        .limit(10)
    )
    return [
        {
            "procedure_id": str(r.cost_treatment_id),
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
    from app.models.finance import ExpenseCategory

    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
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

    cat_rows = await db.execute(
        select(ExpenseCategory.key, ExpenseCategory.label, ExpenseCategory.covered_by_op_costs)
        .where(ExpenseCategory.clinic_id == clinic_id)
    )
    cat_rows = list(cat_rows)
    cat_labels: dict[str, str] = {r.key: r.label for r in cat_rows}
    covered_keys = {r.key for r in cat_rows if r.covered_by_op_costs}

    results = [
        {
            "category": r.category,
            "category_label": cat_labels.get(r.category, r.category),
            "covered": r.category in covered_keys,
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
        FinanceTransaction.deleted_at.is_(None),
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
    covered = await _covered_expr(db, clinic_id)
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
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
            covered.label("cubiertos"),
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
    cubiertos = float(r.cubiertos or 0)
    utilidad = ingresos - (egresos - cubiertos) - costos_op
    margen = round(utilidad / ingresos * 100, 1) if ingresos > 0 else 0.0
    return {
        "ingresos_brutos": round(ingresos, 2),
        "egresos": round(egresos, 2),
        "egresos_cubiertos": round(cubiertos, 2),
        "costos_operativos": round(costos_op, 2),
        "ingreso_neto": round(ingresos - egresos, 2),
        "utilidad_neta": round(utilidad, 2),
        "margen_pct": margen,
        "count_ingresos": int(r.n_ingresos),
        "count_egresos": int(r.n_egresos),
    }


async def get_materials_by_month(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
) -> list[dict]:
    """Returns, for each month of the year, the list of materials used with units and cost."""
    from app.models.costos import CostTreatment, CostProduct

    # Build procedure -> {productId -> qty_per_procedure} map
    result = await db.execute(
        select(CostTreatment)
        .where(
            CostTreatment.clinic_id == clinic_id,
        )
        .options(selectinload(CostTreatment.appointments))
    )
    treatments = list(result.scalars().all())
    if not treatments:
        return []

    proc_to_materials: dict[str, dict[str, float]] = {}
    for treatment in treatments:
        proc_str = str(treatment.id)
        merged: dict[str, float] = {}
        for apt in treatment.appointments:
            for mat in (apt.materials or []):
                pid = mat.get("productId")
                qty = float(mat.get("quantity", 0))
                if pid and qty > 0:
                    merged[pid] = merged.get(pid, 0.0) + qty
        if merged:
            existing = proc_to_materials.get(proc_str, {})
            for pid, qty in merged.items():
                existing[pid] = existing.get(pid, 0.0) + qty
            proc_to_materials[proc_str] = existing

    if not proc_to_materials:
        return []

    # Load product details (name, category, unit_price)
    all_product_ids = {pid for mats in proc_to_materials.values() for pid in mats}
    prod_result = await db.execute(
        select(CostProduct).where(
            CostProduct.clinic_id == clinic_id,
            CostProduct.id.in_([uuid.UUID(p) for p in all_product_ids]),
        )
    )
    products: dict[str, CostProduct] = {str(p.id): p for p in prod_result.scalars().all()}

    # Load all relevant transactions for the year
    proc_ids = [uuid.UUID(p) for p in proc_to_materials.keys()]
    tx_result = await db.execute(
        select(FinanceTransaction)
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            FinanceTransaction.deleted_at.is_(None),
            FinanceTransaction.type == "ingreso",
            FinanceTransaction.cost_treatment_id.in_(proc_ids),
            extract("year", FinanceTransaction.transaction_date) == year,
        )
    )
    transactions = list(tx_result.scalars().all())

    # Aggregate per month per product
    # by_month[month_int][product_id] = total_units
    by_month: dict[int, dict[str, float]] = {m: {} for m in range(1, 13)}
    for tx in transactions:
        m = int(tx.transaction_date.month)
        proc_qty = tx.procedure_quantity or 1
        if tx.deducted_materials:
            # Usar exactamente los materiales deducidos (ya son per-cita)
            for mat in tx.deducted_materials:
                pid = mat.get("productId")
                qty = float(mat.get("qty") or 0)
                if pid and qty > 0:
                    by_month[m][pid] = by_month[m].get(pid, 0.0) + qty * proc_qty
        else:
            proc_str = str(tx.cost_treatment_id)
            mats = proc_to_materials.get(proc_str, {})
            for pid, qty_per_proc in mats.items():
                by_month[m][pid] = by_month[m].get(pid, 0.0) + qty_per_proc * proc_qty

    # Build result — only include months that have data
    result_months = []
    for m in range(1, 13):
        month_mats = by_month[m]
        if not month_mats:
            continue
        rows = []
        for pid, total_units in month_mats.items():
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
        result_months.append({
            "month": m,
            "mes": MONTH_NAMES[m],
            "materials": rows,
            "total_units": round(sum(r["total_units"] for r in rows), 4),
            "total_cost": round(sum(r["total_cost"] for r in rows), 2),
        })

    return result_months


async def get_income_detail(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
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
            selectinload(FinanceTransaction.cost_treatment),
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
            "procedure_name": t.procedure_display_name,
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
        FinanceTransaction.deleted_at.is_(None),
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
        FinanceTransaction.deleted_at.is_(None),
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.operational_cost_snapshot.isnot(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.cost_treatment_id,
            _CT.name.label("procedure_name"),
            func.count(FinanceTransaction.id).label("count"),
            func.sum(FinanceTransaction.operational_cost_snapshot).label("total"),
            func.avg(FinanceTransaction.operational_cost_snapshot).label("avg"),
        )
        .outerjoin(_CT, _CT.id == FinanceTransaction.cost_treatment_id)
        .where(*filters)
        .group_by(FinanceTransaction.cost_treatment_id, _CT.name)
        .order_by(func.sum(FinanceTransaction.operational_cost_snapshot).desc())
    )
    return [
        {
            "procedure_id": str(r.cost_treatment_id) if r.cost_treatment_id else None,
            "procedure_name": r.procedure_name or "Sin procedimiento",
            "count": int(r.count),
            "avg_op_cost": round(float(r.avg or 0), 2),
            "total_op_cost": round(float(r.total or 0), 2),
        }
        for r in rows
    ]


async def get_material_usage(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    product_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> dict:
    from app.models.costos import CostTreatment, CostProduct

    pid_str = str(product_id)

    # Load product info
    prod_result = await db.execute(
        select(CostProduct).where(CostProduct.id == product_id, CostProduct.clinic_id == clinic_id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        return {"product_name": "Desconocido", "category": "", "unit_price": 0.0, "usages": []}

    # Build full proc -> {pid -> qty} template map (fallback for txs without deducted_materials)
    tpl_result = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.clinic_id == clinic_id)
        .options(selectinload(CostTreatment.appointments))
    )
    proc_to_materials: dict[str, dict[str, float]] = {}
    for treatment in tpl_result.scalars().all():
        proc_str = str(treatment.id)
        merged: dict[str, float] = {}
        for apt in treatment.appointments:
            for mat in (apt.materials or []):
                p = mat.get("productId")
                q = float(mat.get("quantity", 0))
                if p and q > 0:
                    merged[p] = merged.get(p, 0.0) + q
        if merged:
            existing = proc_to_materials.get(proc_str, {})
            for p, q in merged.items():
                existing[p] = existing.get(p, 0.0) + q
            proc_to_materials[proc_str] = existing

    # Load all products for name resolution
    all_prods_result = await db.execute(
        select(CostProduct).where(CostProduct.clinic_id == clinic_id)
    )
    all_products: dict[str, CostProduct] = {str(p.id): p for p in all_prods_result.scalars().all()}

    # Query ALL ingreso transactions for the period — filter by product in Python.
    # We do NOT filter by procedure_id here because templates may have changed since
    # the transaction was recorded; the source of truth is deducted_materials.
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
        FinanceTransaction.type == "ingreso",
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    tx_result = await db.execute(
        select(FinanceTransaction)
        .where(*filters)
        .options(
            selectinload(FinanceTransaction.patient),
            selectinload(FinanceTransaction.procedure),
            selectinload(FinanceTransaction.cost_treatment),
            selectinload(FinanceTransaction.doctor),
        )
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
    )
    transactions = list(tx_result.scalars().all())

    usages = []
    for tx in transactions:
        units_of_selected = 0.0
        proc_qty = tx.procedure_quantity or 1
        raw: list[tuple[str, float]] = []  # (product_id, units)

        if tx.deducted_materials:
            # Primary source: exact materials recorded at transaction time
            for mat in tx.deducted_materials:
                p = mat.get("productId")
                q = float(mat.get("qty") or 0) * proc_qty
                if not p or q <= 0:
                    continue
                if p == pid_str:
                    units_of_selected = q
                raw.append((p, q))
        elif tx.cost_treatment_id:
            # Fallback: read from current template
            for p, q_per in proc_to_materials.get(str(tx.cost_treatment_id), {}).items():
                q = q_per * proc_qty
                if q <= 0:
                    continue
                if p == pid_str:
                    units_of_selected = q
                raw.append((p, q))

        if units_of_selected <= 0:
            continue

        all_materials = []
        for p, q in raw:
            prod_obj = all_products.get(p)
            if not prod_obj:
                continue
            q_r = round(q, 4)
            all_materials.append({
                "name": prod_obj.name,
                "units": q_r,
                "unit_price": float(prod_obj.unit_price or 0),
                "total_cost": round(q_r * float(prod_obj.unit_price or 0), 2),
                "is_selected": p == pid_str,
            })

        dt = tx.transaction_date
        usages.append({
            "transaction_id": str(tx.id),
            "date": dt.isoformat()[:10],
            "patient_name": tx.patient.full_name if tx.patient else None,
            "patient_id": str(tx.patient_id) if tx.patient_id else None,
            "procedure_name": tx.procedure_display_name,
            "doctor_name": tx.doctor.full_name if tx.doctor else None,
            "units_used": round(units_of_selected, 4),
            "all_materials": all_materials,
        })

    return {
        "product_name": product.name,
        "category": product.category,
        "unit_price": float(product.unit_price or 0),
        "usages": usages,
    }


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
        )
        .options(selectinload(CostTreatment.appointments))
    )
    treatments = list(result.scalars().all())
    if not treatments:
        return []

    # 2. Map procedure_catalog_id -> {productId -> total_qty_per_procedure}
    proc_to_materials: dict[str, dict[str, float]] = {}
    for treatment in treatments:
        proc_str = str(treatment.id)
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
        FinanceTransaction.deleted_at.is_(None),
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.cost_treatment_id.in_(proc_ids),
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
        proc_qty = tx.procedure_quantity or 1
        if tx.deducted_materials:
            # Usar exactamente los materiales deducidos (ya son per-cita)
            for mat in tx.deducted_materials:
                pid = mat.get("productId")
                qty = float(mat.get("qty") or 0)
                if pid and qty > 0:
                    material_units[pid] = material_units.get(pid, 0.0) + qty * proc_qty
        else:
            proc_str = str(tx.cost_treatment_id)
            mats = proc_to_materials.get(proc_str, {})
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


async def get_drilldown(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    kind: str,
    key: str,
    year: int,
    month: int | None = None,
) -> dict:
    """Transacciones que componen una fila de un reporte (doctor, tratamiento, paciente o categoría de egreso).

    Usa los mismos filtros que los reportes agregados para que los totales coincidan.
    """
    from app.models.costos import CostProduct

    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    if kind == "doctor":
        filters.append(FinanceTransaction.type == "ingreso")
        if key == "none":
            filters.append(FinanceTransaction.doctor_id.is_(None))
        else:
            filters.append(FinanceTransaction.doctor_id == uuid.UUID(key))
    elif kind == "treatment":
        filters.append(FinanceTransaction.type == "ingreso")
        filters.append(FinanceTransaction.cost_treatment_id == uuid.UUID(key))
    elif kind == "patient":
        filters.append(FinanceTransaction.type == "ingreso")
        filters.append(FinanceTransaction.patient_id == uuid.UUID(key))
    elif kind == "expense":
        filters.append(FinanceTransaction.type == "egreso")
        filters.append(FinanceTransaction.category == key)
    else:
        raise ValueError("kind inválido")

    result = await db.execute(
        select(FinanceTransaction)
        .where(*filters)
        .options(
            selectinload(FinanceTransaction.patient),
            selectinload(FinanceTransaction.procedure),
            selectinload(FinanceTransaction.cost_treatment),
            selectinload(FinanceTransaction.doctor),
        )
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
        .limit(500)
    )
    txs = list(result.scalars().all())

    prods_result = await db.execute(select(CostProduct).where(CostProduct.clinic_id == clinic_id))
    products = {str(p.id): p for p in prods_result.scalars().all()}

    rows = []
    for t in txs:
        proc_qty = t.procedure_quantity or 1
        materials = []
        for mat in (t.deducted_materials or []):
            pid = mat.get("productId")
            qty = float(mat.get("qty") or 0) * proc_qty
            prod = products.get(pid) if pid else None
            if not prod or qty <= 0:
                continue
            price = float(prod.unit_price or 0)
            materials.append({
                "name": prod.name,
                "units": round(qty, 4),
                "unit_price": price,
                "total_cost": round(qty * price, 2),
            })
        rows.append({
            "id": str(t.id),
            "date": t.transaction_date.isoformat(),
            "patient_id": str(t.patient_id) if t.patient_id else None,
            "patient_name": t.patient.full_name if t.patient else None,
            "treatment_name": t.procedure_display_name,
            "doctor_name": t.doctor.full_name if t.doctor else None,
            "description": t.description,
            "quantity": proc_qty,
            "amount": round(float(t.amount_cordobas), 2),
            "op_cost": round(float(t.operational_cost_snapshot), 2) if t.operational_cost_snapshot else 0.0,
            "materials": materials,
        })

    return {
        "kind": kind,
        "rows": rows,
        "total_amount": round(sum(r["amount"] for r in rows), 2),
        "total_op_cost": round(sum(r["op_cost"] for r in rows), 2),
        "truncated": len(txs) >= 500,
    }


async def get_budget_vs_actual(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> dict:
    """Presupuesto (costos fijos configurados, por mes) vs gasto real (egresos de las categorías vinculadas).

    Sin mes se compara el año completo (presupuesto × 12).
    """
    from app.models.finance import ExpenseCategory
    from app.services.costos_service import get_fixed_costs

    months = 1 if month else 12
    config = await get_fixed_costs(db, clinic_id)
    items = [i for i in (config.items or []) if isinstance(i, dict)]

    cats = list((await db.execute(
        select(ExpenseCategory)
        .where(ExpenseCategory.clinic_id == clinic_id)
        .order_by(ExpenseCategory.sort_order, ExpenseCategory.label)
    )).scalars().all())

    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "egreso",
        FinanceTransaction.deleted_at.is_(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)
    sums = await db.execute(
        select(FinanceTransaction.category, func.sum(FinanceTransaction.amount_cordobas))
        .where(*filters)
        .group_by(FinanceTransaction.category)
    )
    real_by_key = {k: float(v or 0) for k, v in sums}

    item_ids = {str(i.get("id")) for i in items}
    rows = []
    linked_cat_ids: set[str] = set()
    for it in items:
        iid = str(it.get("id"))
        linked = [c for c in cats if c.fixed_cost_item_id == iid]
        linked_cat_ids.update(str(c.id) for c in linked)
        budget = round(float(it.get("amount") or 0) * months, 2)
        real = round(sum(real_by_key.get(c.key, 0.0) for c in linked), 2)
        rows.append({
            "fixed_cost_id": iid,
            "name": it.get("name") or "Sin nombre",
            "budget": budget,
            "category_id": str(linked[0].id) if linked else None,
            "category_label": linked[0].label if linked else None,
            "category_key": linked[0].key if linked else None,
            "real": real if linked else None,
            "diff": round(real - budget, 2) if linked else None,
        })

    # Categorías "ya cubiertas" sin vínculo a un costo fijo: solo gasto real (doctor, materiales…)
    others = []
    for c in cats:
        if str(c.id) in linked_cat_ids:
            continue
        if c.covered_by_op_costs and c.fixed_cost_item_id not in item_ids:
            others.append({
                "category_id": str(c.id),
                "label": c.label,
                "real": round(real_by_key.get(c.key, 0.0), 2),
            })

    return {
        "months": months,
        "rows": rows,
        "others": others,
        "categories": [{"id": str(c.id), "label": c.label} for c in cats],
        "total_budget": round(sum(r["budget"] for r in rows), 2),
        "total_real_linked": round(sum(r["real"] or 0 for r in rows), 2),
        "total_budget_linked": round(sum(r["budget"] for r in rows if r["category_id"]), 2),
    }


async def set_budget_link(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    fixed_cost_id: str,
    category_id: uuid.UUID | None,
) -> bool:
    """Vincula un costo fijo con una categoría de egreso (o lo desvincula si category_id es None)."""
    from app.models.finance import ExpenseCategory

    current = (await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.clinic_id == clinic_id,
            ExpenseCategory.fixed_cost_item_id == fixed_cost_id,
        )
    )).scalars().all()
    for c in current:
        c.fixed_cost_item_id = None
    if category_id is not None:
        cat = (await db.execute(
            select(ExpenseCategory).where(
                ExpenseCategory.id == category_id, ExpenseCategory.clinic_id == clinic_id
            )
        )).scalar_one_or_none()
        if not cat:
            await db.rollback()
            return False
        cat.fixed_cost_item_id = fixed_cost_id
    await db.commit()
    return True


async def get_doctor_account(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int | None = None,
) -> dict:
    """Cuenta por doctor: cobrado en sus tratamientos, lo que le corresponde (según su %), lo pagado y el saldo."""
    from app.models.finance import ExpenseCategory, DoctorCommission

    doctors = list((await db.execute(
        select(User).where(
            User.clinic_id == clinic_id,
            User.is_active == True,  # noqa: E712
            User.role.in_(["clinic_owner", "admin", "dentist"]),
        ).order_by(User.full_name)
    )).scalars().all())
    pct_by_doc = {
        r.doctor_id: float(r.pct)
        for r in (await db.execute(select(DoctorCommission).where(DoctorCommission.clinic_id == clinic_id))).scalars().all()
    }
    cats = list((await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.clinic_id == clinic_id).order_by(ExpenseCategory.sort_order, ExpenseCategory.label)
    )).scalars().all())
    pay_keys = {c.key for c in cats if c.is_doctor_payment}
    cat_label = {c.key: c.label for c in cats}

    base = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.deleted_at.is_(None),
        extract("year", FinanceTransaction.transaction_date) == year,
    ]
    if month:
        base.append(extract("month", FinanceTransaction.transaction_date) == month)

    cobrado = {
        r.doctor_id: (float(r.total or 0), int(r.n))
        for r in await db.execute(
            select(FinanceTransaction.doctor_id, func.sum(FinanceTransaction.amount_cordobas).label("total"), func.count().label("n"))
            .where(*base, FinanceTransaction.type == "ingreso", FinanceTransaction.doctor_id.isnot(None))
            .group_by(FinanceTransaction.doctor_id)
        )
    }
    pagos_rows = await db.execute(
        select(FinanceTransaction.doctor_id, FinanceTransaction.category, func.sum(FinanceTransaction.amount_cordobas).label("total"))
        .where(*base, FinanceTransaction.type == "egreso", FinanceTransaction.doctor_id.isnot(None))
        .group_by(FinanceTransaction.doctor_id, FinanceTransaction.category)
    )
    pagado: dict = {}
    otros: dict = {}
    for r in pagos_rows:
        bucket = pagado if r.category in pay_keys else otros
        bucket[r.doctor_id] = bucket.get(r.doctor_id, 0.0) + float(r.total or 0)

    rows = []
    for d in doctors:
        c_tot, c_n = cobrado.get(d.id, (0.0, 0))
        pct = pct_by_doc.get(d.id)
        paid = pagado.get(d.id, 0.0)
        if c_tot == 0 and pct is None and paid == 0 and otros.get(d.id, 0.0) == 0:
            continue
        corresponde = round(c_tot * pct / 100, 2) if pct is not None else None
        rows.append({
            "doctor_id": str(d.id),
            "doctor_name": d.full_name,
            "pct": pct,
            "n_cobros": c_n,
            "cobrado": round(c_tot, 2),
            "corresponde": corresponde,
            "pagado": round(paid, 2),
            "saldo": round(corresponde - paid, 2) if corresponde is not None else None,
            "otros_pagos": round(otros.get(d.id, 0.0), 2),
        })

    # Revisión: cobros sin doctor
    sin_doc = (await db.execute(
        select(FinanceTransaction)
        .where(*base, FinanceTransaction.type == "ingreso", FinanceTransaction.doctor_id.is_(None))
        .options(selectinload(FinanceTransaction.patient), selectinload(FinanceTransaction.cost_treatment), selectinload(FinanceTransaction.procedure))
        .order_by(FinanceTransaction.transaction_date.desc())
    )).scalars().all()
    # Revisión: pagos al personal sin doctor marcado (categorías de pago a doctor o de salario)
    review_keys = pay_keys | {"salario"}
    pagos_sin_doc = (await db.execute(
        select(FinanceTransaction)
        .where(*base, FinanceTransaction.type == "egreso", FinanceTransaction.doctor_id.is_(None), FinanceTransaction.category.in_(list(review_keys)))
        .order_by(FinanceTransaction.transaction_date.desc())
    )).scalars().all()

    return {
        "rows": rows,
        "doctors": [{"id": str(d.id), "name": d.full_name} for d in doctors],
        "categories": [{"id": str(c.id), "label": c.label, "is_doctor_payment": bool(c.is_doctor_payment)} for c in cats],
        "has_payment_categories": bool(pay_keys),
        "cobros_sin_doctor": {
            "n": len(sin_doc),
            "total": round(sum(float(t.amount_cordobas) for t in sin_doc), 2),
            "items": [
                {
                    "id": str(t.id),
                    "date": t.transaction_date.isoformat(),
                    "patient_name": t.patient.full_name if t.patient else None,
                    "treatment_name": t.procedure_display_name,
                    "amount": round(float(t.amount_cordobas), 2),
                }
                for t in sin_doc[:30]
            ],
        },
        "pagos_sin_doctor": {
            "n": len(pagos_sin_doc),
            "total": round(sum(float(t.amount_cordobas) for t in pagos_sin_doc), 2),
            "items": [
                {
                    "id": str(t.id),
                    "date": t.transaction_date.isoformat(),
                    "category": cat_label.get(t.category, t.category),
                    "description": t.description,
                    "amount": round(float(t.amount_cordobas), 2),
                }
                for t in pagos_sin_doc[:30]
            ],
        },
    }


async def set_doctor_commission(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    doctor_id: uuid.UUID,
    pct: float | None,
) -> bool:
    from decimal import Decimal
    from app.models.finance import DoctorCommission

    doc = await db.scalar(select(User).where(User.id == doctor_id, User.clinic_id == clinic_id))
    if not doc:
        return False
    existing = await db.scalar(
        select(DoctorCommission).where(DoctorCommission.clinic_id == clinic_id, DoctorCommission.doctor_id == doctor_id)
    )
    if pct is None:
        if existing:
            await db.delete(existing)
    elif existing:
        existing.pct = Decimal(str(round(pct, 2)))
    else:
        db.add(DoctorCommission(clinic_id=clinic_id, doctor_id=doctor_id, pct=Decimal(str(round(pct, 2)))))
    await db.commit()
    return True
