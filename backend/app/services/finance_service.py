import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import selectinload

from app.models.finance import FinanceTransaction
from app.models.clinic import ClinicSettings
from app.models.treatment import ProcedureCatalog
from app.models.patient import Patient
from app.core.exceptions import NotFoundError

_LOAD = [
    selectinload(FinanceTransaction.patient),
    selectinload(FinanceTransaction.procedure),
    selectinload(FinanceTransaction.doctor),
    selectinload(FinanceTransaction.created_by),
]


async def get_exchange_rate(db: AsyncSession, clinic_id: uuid.UUID) -> Decimal:
    r = await db.scalar(
        select(ClinicSettings.usd_exchange_rate).where(ClinicSettings.clinic_id == clinic_id)
    )
    return Decimal(str(r)) if r else Decimal("37.0")


async def set_exchange_rate(db: AsyncSession, clinic_id: uuid.UUID, rate: Decimal) -> Decimal:
    settings = await db.scalar(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
    )
    if settings:
        settings.usd_exchange_rate = rate
        await db.commit()
    return rate


async def list_transactions(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int,
    tx_type: str | None = None,
) -> list[FinanceTransaction]:
    q = (
        select(FinanceTransaction)
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            extract("year", FinanceTransaction.transaction_date) == year,
            extract("month", FinanceTransaction.transaction_date) == month,
        )
        .options(*_LOAD)
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
    )
    if tx_type:
        q = q.where(FinanceTransaction.type == tx_type)
    result = await db.execute(q)
    return result.scalars().all()


async def get_summary(
    db: AsyncSession, clinic_id: uuid.UUID, year: int, month: int
) -> dict:
    rows = await list_transactions(db, clinic_id, year, month)
    ingresos = sum(float(t.amount_cordobas) for t in rows if t.type == "ingreso")
    egresos = sum(float(t.amount_cordobas) for t in rows if t.type == "egreso")
    costos_op = sum(
        float(t.operational_cost_snapshot)
        for t in rows
        if t.type == "ingreso" and t.operational_cost_snapshot
    )
    return {
        "ingresos_brutos": round(ingresos, 2),
        "egresos": round(egresos, 2),
        "costos_operativos": round(costos_op, 2),
        "ingreso_neto": round(ingresos - egresos, 2),
        "ingreso_neto_con_op": round(ingresos - egresos - costos_op, 2),
        "count_ingresos": sum(1 for t in rows if t.type == "ingreso"),
        "count_egresos": sum(1 for t in rows if t.type == "egreso"),
    }


async def create_transaction(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    user_id: uuid.UUID,
    data: dict,
) -> FinanceTransaction:
    # Si viene en USD, convertir
    currency = data.get("original_currency", "NIO")
    original_amount = Decimal(str(data.get("original_amount") or data["amount_cordobas"]))
    exchange_rate = None

    if currency == "USD":
        exchange_rate = await get_exchange_rate(db, clinic_id)
        amount_nio = original_amount * exchange_rate
    else:
        amount_nio = original_amount

    # Snapshot del costo operativo si viene con procedimiento
    op_cost = None
    proc_id = data.get("procedure_id")
    quantity = max(1, int(data.get("quantity") or 1))
    sessions = max(1, int(data.get("sessions") or 1))
    cost_override = data.get("operational_cost_override")
    if proc_id:
        if cost_override is not None:
            op_cost = round(Decimal(str(cost_override)), 2)
        else:
            proc = await db.scalar(
                select(ProcedureCatalog).where(
                    ProcedureCatalog.id == uuid.UUID(str(proc_id)),
                    ProcedureCatalog.clinic_id == clinic_id,
                )
            )
            if proc and proc.operational_cost:
                op_cost = round(Decimal(str(proc.operational_cost)) * quantity / sessions, 2)

    tx = FinanceTransaction(
        clinic_id=clinic_id,
        type=data["type"],
        category=data["category"],
        description=data["description"],
        amount_cordobas=round(amount_nio, 2),
        original_amount=original_amount,
        original_currency=currency,
        exchange_rate_used=exchange_rate,
        patient_id=uuid.UUID(str(data["patient_id"])) if data.get("patient_id") else None,
        procedure_id=uuid.UUID(str(proc_id)) if proc_id else None,
        cost_appointment_id=data.get("cost_appointment_id") or None,
        procedure_quantity=quantity,
        operational_cost_snapshot=op_cost,
        doctor_id=uuid.UUID(str(data["doctor_id"])) if data.get("doctor_id") else None,
        invoice_number=data.get("invoice_number"),
        transaction_date=data["transaction_date"],
        notes=data.get("notes"),
        created_by_id=user_id,
    )
    db.add(tx)
    await db.flush()

    result = await db.execute(
        select(FinanceTransaction).where(FinanceTransaction.id == tx.id).options(*_LOAD)
    )
    tx = result.scalar_one()
    await db.commit()
    return tx


