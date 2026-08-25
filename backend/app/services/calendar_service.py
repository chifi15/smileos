"""
Sincronización de Google Calendar via iCal (URL privada).
No requiere OAuth — solo la URL secreta .ics de Google Calendar.
"""
import re
import uuid
import unicodedata
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher

import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent
from app.models.patient import Patient
from app.models.clinic import ClinicSettings


# ─── iCal parser ──────────────────────────────────────────────────────────────

def _unfold(text: str) -> str:
    """Desdobla líneas continuadas (RFC 5545 §3.1)."""
    return re.sub(r"\r?\n[ \t]", "", text)


def _parse_dt(value: str) -> datetime | None:
    """Parsea DTSTART/DTEND de iCal a datetime UTC."""
    value = value.strip()
    try:
        if len(value) == 8:
            # DATE only: 20260815
            return datetime(int(value[:4]), int(value[4:6]), int(value[6:8]), tzinfo=timezone.utc)
        # Remove trailing Z
        utc = value.endswith("Z")
        clean = value.rstrip("Z").replace("T", "")
        dt = datetime(
            int(clean[0:4]), int(clean[4:6]), int(clean[6:8]),
            int(clean[8:10]) if len(clean) > 8 else 0,
            int(clean[10:12]) if len(clean) > 10 else 0,
            int(clean[12:14]) if len(clean) > 12 else 0,
        )
        if utc:
            return dt.replace(tzinfo=timezone.utc)
        # Sin zona horaria → asumimos UTC (suficiente para calcular antigüedad)
        return dt.replace(tzinfo=timezone.utc)
    except (ValueError, IndexError):
        return None


def _parse_ical(raw: str) -> list[dict]:
    """Extrae VEVENTs de un texto iCal y retorna lista de dicts."""
    text = _unfold(raw)
    events = []
    current: dict | None = None

    for line in text.splitlines():
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            if current:
                events.append(current)
            current = None
        elif current is not None and ":" in line:
            # Key puede incluir parámetros: DTSTART;TZID=America/Managua:20260815T100000
            raw_key, _, val = line.partition(":")
            key = raw_key.split(";")[0].upper()
            if key in ("UID", "SUMMARY", "DTSTART", "DTEND", "STATUS", "COLOR"):
                current[key] = val.strip()

    return events


# ─── Patient matching ──────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii").lower().strip()


def _extract_name(summary: str) -> str:
    """Extrae el nombre del paciente del título del evento."""
    for sep in (" - ", " – ", " | ", " / ", ": "):
        if sep in summary:
            return summary.split(sep)[0].strip()
    return summary.strip()


def _match_patient(name: str, patients: list) -> tuple[uuid.UUID | None, float]:
    return _match_patient_rows(name, patients)


def _match_patient_rows(name: str, patients: list) -> tuple[uuid.UUID | None, float]:
    """Recibe rows con atributos id, first_name, last_name."""
    norm_name = _normalize(name)
    if not norm_name:
        return None, 0.0

    best_id: uuid.UUID | None = None
    best_score = 0.0

    for p in patients:
        full = _normalize(f"{p.first_name} {p.last_name}")
        score = SequenceMatcher(None, norm_name, full).ratio()
        parts = full.split()
        if len(parts) >= 2:
            short = f"{parts[0]} {parts[-1]}"
            score = max(score, SequenceMatcher(None, norm_name, short).ratio())
        if score > best_score:
            best_score = score
            best_id = p.id

    if best_score >= 0.75:
        return best_id, best_score
    return None, 0.0


# ─── Google Calendar color names → hex ────────────────────────────────────────

GCAL_COLORS: dict[str, str] = {
    "tomato":    "#D50000",
    "flamingo":  "#E67C73",
    "tangerine": "#F4511E",
    "banana":    "#F6BF26",
    "sage":      "#33B679",
    "basil":     "#0B8043",
    "peacock":   "#039BE5",
    "blueberry": "#3F51B5",
    "lavender":  "#7986CB",
    "grape":     "#8E24AA",
    "graphite":  "#616161",
}


