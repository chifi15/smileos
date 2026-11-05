import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import selectinload

from app.models.finance import FinanceTransaction
from app.models.clinic import ClinicSettings
from app.models.treatment import ProcedureCatalog
from app.models.costos import CostTreatment
from app.models.patient import Patient
from app.core.exceptions import NotFoundError

_LOAD = [
    selectinload(FinanceTransaction.patient),
    selectinload(FinanceTransaction.procedure),
    selectinload(FinanceTransaction.cost_treatment),
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
            FinanceTransaction.deleted_at.is_(None),
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
    from app.models.costos import CostTreatment
    treats_result = await db.execute(
        select(CostTreatment).where(CostTreatment.clinic_id == clinic_id)
    )
    all_treatments = list(treats_result.scalars())
    treat_by_catalog: dict[str, CostTreatment] = {
        str(ct.procedure_catalog_id): ct for ct in all_treatments if ct.procedure_catalog_id
    }
    treat_by_id: dict[str, CostTreatment] = {str(ct.id): ct for ct in all_treatments}

    costos_op = 0.0
    ganancia_clinica = 0.0
    for t in rows:
        if t.type != "ingreso" or not t.operational_cost_snapshot:
            continue
        op = float(t.operational_cost_snapshot)
        costos_op += op
        # Buscar el CostTreatment: standalone por cost_treatment_id, catálogo por procedure_id
        ct = None
        if t.cost_treatment_id:
            ct = treat_by_id.get(str(t.cost_treatment_id))
        elif t.procedure_id:
            ct = treat_by_catalog.get(str(t.procedure_id))
        margin = float(ct.clinic_margin_pct) if ct else 0.15
        # snapshot = subtotal × (1+margin); ganancia ya está dentro
        ganancia_clinica += op * margin / (1 + margin)
    return {
        "ingresos_brutos": round(ingresos, 2),
        "egresos": round(egresos, 2),
        "costos_operativos": round(costos_op, 2),
        "ganancia_clinica": round(ganancia_clinica, 2),
        "ingreso_neto": round(ingresos - egresos, 2),
        "ingreso_neto_con_op": round(ingresos - egresos - costos_op, 2),
        "count_ingresos": sum(1 for t in rows if t.type == "ingreso"),
        "count_egresos": sum(1 for t in rows if t.type == "egreso"),
    }


async def get_ganancia_breakdown(
    db: AsyncSession, clinic_id: uuid.UUID, year: int, month: int
) -> dict:
    rows = await list_transactions(db, clinic_id, year, month)
    from app.models.costos import CostTreatment
    treats_result2 = await db.execute(
        select(CostTreatment).where(CostTreatment.clinic_id == clinic_id)
    )
    all_treatments2 = list(treats_result2.scalars())
    treat_by_catalog2: dict[str, CostTreatment] = {
        str(ct.procedure_catalog_id): ct for ct in all_treatments2 if ct.procedure_catalog_id
    }
    treat_by_id2: dict[str, CostTreatment] = {str(ct.id): ct for ct in all_treatments2}

    by_proc: dict[str, dict] = {}
    by_doc: dict[str, dict] = {}

    for t in rows:
        if t.type != "ingreso" or not t.operational_cost_snapshot:
            continue
        op = float(t.operational_cost_snapshot)
        proc_name = (t.procedure.name if t.procedure else t.cost_treatment.name if t.cost_treatment else "Sin tratamiento")
        # Resolver el CostTreatment y el ID unificado para agrupar
        ct = None
        unified_id: str | None = None
        if t.cost_treatment_id:
            unified_id = str(t.cost_treatment_id)
            ct = treat_by_id2.get(unified_id)
        elif t.procedure_id:
            unified_id = str(t.procedure_id)
            ct = treat_by_catalog2.get(unified_id)
        margin = float(ct.clinic_margin_pct) if ct else 0.15
        # snapshot = subtotal × (1+margin); extraer la parte de ganancia
        ganancia = op * margin / (1 + margin)

        doc_id = str(t.doctor_id) if t.doctor_id else None
        doc_name = t.doctor.full_name if t.doctor else "Sin doctor asignado"

        # agrupar por procedimiento
        pk = unified_id or "__none__"
        if pk not in by_proc:
            by_proc[pk] = {"procedure_id": unified_id, "procedure_name": proc_name,
                           "count": 0, "total_ingreso": 0.0, "total_op_cost": 0.0,
                           "ganancia": 0.0, "margin_pct": margin}
        by_proc[pk]["count"] += 1
        by_proc[pk]["total_ingreso"] += float(t.amount_cordobas)
        by_proc[pk]["total_op_cost"] += op
        by_proc[pk]["ganancia"] += ganancia

        # agrupar por doctor
        dk = doc_id or "__none__"
        if dk not in by_doc:
            by_doc[dk] = {"doctor_id": doc_id, "doctor_name": doc_name,
                          "total_ganancia": 0.0, "procedures": {}}
        by_doc[dk]["total_ganancia"] += ganancia
        if pk not in by_doc[dk]["procedures"]:
            by_doc[dk]["procedures"][pk] = {"procedure_name": proc_name, "count": 0, "ganancia": 0.0}
        by_doc[dk]["procedures"][pk]["count"] += 1
        by_doc[dk]["procedures"][pk]["ganancia"] += ganancia

    procs = sorted(by_proc.values(), key=lambda x: x["ganancia"], reverse=True)
    for p in procs:
        p["total_ingreso"] = round(p["total_ingreso"], 2)
        p["total_op_cost"] = round(p["total_op_cost"], 2)
        p["ganancia"] = round(p["ganancia"], 2)

    docs = sorted(by_doc.values(), key=lambda x: x["total_ganancia"], reverse=True)
    for d in docs:
        d["total_ganancia"] = round(d["total_ganancia"], 2)
        d["procedures"] = sorted(d["procedures"].values(), key=lambda x: x["ganancia"], reverse=True)
        for p in d["procedures"]:
            p["ganancia"] = round(p["ganancia"], 2)

    total = round(sum(p["ganancia"] for p in procs), 2)
    return {"total_ganancia": total, "by_procedure": procs, "by_doctor": docs}


async def create_transaction(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    user_id: uuid.UUID,
    data: dict,
) -> FinanceTransaction:
    # Si viene en USD, convertir
    currency = data.get("original_currency", "NIO")
    _raw_amount = data.get("original_amount")
    original_amount = Decimal(str(_raw_amount if _raw_amount is not None else data["amount_cordobas"]))
    exchange_rate = None

    if currency == "USD":
        exchange_rate = await get_exchange_rate(db, clinic_id)
        amount_nio = original_amount * exchange_rate
    else:
        amount_nio = original_amount

    # Snapshot del costo operativo si viene con procedimiento o tratamiento de costos
    op_cost = None
    proc_id = data.get("procedure_id")
    ct_id = data.get("cost_treatment_id")
    quantity = max(1, int(data.get("quantity") or 1))
    sessions = max(1, int(data.get("sessions") or 1))
    cost_override = data.get("operational_cost_override")

    catalog_ref_id: uuid.UUID | None = None
    cost_treatment_ref_id: uuid.UUID | None = None

    if cost_override is not None and (ct_id or proc_id):
        op_cost = round(Decimal(str(cost_override)), 2)
        if ct_id:
            cost_treatment_ref_id = uuid.UUID(str(ct_id))
        elif proc_id:
            catalog_ref_id = uuid.UUID(str(proc_id))
    elif ct_id:
        # Tratamiento standalone de Costos Operativos — fórmula completa
        ct_check = await db.scalar(
            select(CostTreatment).where(
                CostTreatment.id == uuid.UUID(str(ct_id)),
                CostTreatment.clinic_id == clinic_id,
            )
        )
        if ct_check:
            cost_treatment_ref_id = uuid.UUID(str(ct_id))
            fee = Decimal(str(ct_check.professional_fee_per_hour or 0)) * Decimal(str(ct_check.total_hours or 0))
            fixed = Decimal(str(ct_check.fixed_costs or 0))
            margin = Decimal(str(ct_check.clinic_margin_pct or 0))
            raw = (fee + fixed) * quantity / sessions
            op_cost = round(raw * (1 + margin), 2)
    elif proc_id:
        pid = uuid.UUID(str(proc_id))
        # Intentar encontrar como CostTreatment primero (retrocompat — antes se enviaba procedure_id)
        ct_check = await db.scalar(
            select(CostTreatment).where(
                CostTreatment.id == pid,
                CostTreatment.clinic_id == clinic_id,
            )
        )
        if ct_check:
            cost_treatment_ref_id = pid
            fee = Decimal(str(ct_check.professional_fee_per_hour or 0)) * Decimal(str(ct_check.total_hours or 0))
            fixed = Decimal(str(ct_check.fixed_costs or 0))
            margin = Decimal(str(ct_check.clinic_margin_pct or 0))
            raw = (fee + fixed) * quantity / sessions
            op_cost = round(raw * (1 + margin), 2)
        else:
            # ProcedureCatalog (retrocompatibilidad)
            proc = await db.scalar(
                select(ProcedureCatalog).where(
                    ProcedureCatalog.id == pid,
                    ProcedureCatalog.clinic_id == clinic_id,
                )
            )
            if proc:
                catalog_ref_id = pid
                if proc.operational_cost:
                    treatment = await db.scalar(
                        select(CostTreatment).where(
                            CostTreatment.procedure_catalog_id == proc.id,
                            CostTreatment.clinic_id == clinic_id,
                        )
                    )
                    margin = Decimal(str(treatment.clinic_margin_pct)) if treatment else Decimal("0.15")
                    raw = Decimal(str(proc.operational_cost)) * quantity / sessions
                    op_cost = round(raw * (1 + margin), 2)

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
        procedure_id=catalog_ref_id,
        cost_treatment_id=cost_treatment_ref_id,
        cost_appointment_id=data.get("cost_appointment_id") or None,
        procedure_quantity=quantity,
        operational_cost_snapshot=op_cost,
        doctor_id=uuid.UUID(str(data["doctor_id"])) if data.get("doctor_id") else None,
        invoice_number=data.get("invoice_number"),
        transaction_date=data["transaction_date"],
        notes=data.get("notes"),
        created_by_id=user_id,
        deducted_materials=data.get("deducted_materials"),
        extra_procedures=data.get("extra_procedures"),
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

    from sqlalchemy.orm import selectinload as _sil
    cost_treatments = await db.execute(
        select(CostTreatment)
        .where(CostTreatment.clinic_id == clinic_id)
        .options(_sil(CostTreatment.appointments))
    )
    all_cts = list(cost_treatments.scalars())
    cost_map_catalog = {str(ct.procedure_catalog_id): ct for ct in all_cts if ct.procedure_catalog_id}
    cost_map_id = {str(ct.id): ct for ct in all_cts}

    procedure_totals: dict[str, dict] = {}
    # doctor_id -> { doctor_name, procedures: {proc_id -> {...}}, total }
    doctor_totals: dict[str, dict] = {}
    total_honorarios = 0.0

    for tx in rows:
        # Resolver CostTreatment: standalone (cost_treatment_id) o catálogo (procedure_id)
        ct = None
        unified_proc_id: str | None = None
        if tx.cost_treatment_id:
            unified_proc_id = str(tx.cost_treatment_id)
            ct = cost_map_id.get(unified_proc_id)
        elif tx.procedure_id:
            unified_proc_id = str(tx.procedure_id)
            ct = cost_map_catalog.get(unified_proc_id)
        if not ct:
            continue
        total_fee = ct.professional_fee_per_hour * ct.total_hours
        # Si la transacción es por una cita específica, prorratear entre el total de citas
        if tx.cost_appointment_id and ct.appointments:
            n_apts = len(ct.appointments)
            fee_per_unit = total_fee / max(n_apts, 1)
        else:
            fee_per_unit = total_fee
        qty = tx.procedure_quantity or 1
        fee = fee_per_unit * qty
        proc_name = (tx.procedure.name if tx.procedure else tx.cost_treatment.name if tx.cost_treatment else "—")

        if unified_proc_id not in procedure_totals:
            procedure_totals[unified_proc_id] = {
                "procedure_id": unified_proc_id,
                "procedure_name": proc_name,
                "fee_per_unit": round(fee_per_unit, 2),
                "quantity": 0,
                "total_honorarios": 0.0,
            }
        procedure_totals[unified_proc_id]["quantity"] += qty
        procedure_totals[unified_proc_id]["total_honorarios"] += fee
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
        if unified_proc_id not in doc_procs:
            doc_procs[unified_proc_id] = {
                "procedure_name": proc_name,
                "fee_per_unit": round(fee_per_unit, 2),
                "quantity": 0,
                "total_honorarios": 0.0,
            }
        doc_procs[unified_proc_id]["quantity"] += qty
        doc_procs[unified_proc_id]["total_honorarios"] += fee

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
            FinanceTransaction.deleted_at.is_(None),
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
            FinanceTransaction.deleted_at.is_(None),
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

    if "cost_treatment_id" in data:
        new_ct_id = data["cost_treatment_id"]
        if not new_ct_id:
            tx.cost_treatment_id = None
            tx.procedure_id = None
            tx.operational_cost_snapshot = None
        else:
            ct = await db.scalar(
                select(CostTreatment).where(
                    CostTreatment.id == uuid.UUID(str(new_ct_id)),
                    CostTreatment.clinic_id == clinic_id,
                )
            )
            if ct:
                tx.cost_treatment_id = uuid.UUID(str(new_ct_id))
                tx.procedure_id = None
                if upd_cost_override is not None:
                    tx.operational_cost_snapshot = round(Decimal(str(upd_cost_override)), 2)
                elif upd_quantity is not None:
                    fee = Decimal(str(ct.professional_fee_per_hour or 0)) * Decimal(str(ct.total_hours or 0))
                    fixed = Decimal(str(ct.fixed_costs or 0))
                    margin = Decimal(str(ct.clinic_margin_pct or 0))
                    raw = (fee + fixed) * upd_quantity / upd_sessions
                    tx.operational_cost_snapshot = round(raw * (1 + margin), 2)

    elif "procedure_id" in data:
        proc_id = data["procedure_id"]
        if not proc_id:
            tx.procedure_id = None
            tx.cost_treatment_id = None
            tx.operational_cost_snapshot = None
        else:
            pid = uuid.UUID(str(proc_id))
            ct_check = await db.scalar(
                select(CostTreatment).where(
                    CostTreatment.id == pid,
                    CostTreatment.clinic_id == clinic_id,
                )
            )
            if ct_check:
                tx.cost_treatment_id = pid
                tx.procedure_id = None
                if upd_cost_override is not None:
                    tx.operational_cost_snapshot = round(Decimal(str(upd_cost_override)), 2)
                else:
                    raw = Decimal(str(ct_check.fixed_costs or 0)) * (upd_quantity or 1) / upd_sessions
                    margin = Decimal(str(ct_check.clinic_margin_pct or 0))
                    tx.operational_cost_snapshot = round(raw * (1 + margin), 2)
            else:
                proc = await db.scalar(
                    select(ProcedureCatalog).where(
                        ProcedureCatalog.id == pid,
                        ProcedureCatalog.clinic_id == clinic_id,
                    )
                )
                if proc:
                    tx.procedure_id = pid
                    tx.cost_treatment_id = None
                    if upd_cost_override is not None:
                        tx.operational_cost_snapshot = round(Decimal(str(upd_cost_override)), 2)
                    elif proc.operational_cost:
                        treatment = await db.scalar(
                            select(CostTreatment).where(
                                CostTreatment.procedure_catalog_id == proc.id,
                                CostTreatment.clinic_id == clinic_id,
                            )
                        )
                        margin = Decimal(str(treatment.clinic_margin_pct)) if treatment else Decimal("0.15")
                        raw = Decimal(str(proc.operational_cost)) * (upd_quantity or 1) / upd_sessions
                        tx.operational_cost_snapshot = round(raw * (1 + margin), 2)
                    else:
                        tx.operational_cost_snapshot = None
    elif upd_cost_override is not None and (tx.procedure_id or tx.cost_treatment_id):
        tx.operational_cost_snapshot = round(Decimal(str(upd_cost_override)), 2)
    elif upd_quantity is not None and tx.procedure_id:
        # Solo cambió la cantidad o sesiones, mismo procedimiento del catálogo
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

    if "deducted_materials" in data:
        tx.deducted_materials = data["deducted_materials"]

    if "extra_procedures" in data:
        tx.extra_procedures = data["extra_procedures"]

    if "original_amount" in data or "original_currency" in data:
        currency = data.get("original_currency", tx.original_currency or "NIO")
        _raw_edit = data.get("original_amount")
        original_amount = Decimal(str(_raw_edit if _raw_edit is not None else (tx.original_amount if tx.original_amount is not None else tx.amount_cordobas)))
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
            FinanceTransaction.deleted_at.is_(None),
        )
    )
    if not tx:
        raise NotFoundError("Transacción")
    tx.deleted_at = datetime.now(timezone.utc)
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