async def get_income_by_patient(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int | None = None,
    month: int | None = None,
) -> list[dict]:
    filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        FinanceTransaction.patient_id.isnot(None),
    ]
    if year:
        filters.append(extract("year", FinanceTransaction.transaction_date) == year)
    if month:
        filters.append(extract("month", FinanceTransaction.transaction_date) == month)

    rows = await db.execute(
        select(
            FinanceTransaction.patient_id,
            Patient.first_name,
            Patient.last_name,
            func.sum(FinanceTransaction.amount_cordobas).label("total"),
            func.count(FinanceTransaction.id).label("count"),
        )
        .join(Patient, Patient.id == FinanceTransaction.patient_id)
        .where(*filters)
        .group_by(FinanceTransaction.patient_id, Patient.first_name, Patient.last_name)
        .order_by(func.sum(FinanceTransaction.amount_cordobas).desc())
    )
    return [
        {
            "patient_id": str(r.patient_id),
            "patient_name": f"{r.first_name} {r.last_name}",
            "total": round(float(r.total), 2),
            "count": r.count,
        }
        for r in rows
    ]


async def get_honorarios_by_procedure(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    year: int,
    month: int,
) -> dict:
    from app.models.costos import CostTreatment

    rows = await list_transactions(db, clinic_id, year, month, tx_type="ingreso")

    cost_treatments = await db.execute(
        select(CostTreatment).where(CostTreatment.clinic_id == clinic_id)
    )
    cost_map = {
        str(ct.procedure_catalog_id): ct
        for ct in cost_treatments.scalars()
        if ct.procedure_catalog_id
    }

    procedure_totals: dict[str, dict] = {}
    # doctor_id -> { doctor_name, procedures: {proc_id -> {...}}, total }
    doctor_totals: dict[str, dict] = {}
    total_honorarios = 0.0

    for tx in rows:
        if not tx.procedure_id:
            continue
        ct = cost_map.get(str(tx.procedure_id))
        if not ct:
            continue
        fee_per_unit = ct.professional_fee_per_hour * ct.total_hours
        qty = tx.procedure_quantity or 1
        fee = fee_per_unit * qty
        proc_id = str(tx.procedure_id)
        proc_name = tx.procedure.name if tx.procedure else "—"

        if proc_id not in procedure_totals:
            procedure_totals[proc_id] = {
                "procedure_id": proc_id,
                "procedure_name": proc_name,
                "fee_per_unit": round(fee_per_unit, 2),
                "quantity": 0,
                "total_honorarios": 0.0,
            }
        procedure_totals[proc_id]["quantity"] += qty
        procedure_totals[proc_id]["total_honorarios"] += fee
        total_honorarios += fee

        # Group by doctor
        doc_key = str(tx.doctor_id) if tx.doctor_id else "__sin_doctor__"
        doc_name = tx.doctor.full_name if tx.doctor else "Sin doctor asignado"
        if doc_key not in doctor_totals:
            doctor_totals[doc_key] = {
                "doctor_id": str(tx.doctor_id) if tx.doctor_id else None,
                "doctor_name": doc_name,
                "total_honorarios": 0.0,
                "procedures": {},
            }
        doctor_totals[doc_key]["total_honorarios"] += fee
        doc_procs = doctor_totals[doc_key]["procedures"]
        if proc_id not in doc_procs:
            doc_procs[proc_id] = {
                "procedure_name": proc_name,
                "fee_per_unit": round(fee_per_unit, 2),
                "quantity": 0,
                "total_honorarios": 0.0,
            }
        doc_procs[proc_id]["quantity"] += qty
        doc_procs[proc_id]["total_honorarios"] += fee

    by_procedure = sorted(
        procedure_totals.values(),
        key=lambda x: x["total_honorarios"],
        reverse=True,
    )
    for r in by_procedure:
        r["total_honorarios"] = round(r["total_honorarios"], 2)

    by_doctor = sorted(
        doctor_totals.values(),
        key=lambda x: x["total_honorarios"],
        reverse=True,
    )
    for d in by_doctor:
        d["total_honorarios"] = round(d["total_honorarios"], 2)
        d["procedures"] = sorted(
            d["procedures"].values(),
            key=lambda x: x["total_honorarios"],
            reverse=True,
        )
        for p in d["procedures"]:
            p["total_honorarios"] = round(p["total_honorarios"], 2)

    return {
        "total_honorarios": round(total_honorarios, 2),
        "by_procedure": by_procedure,
        "by_doctor": by_doctor,
    }


