import logging
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

logger = logging.getLogger("smileos")
settings = get_settings()
CLINIC_TZ = ZoneInfo("America/Managua")
HISTORY_LIMIT = 20
GEMINI_MODEL = "gemini-3.1-flash-lite"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

TOOL_DECLARATIONS = [
    {
        "name": "buscar_paciente",
        "description": "Busca un paciente en la clínica por teléfono o nombre completo",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "telefono": {"type": "STRING", "description": "Teléfono del paciente"},
                "nombre": {"type": "STRING", "description": "Nombre completo del paciente"},
            },
        },
    },
    {
        "name": "ver_citas",
        "description": "Ver las próximas citas agendadas de un paciente",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "patient_id": {"type": "STRING", "description": "UUID del paciente"},
            },
            "required": ["patient_id"],
        },
    },
    {
        "name": "ver_disponibilidad",
        "description": "Ver horarios disponibles para agendar en una fecha específica",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "fecha": {"type": "STRING", "description": "Fecha en formato YYYY-MM-DD"},
            },
            "required": ["fecha"],
        },
    },
    {
        "name": "crear_cita",
        "description": "Agendar una nueva cita para el paciente (solo tras confirmar con él)",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "patient_id": {"type": "STRING", "description": "UUID del paciente"},
                "fecha_hora": {"type": "STRING", "description": "Fecha y hora: YYYY-MM-DD HH:MM"},
                "tipo": {"type": "STRING", "description": "primera_consulta, control, limpieza, extraccion, endodoncia, ortodoncia, protesis, cirugia, emergencia, otro"},
                "notas": {"type": "STRING", "description": "Notas para el dentista"},
            },
            "required": ["patient_id", "fecha_hora"],
        },
    },
]


async def send_wa_message(to: str, text: str) -> None:
    async with httpx.AsyncClient() as client:
        r = await client.post(
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
        if r.status_code != 200:
            logger.error("WhatsApp send error %s: %s", r.status_code, r.text[:200])


async def _call_gemini(system_prompt: str, messages: list[dict]) -> dict:
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": messages,
        "tools": [{"function_declarations": TOOL_DECLARATIONS}],
        "generation_config": {"max_output_tokens": 512, "temperature": 0.7},
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            GEMINI_URL,
            params={"key": settings.gemini_api_key},
            json=payload,
            timeout=30,
        )
    return r.json()


async def _get_clinic(db: AsyncSession) -> Clinic | None:
    return await db.scalar(
        select(Clinic)
        .options(selectinload(Clinic.settings), selectinload(Clinic.working_hours))
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
        {"nombre": i.name, "precio": float(i.default_price or 0), "descripcion": i.description or ""}
        for i in result.scalars()
    ]


async def _get_history(db: AsyncSession, clinic_id: uuid.UUID, wa_id: str) -> list[dict]:
    result = await db.execute(
        select(WhatsappConversation)
        .where(WhatsappConversation.clinic_id == clinic_id, WhatsappConversation.wa_id == wa_id)
        .order_by(desc(WhatsappConversation.created_at))
        .limit(HISTORY_LIMIT)
    )
    rows = list(reversed(result.scalars().all()))
    return [{"role": r.role, "content": r.content} for r in rows]


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
        if catalog else "  (catálogo no configurado)"
    )

    contact = []
    if cs.phone:
        contact.append(f"Teléfono: {cs.phone}")
    if cs.address_line1:
        contact.append(f"Dirección: {cs.address_line1}" + (f", {cs.city}" if cs.city else ""))
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

