import uuid
import httpx
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.whatsapp import WhatsappConversation
from app.models.clinic import Clinic, ClinicSettings
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.treatment import ProcedureCatalog
from app.models.user import User

settings = get_settings()
CLINIC_TZ = ZoneInfo("America/Managua")
HISTORY_LIMIT = 20

TOOLS = [
    {
        "name": "buscar_paciente",
        "description": "Busca un paciente en la clínica por número de teléfono o nombre completo",
        "input_schema": {
            "type": "object",
            "properties": {
                "telefono": {"type": "string", "description": "Número de teléfono del paciente (opcional)"},
                "nombre": {"type": "string", "description": "Nombre completo del paciente (opcional)"},
            },
        },
    },
    {
        "name": "ver_citas",
        "description": "Ver las próximas citas agendadas de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "UUID del paciente"},
            },
            "required": ["patient_id"],
        },
    },
    {
        "name": "ver_disponibilidad",
        "description": "Ver horarios disponibles para agendar una cita en una fecha específica",
        "input_schema": {
            "type": "object",
            "properties": {
                "fecha": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"},
            },
            "required": ["fecha"],
        },
    },
    {
        "name": "crear_cita",
        "description": "Agendar una nueva cita para el paciente (solo después de confirmar con el paciente)",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "UUID del paciente"},
                "fecha_hora": {"type": "string", "description": "Fecha y hora en formato YYYY-MM-DD HH:MM"},
                "tipo": {
                    "type": "string",
                    "description": "Tipo de cita: primera_consulta, control, limpieza, extraccion, endodoncia, ortodoncia, protesis, cirugia, emergencia, otro",
                },
                "notas": {"type": "string", "description": "Notas adicionales para el dentista"},
            },
            "required": ["patient_id", "fecha_hora"],
        },
    },
]


async def send_wa_message(to: str, text: str) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://graph.facebook.com/v21.0/{settings.whatsapp_phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {settings.whatsapp_token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": text},
            },
            timeout=10,
        )


async def _get_clinic(db: AsyncSession) -> Clinic | None:
    return await db.scalar(
        select(Clinic)
        .options(
            selectinload(Clinic.settings),
            selectinload(Clinic.working_hours),
        )
        .where(Clinic.is_active == True)
        .limit(1)
    )


async def _get_catalog(db: AsyncSession, clinic_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(ProcedureCatalog)
        .where(ProcedureCatalog.clinic_id == clinic_id, ProcedureCatalog.is_active == True)
        .order_by(ProcedureCatalog.sort_order)
    )
    return [
        {
            "nombre": item.name,
            "precio": float(item.default_price or 0),
            "descripcion": item.description or "",
        }
        for item in result.scalars()
    ]


async def _get_history(db: AsyncSession, clinic_id: uuid.UUID, wa_id: str) -> list[dict]:
    result = await db.execute(
        select(WhatsappConversation)
        .where(
            WhatsappConversation.clinic_id == clinic_id,
            WhatsappConversation.wa_id == wa_id,
        )
        .order_by(desc(WhatsappConversation.created_at))
        .limit(HISTORY_LIMIT)
    )
    rows = list(reversed(result.scalars().all()))
    return [{"role": row.role, "content": row.content} for row in rows]


async def _save_message(db: AsyncSession, clinic_id: uuid.UUID, wa_id: str, role: str, content: str) -> None:
    db.add(WhatsappConversation(clinic_id=clinic_id, wa_id=wa_id, role=role, content=content))
    await db.commit()


