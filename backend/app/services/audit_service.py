import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.user import User


async def log(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    resource_type: str,
    resource_id: str,
    description: str,
    patient_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> None:
    entry = AuditLog(
        clinic_id=clinic_id,
        user_id=user_id,
        patient_id=patient_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        changes=metadata,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.flush()


async def list_feed(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    resource_type: str | None = None,
    resource_id: str | None = None,
    patient_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    per_page: int = 30,
) -> tuple[list[AuditLog], int]:
    q = (
        select(AuditLog)
        .where(AuditLog.clinic_id == clinic_id)
        .options(selectinload(AuditLog.user))
    )

    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.where(AuditLog.resource_id == resource_id)
    if patient_id:
        q = q.where(AuditLog.patient_id == patient_id)
    if date_from:
        q = q.where(AuditLog.created_at >= date_from)
    if date_to:
        q = q.where(AuditLog.created_at <= date_to)

    count_q = select(func.count(AuditLog.id)).where(AuditLog.clinic_id == clinic_id)
    if resource_type:
        count_q = count_q.where(AuditLog.resource_type == resource_type)
    if resource_id:
        count_q = count_q.where(AuditLog.resource_id == resource_id)
    if patient_id:
        count_q = count_q.where(AuditLog.patient_id == patient_id)
    if date_from:
        count_q = count_q.where(AuditLog.created_at >= date_from)
    if date_to:
        count_q = count_q.where(AuditLog.created_at <= date_to)
    total: int = await db.scalar(count_q) or 0

    q = q.order_by(desc(AuditLog.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    return list(result.scalars().all()), total
