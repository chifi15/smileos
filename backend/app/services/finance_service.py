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
    if proc_id:
        proc = await db.scalar(
            select(ProcedureCatalog).where(
                ProcedureCatalog.id == uuid.UUID(str(proc_id)),
                ProcedureCatalog.clinic_id == clinic_id,
            )
        )
        if proc and proc.operational_cost:
            op_cost = Decimal(str(proc.operational_cost))

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
        operational_cost_snapshot=op_cost,
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

    if "procedure_id" in data:
        proc_id = data["procedure_id"]
        tx.procedure_id = uuid.UUID(str(proc_id)) if proc_id else None
        if proc_id:
            proc = await db.scalar(
                select(ProcedureCatalog).where(
                    ProcedureCatalog.id == uuid.UUID(str(proc_id)),
                    ProcedureCatalog.clinic_id == clinic_id,
                )
            )
            tx.operational_cost_snapshot = Decimal(str(proc.operational_cost)) if proc and proc.operational_cost else None
        else:
            tx.operational_cost_snapshot = None

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