def _build_system_prompt(clinic: Clinic, cs: ClinicSettings, catalog: list[dict]) -> str:
    days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    hours_lines = []
    for wh in sorted(clinic.working_hours, key=lambda x: x.day_of_week):
        if wh.is_working_day:
            parts = []
            if wh.morning_open and wh.morning_close:
                parts.append(f"{wh.morning_open.strftime('%H:%M')}-{wh.morning_close.strftime('%H:%M')}")
            if wh.afternoon_open and wh.afternoon_close:
                parts.append(f"{wh.afternoon_open.strftime('%H:%M')}-{wh.afternoon_close.strftime('%H:%M')}")
            hours_lines.append(f"  {days[wh.day_of_week]}: {' y '.join(parts)}")
        else:
            hours_lines.append(f"  {days[wh.day_of_week]}: Cerrado")

    catalog_lines = (
        "\n".join(
            f"  - {i['nombre']}: C${i['precio']:.0f}" + (f" — {i['descripcion']}" if i["descripcion"] else "")
            for i in catalog
        )
        if catalog
        else "  (catálogo no configurado)"
    )

    contact = []
    if cs.phone:
        contact.append(f"Teléfono: {cs.phone}")
    if cs.address_line1:
        addr = cs.address_line1 + (f", {cs.city}" if cs.city else "")
        contact.append(f"Dirección: {addr}")
    if cs.email:
        contact.append(f"Email: {cs.email}")

    return f"""Eres el asistente virtual de {cs.display_name}, una clínica dental. Atiendes pacientes por WhatsApp.

{chr(10).join(contact)}

Horarios de atención:
{chr(10).join(hours_lines) if hours_lines else "  (no configurados)"}

Servicios y precios:
{catalog_lines}

Puedes ayudar con:
1. Preguntas sobre servicios, precios y horarios
2. Consultar las citas agendadas del paciente
3. Agendar nuevas citas

Reglas importantes:
- Responde SIEMPRE en español, amable y breve (es WhatsApp, no email)
- Para buscar al paciente, primero intenta con su número de WhatsApp. Si no lo encuentras, pide su nombre
- Si el paciente no está registrado en la clínica, dile que llame o visite personalmente para registrarse
- SIEMPRE confirma los datos antes de agendar una cita
- Hoy es {datetime.now(CLINIC_TZ).strftime('%A %d/%m/%Y')}"""


