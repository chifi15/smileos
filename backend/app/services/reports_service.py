import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, case
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