async def list_patient_transactions(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[FinanceTransaction]:
    result = await db.execute(
        select(FinanceTransaction)
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            FinanceTransaction.patient_id == patient_id,
        )
        .options(*_LOAD)
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
    )
    return result.scalars().all()


async def update_transaction(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    tx_id: uuid.UUID,
    data: dict,
) -> FinanceTransaction:
    tx = await db.scalar(
        select(FinanceTransaction).where(
            FinanceTransaction.id == tx_id,
            FinanceTransaction.clinic_id == clinic_id,
        )
    )
    if not tx:
        raise NotFoundError("Transacción")

    if "category" in data:
        tx.category = data["category"]
    if "description" in data:
        tx.description = data["description"]
    if "transaction_date" in data:
        tx.transaction_date = data["transaction_date"]
    if "invoice_number" in data:
        tx.invoice_number = data["invoice_number"]
    if "notes" in data:
        tx.notes = data["notes"]

    if "patient_id" in data:
        tx.patient_id = uuid.UUID(str(data["patient_id"])) if data["patient_id"] else None

    if "doctor_id" in data:
        tx.doctor_id = uuid.UUID(str(data["doctor_id"])) if data["doctor_id"] else None

    upd_quantity = max(1, int(data["quantity"])) if data.get("quantity") else None
    upd_sessions = max(1, int(data["sessions"])) if data.get("sessions") else 1
    upd_cost_override = data.get("operational_cost_override")

    if "cost_appointment_id" in data:
        tx.cost_appointment_id = data["cost_appointment_id"] or None

    if "procedure_id" in data:
        proc_id = data["procedure_id"]
        tx.procedure_id = uuid.UUID(str(proc_id)) if proc_id else None
        if proc_id:
            if upd_cost_override is not None:
                tx.operational_cost_snapshot = round(Decimal(str(upd_cost_override)), 2)
            else:
                proc = await db.scalar(
                    select(ProcedureCatalog).where(
                        ProcedureCatalog.id == uuid.UUID(str(proc_id)),
                        ProcedureCatalog.clinic_id == clinic_id,
                    )
                )
                base = Decimal(str(proc.operational_cost)) if proc and proc.operational_cost else None
                tx.operational_cost_snapshot = round(base * (upd_quantity or 1) / upd_sessions, 2) if base else None
        else:
            tx.operational_cost_snapshot = None
    elif upd_cost_override is not None and tx.procedure_id:
        tx.operational_cost_snapshot = round(Decimal(str(upd_cost_override)), 2)
    elif upd_quantity is not None and tx.procedure_id:
        # Solo cambió la cantidad o sesiones, mismo procedimiento
        proc = await db.scalar(
            select(ProcedureCatalog).where(
                ProcedureCatalog.id == tx.procedure_id,
                ProcedureCatalog.clinic_id == clinic_id,
            )
        )
        if proc and proc.operational_cost:
            tx.operational_cost_snapshot = round(Decimal(str(proc.operational_cost)) * upd_quantity / upd_sessions, 2)

    if upd_quantity is not None:
        tx.procedure_quantity = upd_quantity

    if "original_amount" in data or "original_currency" in data:
        currency = data.get("original_currency", tx.original_currency or "NIO")
        original_amount = Decimal(str(data.get("original_amount", tx.original_amount or tx.amount_cordobas)))
        if currency == "USD":
            exchange_rate = await get_exchange_rate(db, clinic_id)
            tx.amount_cordobas = round(original_amount * exchange_rate, 2)
            tx.exchange_rate_used = exchange_rate
        else:
            tx.amount_cordobas = round(original_amount, 2)
            tx.exchange_rate_used = None
        tx.original_amount = original_amount
        tx.original_currency = currency

    await db.flush()
    result = await db.execute(
        select(FinanceTransaction).where(FinanceTransaction.id == tx_id).options(*_LOAD)
    )
    tx = result.scalar_one()
    await db.commit()
    return tx