async def _execute_tool(
    name: str, inp: dict, db: AsyncSession, clinic_id: uuid.UUID, wa_id: str
) -> str:
    if name == "buscar_paciente":
        telefono = (inp.get("telefono") or "").strip()
        nombre = (inp.get("nombre") or "").strip()

        query = select(Patient).where(Patient.clinic_id == clinic_id, Patient.is_active == True)

        if telefono:
            digits = "".join(c for c in telefono if c.isdigit())[-8:]
            query = query.where(
                Patient.phone.like(f"%{digits}%") | Patient.phone_secondary.like(f"%{digits}%")
            )
        elif nombre:
            for part in nombre.lower().split():
                query = query.where(
                    Patient.first_name.ilike(f"%{part}%") | Patient.last_name.ilike(f"%{part}%")
                )
        else:
            digits = "".join(c for c in wa_id if c.isdigit())[-8:]
            query = query.where(
                Patient.phone.like(f"%{digits}%") | Patient.phone_secondary.like(f"%{digits}%")
            )

        result = await db.execute(query.limit(5))
        patients = result.scalars().all()

        if not patients:
            return "No se encontró ningún paciente con esos datos."

        return "Pacientes encontrados:\n" + "\n".join(
            f"ID: {p.id} | {p.first_name} {p.last_name} | Tel: {p.phone or 'N/A'}"
            for p in patients
        )

    if name == "ver_citas":
        try:
            pid = uuid.UUID(inp["patient_id"])
        except (ValueError, KeyError):
            return "ID de paciente inválido."

        now = datetime.now(CLINIC_TZ)
        result = await db.execute(
            select(Appointment)
            .where(
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == pid,
                Appointment.scheduled_at >= now,
                Appointment.status.not_in(["cancelled", "no_show"]),
            )
            .order_by(Appointment.scheduled_at)
            .limit(5)
        )
        apts = result.scalars().all()

        if not apts:
            return "Este paciente no tiene citas próximas agendadas."

        return "Próximas citas:\n" + "\n".join(
            f"- {apt.scheduled_at.astimezone(CLINIC_TZ).strftime('%A %d/%m/%Y a las %H:%M')} — {apt.appointment_type}"
            for apt in apts
        )

    if name == "ver_disponibilidad":
        try:
            slot_date = date.fromisoformat(inp["fecha"])
        except (ValueError, KeyError):
            return "Fecha inválida. Usa formato YYYY-MM-DD."

        dentist = await db.scalar(
            select(User).where(User.clinic_id == clinic_id, User.is_active == True).limit(1)
        )
        if not dentist:
            return "No hay dentistas disponibles."

        from app.services.appointment_service import get_available_slots
        slots = await get_available_slots(db, clinic_id, dentist.id, slot_date)

        if not slots:
            return f"No hay horarios disponibles el {slot_date.strftime('%d/%m/%Y')}."

        return f"Horarios disponibles el {slot_date.strftime('%A %d/%m/%Y')}:\n" + ", ".join(slots)

    if name == "crear_cita":
        try:
            pid = uuid.UUID(inp["patient_id"])
            local_dt = datetime.strptime(inp["fecha_hora"], "%Y-%m-%d %H:%M").replace(tzinfo=CLINIC_TZ)
        except (ValueError, KeyError):
            return "Datos inválidos. Verifica patient_id y fecha_hora (YYYY-MM-DD HH:MM)."

        dentist = await db.scalar(
            select(User).where(User.clinic_id == clinic_id, User.is_active == True).limit(1)
        )
        if not dentist:
            return "No hay dentistas disponibles."

        valid_types = [
            "primera_consulta", "control", "limpieza", "extraccion",
            "endodoncia", "ortodoncia", "protesis", "cirugia", "emergencia", "otro",
        ]
        tipo = inp.get("tipo", "otro")
        if tipo not in valid_types:
            tipo = "otro"

        try:
            from app.schemas.appointment import AppointmentCreate
            from app.services.appointment_service import create_appointment as svc_create

            data = AppointmentCreate(
                patient_id=pid,
                dentist_id=dentist.id,
                scheduled_at=local_dt,
                duration_minutes=30,
                appointment_type=tipo,
                notes=("Agendada por WhatsApp. " + inp.get("notas", "")).strip(),
            )
            appt = await svc_create(db, clinic_id, dentist.id, data)
            dt_local = appt.scheduled_at.astimezone(CLINIC_TZ)
            return f"Cita agendada para el {dt_local.strftime('%A %d/%m/%Y a las %H:%M')}."
        except Exception as e:
            return f"No se pudo agendar la cita: {e}"

    return "Herramienta desconocida."


def _blocks_to_list(content) -> list[dict]:
    out = []
    for block in content:
        if block.type == "text":
            out.append({"type": "text", "text": block.text})
        elif block.type == "tool_use":
            out.append({"type": "tool_use", "id": block.id, "name": block.name, "input": block.input})
    return out


async def process_message(db: AsyncSession, wa_id: str, text: str) -> None:
    import anthropic

    clinic = await _get_clinic(db)
    if not clinic or not clinic.settings:
        return

    clinic_id = clinic.id
    cs = clinic.settings

    await _save_message(db, clinic_id, wa_id, "user", text)

    history = await _get_history(db, clinic_id, wa_id)
    catalog = await _get_catalog(db, clinic_id)
    system_prompt = _build_system_prompt(clinic, cs, catalog)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    messages = list(history)
    final_text = ""

    for _ in range(5):
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system_prompt,
            messages=messages,
            tools=TOOLS,
        )

        if response.stop_reason == "end_turn":
            final_text = next((b.text for b in response.content if b.type == "text"), "")
            break

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": _blocks_to_list(response.content)})

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result_text = await _execute_tool(block.name, block.input, db, clinic_id, wa_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_text,
                    })

            messages.append({"role": "user", "content": tool_results})

    if final_text:
        await _save_message(db, clinic_id, wa_id, "assistant", final_text)
        await send_wa_message(wa_id, final_text)