Reglas:
- Responde SIEMPRE en español, amable y breve (es WhatsApp)
- Para buscar al paciente intenta primero con su número de WhatsApp, luego pide su nombre
- Si no está registrado, dile que llame o visite la clínica
- Confirma SIEMPRE los datos antes de agendar
- Hoy es {datetime.now(CLINIC_TZ).strftime('%A %d/%m/%Y')}"""


async def _execute_tool(name: str, args: dict, db: AsyncSession, clinic_id: uuid.UUID, wa_id: str) -> str:
    if name == "buscar_paciente":
        telefono = (args.get("telefono") or "").strip()
        nombre = (args.get("nombre") or "").strip()
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
            f"ID: {p.id} | {p.first_name} {p.last_name} | Tel: {p.phone or 'N/A'}" for p in patients
        )

    if name == "ver_citas":
        try:
            pid = uuid.UUID(args["patient_id"])
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
            .order_by(Appointment.scheduled_at).limit(5)
        )
        apts = result.scalars().all()
        if not apts:
            return "Este paciente no tiene citas próximas."
        return "Próximas citas:\n" + "\n".join(
            f"- {apt.scheduled_at.astimezone(CLINIC_TZ).strftime('%A %d/%m/%Y a las %H:%M')} — {apt.appointment_type}"
            for apt in apts
        )

    if name == "ver_disponibilidad":
        try:
            slot_date = date.fromisoformat(args["fecha"])
        except (ValueError, KeyError):
            return "Fecha inválida. Usa YYYY-MM-DD."
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
            pid = uuid.UUID(args["patient_id"])
            local_dt = datetime.strptime(args["fecha_hora"], "%Y-%m-%d %H:%M").replace(tzinfo=CLINIC_TZ)
        except (ValueError, KeyError):
            return "Datos inválidos. Verifica patient_id y fecha_hora (YYYY-MM-DD HH:MM)."
        dentist = await db.scalar(
            select(User).where(User.clinic_id == clinic_id, User.is_active == True).limit(1)
        )
        if not dentist:
            return "No hay dentistas disponibles."
        valid_types = ["primera_consulta", "control", "limpieza", "extraccion", "endodoncia", "ortodoncia", "protesis", "cirugia", "emergencia", "otro"]
        tipo = args.get("tipo", "otro")
        if tipo not in valid_types:
            tipo = "otro"
        try:
            from app.schemas.appointment import AppointmentCreate
            from app.services.appointment_service import create_appointment as svc_create
            data = AppointmentCreate(
                patient_id=pid, dentist_id=dentist.id, scheduled_at=local_dt,
                duration_minutes=30, appointment_type=tipo,
                notes=("Agendada por WhatsApp. " + args.get("notas", "")).strip(),
            )
            appt = await svc_create(db, clinic_id, dentist.id, data)
            dt_local = appt.scheduled_at.astimezone(CLINIC_TZ)
            return f"Cita agendada para el {dt_local.strftime('%A %d/%m/%Y a las %H:%M')}."
        except Exception as e:
            return f"No se pudo agendar la cita: {e}"

    return "Herramienta desconocida."


async def process_message(db: AsyncSession, wa_id: str, text: str) -> None:
    clinic = await _get_clinic(db)
    if not clinic or not clinic.settings:
        logger.error("WhatsApp: no se encontró clínica activa")
        return

    clinic_id = clinic.id

    prev_history = await _get_history(db, clinic_id, wa_id)
    await _save_message(db, clinic_id, wa_id, "user", text)

    catalog = await _get_catalog(db, clinic_id)
    system_prompt = _build_system_prompt(clinic, clinic.settings, catalog)

    # Build Gemini messages (role: "user" | "model")
    gemini_messages = [
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
        for m in prev_history
    ]
    gemini_messages.append({"role": "user", "parts": [{"text": text}]})

    final_text = ""

    try:
        for _ in range(5):
            response = await _call_gemini(system_prompt, gemini_messages)

            if "error" in response:
                logger.error("Gemini error: %s", response["error"])
                break

            candidate = response.get("candidates", [{}])[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            finish_reason = candidate.get("finishReason", "")

            # Collect function calls
            fn_calls = [p["functionCall"] for p in parts if "functionCall" in p]

            if not fn_calls:
                # Extract text response
                final_text = "".join(p.get("text", "") for p in parts if "text" in p)
                break

            # Add assistant message with tool calls to history
            gemini_messages.append({"role": "model", "parts": parts})

            # Execute tools and build response parts
            tool_result_parts = []
            for fc in fn_calls:
                fn_name = fc.get("name", "")
                fn_args = fc.get("args", {})
                result = await _execute_tool(fn_name, fn_args, db, clinic_id, wa_id)
                tool_result_parts.append({
                    "functionResponse": {
                        "name": fn_name,
                        "response": {"result": result},
                    }
                })

            gemini_messages.append({"role": "user", "parts": tool_result_parts})

    except Exception as exc:
        logger.error("WhatsApp bot error para %s: %s", wa_id, exc, exc_info=True)

    if final_text:
        await _save_message(db, clinic_id, wa_id, "assistant", final_text)
        await send_wa_message(wa_id, final_text)
    else:
        logger.warning("WhatsApp: no se generó respuesta para %s", wa_id)