async def delete_transaction(
    db: AsyncSession, clinic_id: uuid.UUID, tx_id: uuid.UUID
) -> None:
    tx = await db.scalar(
        select(FinanceTransaction).where(
            FinanceTransaction.id == tx_id,
            FinanceTransaction.clinic_id == clinic_id,
        )
    )
    if not tx:
        raise NotFoundError("Transacción")
    await db.delete(tx)
    await db.commit()


# ─── Expense Categories ────────────────────────────────────────────────────────

DEFAULT_EXPENSE_CATEGORIES = [
    ("laboratorio", "Laboratorio dental"),
    ("insumos", "Insumos y materiales"),
    ("renta", "Renta"),
    ("servicios", "Servicios (agua/luz/internet)"),
    ("salario", "Salario / Honorarios"),
    ("otro_egreso", "Otro egreso"),
]


async def list_expense_categories(db: AsyncSession, clinic_id: uuid.UUID):
    from app.models.finance import ExpenseCategory
    result = await db.execute(
        select(ExpenseCategory)
        .where(ExpenseCategory.clinic_id == clinic_id)
        .order_by(ExpenseCategory.sort_order, ExpenseCategory.label)
    )
    cats = list(result.scalars().all())
    if not cats:
        for i, (key, label) in enumerate(DEFAULT_EXPENSE_CATEGORIES):
            cats.append(ExpenseCategory(clinic_id=clinic_id, key=key, label=label, sort_order=i))
            db.add(cats[-1])
        await db.commit()
    return cats


async def create_expense_category(db: AsyncSession, clinic_id: uuid.UUID, label: str) -> "ExpenseCategory":
    from app.models.finance import ExpenseCategory
    result = await db.execute(
        select(func.count()).select_from(ExpenseCategory).where(ExpenseCategory.clinic_id == clinic_id)
    )
    count = result.scalar_one()
    key = str(uuid.uuid4())
    cat = ExpenseCategory(clinic_id=clinic_id, key=key, label=label, sort_order=count)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


async def update_expense_category(db: AsyncSession, clinic_id: uuid.UUID, cat_id: uuid.UUID, label: str):
    from app.models.finance import ExpenseCategory
    result = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.id == cat_id, ExpenseCategory.clinic_id == clinic_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        return None
    cat.label = label
    await db.commit()
    await db.refresh(cat)
    return cat


async def delete_expense_category(db: AsyncSession, clinic_id: uuid.UUID, cat_id: uuid.UUID) -> bool:
    from app.models.finance import ExpenseCategory
    result = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.id == cat_id, ExpenseCategory.clinic_id == clinic_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        return False
    await db.delete(cat)
    await db.commit()
    return True