def _resolve_color(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip().lower()
    return GCAL_COLORS.get(raw, raw if raw.startswith("#") else None)


# ─── Sync logic ───────────────────────────────────────────────────────────────

SYNC_COOLDOWN_MINUTES = 15


async def _sync_from_gcal_api(db: AsyncSession, settings, clinic_id: uuid.UUID, pg_insert) -> dict:
    """Sincroniza desde Google Calendar API. Obtiene colorId por evento."""
    from app.services import google_oauth_service as oauth

    try:
        access_token = await oauth.refresh_access_token(settings.google_refresh_token)
    except Exception as e:
        return {"error": f"No se pudo obtener access_token: {str(e)}"}

    cal_id = settings.google_calendar_id or "primary"

    now = datetime.now(timezone.utc)
    time_min = now - timedelta(days=365)  # último año
    time_max = now + timedelta(days=180)  # próximos 6 meses

    try:
        gcal_items = await oauth.list_google_events(access_token, cal_id, time_min, time_max)
    except Exception as e:
        return {"error": f"Error leyendo Google Calendar API: {str(e)}"}

    # Borrar eventos sincronizados vía iCal (sin google_event_id) para evitar duplicados
    await db.execute(
        delete(CalendarEvent).where(
            CalendarEvent.clinic_id == clinic_id,
            CalendarEvent.google_event_id.is_(None),
        )
    )

    # Obtener el color por defecto del calendario (para eventos sin colorId)
    calendar_default_color: str | None = None
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient() as _client:
            _resp = await _client.get(
                f"https://www.googleapis.com/calendar/v3/users/me/calendarList/{cal_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if _resp.is_success:
                _cal = _resp.json()
                calendar_default_color = _cal.get("backgroundColor")
    except Exception:
        pass

    # Cargar pacientes para matching
    patients_result = await db.execute(
        select(Patient.id, Patient.first_name, Patient.last_name)
        .where(Patient.clinic_id == clinic_id, Patient.is_active == True)  # noqa
    )
    patients = list(patients_result.fetchall())

    rows = []
    matched = 0
    colors_found = 0

    for item in gcal_items:
        if item.get("status") == "cancelled":
            continue
        event_id = item.get("id", "")
        summary = (item.get("summary") or "").strip()
        if not event_id or not summary:
            continue

        start_raw = item.get("start", {})
        end_raw = item.get("end", {})
        start_at = _parse_gcal_dt(start_raw)
        end_at = _parse_gcal_dt(end_raw)
        if not start_at:
            continue
        if not end_at:
            end_at = start_at + timedelta(hours=1)

        # Color: colorId del evento o del calendario (1-11)
        color_id = item.get("colorId")
        hex_color = oauth.resolve_color_id(color_id) or calendar_default_color
        if hex_color:
            colors_found += 1

        # Match paciente
        patient_name = _extract_name(summary)
        patient_id, confidence = _match_patient_rows(patient_name, patients)
        if patient_id:
            matched += 1

        rows.append({
            "id": uuid.uuid4(),
            "clinic_id": clinic_id,
            "ical_uid": item.get("iCalUID", event_id),
            "google_event_id": event_id,
            "title": summary,
            "start_at": start_at,
            "end_at": end_at,
            "patient_id": patient_id,
            "match_confidence": confidence if patient_id else None,
            "gcal_color": hex_color,
            "created_at": now,
            "updated_at": now,
        })

    if rows:
        stmt = pg_insert(CalendarEvent).values(rows)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_calendar_events_clinic_ical_uid",
            set_={
                "title": stmt.excluded.title,
                "start_at": stmt.excluded.start_at,
                "end_at": stmt.excluded.end_at,
                "patient_id": stmt.excluded.patient_id,
                "match_confidence": stmt.excluded.match_confidence,
                "gcal_color": stmt.excluded.gcal_color,
                "google_event_id": stmt.excluded.google_event_id,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        await db.execute(stmt)

    settings.calendar_last_synced_at = now
    await db.commit()

    return {
        "total_events": len(rows),
        "matched_patients": matched,
        "colors_found": colors_found,
        "source": "google_api",
        "synced_at": now.isoformat(),
    }


def _parse_gcal_dt(dt_obj: dict) -> datetime | None:
    """Parsea el objeto start/end de Google Calendar API."""
    if not dt_obj:
        return None
    dt_str = dt_obj.get("dateTime") or dt_obj.get("date")
    if not dt_str:
        return None
    try:
        if "T" in dt_str:
            # dateTime: "2026-08-15T10:00:00-06:00"
            return datetime.fromisoformat(dt_str).astimezone(timezone.utc).replace(tzinfo=timezone.utc)
        else:
            # date only: "2026-08-15"
            d = datetime.fromisoformat(dt_str)
            return d.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


async def get_sync_status(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    result = await db.execute(
        select(ClinicSettings.ical_url, ClinicSettings.calendar_last_synced_at)
        .where(ClinicSettings.clinic_id == clinic_id)
    )
    row = result.one_or_none()
    if not row:
        return {"configured": False, "last_synced_at": None}
    return {
        "configured": bool(row.ical_url),
        "last_synced_at": row.calendar_last_synced_at.isoformat() if row.calendar_last_synced_at else None,
    }


async def sync_calendar(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """
    Sincroniza desde Google Calendar API (si hay OAuth) o desde iCal.
    Usa bulk upsert para manejar miles de eventos sin timeout.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.services import google_oauth_service as oauth

    # Obtener configuración
    result = await db.execute(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        return {"error": "Clínica no encontrada."}

    # Si hay OAuth conectado, sincronizar desde la API de Google Calendar (con colores)
    if settings.google_refresh_token:
        return await _sync_from_gcal_api(db, settings, clinic_id, pg_insert)

    if not settings.ical_url:
        return {"error": "No hay URL de iCal configurada."}

    # Fetch iCal
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(settings.ical_url)
            resp.raise_for_status()
            raw = resp.text
    except httpx.HTTPError as e:
        return {"error": f"No se pudo descargar el calendario: {str(e)}"}

    # Parse
    ical_events = _parse_ical(raw)

    # Cargar pacientes activos para matching (un solo query)
    patients_result = await db.execute(
        select(Patient.id, Patient.first_name, Patient.last_name)
        .where(Patient.clinic_id == clinic_id, Patient.is_active == True)  # noqa
    )
    patients = list(patients_result.fetchall())

    # Construir lista de dicts para bulk upsert (procesado en memoria)
    now = datetime.now(timezone.utc)
    rows = []
    matched = 0

    for ev in ical_events:
        uid = ev.get("UID", "")
        summary = ev.get("SUMMARY", "").strip()
        if not uid or not summary:
            continue
        if ev.get("STATUS", "").upper() == "CANCELLED":
            continue

        start_at = _parse_dt(ev.get("DTSTART", ""))
        end_at = _parse_dt(ev.get("DTEND", ev.get("DTSTART", "")))
        if not start_at:
            continue
        if not end_at:
            end_at = start_at + timedelta(hours=1)

        # Match paciente (en memoria, sin queries adicionales)
        patient_name = _extract_name(summary)
        patient_id, confidence = _match_patient_rows(patient_name, patients)
        if patient_id:
            matched += 1

        rows.append({
            "id": uuid.uuid4(),
            "clinic_id": clinic_id,
            "ical_uid": uid,
            "title": summary,
            "start_at": start_at,
            "end_at": end_at,
            "patient_id": patient_id,
            "match_confidence": confidence if patient_id else None,
            "gcal_color": _resolve_color(ev.get("COLOR")),
            "created_at": now,
            "updated_at": now,
        })

    total = len(rows)

    if rows:
        # Bulk upsert: INSERT ... ON CONFLICT DO UPDATE (un solo statement SQL)
        stmt = pg_insert(CalendarEvent).values(rows)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_calendar_events_clinic_ical_uid",
            set_={
                "title": stmt.excluded.title,
                "start_at": stmt.excluded.start_at,
                "end_at": stmt.excluded.end_at,
                "patient_id": stmt.excluded.patient_id,
                "match_confidence": stmt.excluded.match_confidence,
                "gcal_color": stmt.excluded.gcal_color,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        await db.execute(stmt)

    settings.calendar_last_synced_at = now
    await db.commit()

    colors_found = sum(1 for r in rows if r.get("gcal_color"))
    return {
        "total_events": total,
        "matched_patients": matched,
        "colors_found": colors_found,
        "synced_at": now.isoformat(),
    }


async def get_events(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    date_from: str,
    date_to: str,
    auto_sync: bool = True,
) -> list[dict]:
    """Retorna eventos en el rango, disparando sync automático si toca."""
    if auto_sync:
        result = await db.execute(
            select(
                ClinicSettings.calendar_last_synced_at,
                ClinicSettings.ical_url,
                ClinicSettings.google_refresh_token,
            )
            .where(ClinicSettings.clinic_id == clinic_id)
        )
        row = result.one_or_none()
        has_source = row and (row.ical_url or row.google_refresh_token)
        if has_source:
            stale = (
                row.calendar_last_synced_at is None
                or (datetime.now(timezone.utc) - row.calendar_last_synced_at)
                > timedelta(minutes=SYNC_COOLDOWN_MINUTES)
            )
            if stale:
                await sync_calendar(db, clinic_id)

    from sqlalchemy import and_
    from datetime import date as _date

    try:
        start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        end = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        return []

    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.clinic_id == clinic_id,
            CalendarEvent.start_at >= start,
            CalendarEvent.start_at <= end,
        )
        .order_by(CalendarEvent.start_at)
    )
    events = list(result.scalars().all())

    return [
        {
            "id": str(e.id),
            "ical_uid": e.ical_uid,
            "title": e.title,
            "start_at": e.start_at.isoformat(),
            "end_at": e.end_at.isoformat(),
            "patient_id": str(e.patient_id) if e.patient_id else None,
            "match_confidence": e.match_confidence,
            "gcal_color": e.gcal_color,
        }
        for e in events
    ]
