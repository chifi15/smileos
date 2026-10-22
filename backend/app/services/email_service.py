import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import resend
from app.core.config import get_settings

logger = logging.getLogger(__name__)

CLINIC_TZ = ZoneInfo("America/Managua")


def send_password_reset_email(to_email: str, to_name: str, reset_url: str) -> bool:
    settings = get_settings()
    api_key = settings.resend_api_key
    logger.info(f"Enviando email a {to_email}, key vacia: {not api_key}")
    if not api_key:
        logger.error("RESEND_API_KEY no configurada")
        return False

    resend.api_key = api_key

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1e3a5f;">Restablecer contraseña</h2>
      <p>Hola {to_name},</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SmileOS.</p>
      <p>
        <a href="{reset_url}"
           style="display:inline-block; background:#3b82f6; color:white; padding:12px 24px;
                  border-radius:8px; text-decoration:none; font-weight:bold;">
          Restablecer contraseña
        </a>
      </p>
      <p style="color:#6b7280; font-size:13px;">
        Este enlace expira en 30 minutos. Si no solicitaste esto, ignora este correo.
      </p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
      <p style="color:#9ca3af; font-size:12px;">SmileOS — Sistema de gestión dental</p>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": settings.resend_from,
            "to": [to_email],
            "subject": "Restablecer contraseña — SmileOS",
            "html": html,
        })
        logger.info(f"Email enviado: {result}")
        return True
    except Exception as e:
        logger.error(f"Error enviando email: {e}")
        return False


DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def send_booking_notification_email(
    to_email: str,
    clinic_name: str,
    guest_name: str,
    guest_phone: str,
    scheduled_at_utc: datetime,
    duration_minutes: int,
    dentist_name: str,
    appointment_type: str,
    reason: str,
) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY no configurada — no se envió notificación de reserva")
        return False

    resend.api_key = settings.resend_api_key

    # Convertir a hora local de la clínica
    local_dt = scheduled_at_utc.replace(tzinfo=timezone.utc).astimezone(CLINIC_TZ)
    day_name = DAYS_ES[local_dt.weekday() if local_dt.weekday() < 6 else 6]
    # Python weekday: 0=lun, 6=dom — ajustar
    dow = local_dt.isoweekday() % 7  # 0=dom, 1=lun ... 6=sab
    day_name = DAYS_ES[dow]
    date_str = f"{day_name.capitalize()} {local_dt.day} de {MONTHS_ES[local_dt.month - 1]} {local_dt.year}"
    time_str = local_dt.strftime("%H:%M")

    appt_type_labels = {
        "primera_consulta": "Primera consulta",
        "control": "Control",
        "limpieza": "Limpieza",
        "extraccion": "Extracción",
        "endodoncia": "Endodoncia",
        "ortodoncia": "Ortodoncia",
        "protesis": "Prótesis",
        "cirugia": "Cirugía",
        "emergencia": "Emergencia",
        "otro": "Otro",
    }
    appt_label = appt_type_labels.get(appointment_type, appointment_type)

    date_iso = local_dt.strftime("%Y-%m-%d")
    agenda_url = f"{settings.frontend_url}/appointments?date={date_iso}"
    wa_digits = "".join(c for c in (guest_phone or "") if c.isdigit())
    wa_url = f"https://wa.me/{wa_digits}" if wa_digits else None

    reason_row = f"""
      <tr>
        <td style="padding:6px 0; color:#6b7280; font-size:14px;">Motivo</td>
        <td style="padding:6px 0; font-size:14px; font-weight:600;">{reason}</td>
      </tr>""" if reason else ""

    phone_row = f"""
      <tr>
        <td style="padding:6px 0; color:#6b7280; font-size:14px;">Teléfono</td>
        <td style="padding:6px 0; font-size:14px; font-weight:600;">{guest_phone}</td>
      </tr>""" if guest_phone else ""

    wa_button = f"""
        <a href="{wa_url}" style="display:inline-block; background:#25d366; color:white; text-decoration:none; padding:11px 22px; border-radius:8px; font-size:14px; font-weight:600;">
          💬 WhatsApp {guest_phone}
        </a>""" if wa_url else ""

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 12px;">
      <div style="background: #2563eb; border-radius: 8px 8px 0 0; padding: 18px 24px;">
        <h2 style="margin:0; color:white; font-size:18px;">📅 Nueva reserva de paciente</h2>
        <p style="margin:4px 0 0; color:#bfdbfe; font-size:13px;">{clinic_name}</p>
      </div>
      <div style="background:white; border-radius: 0 0 8px 8px; padding: 24px; border: 1px solid #e2e8f0; border-top:none;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0; color:#6b7280; font-size:14px; width:120px;">Paciente</td>
            <td style="padding:6px 0; font-size:14px; font-weight:600;">{guest_name}</td>
          </tr>
          {phone_row}
          <tr>
            <td style="padding:6px 0; color:#6b7280; font-size:14px;">Fecha</td>
            <td style="padding:6px 0; font-size:14px; font-weight:600;">{date_str}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#6b7280; font-size:14px;">Hora</td>
            <td style="padding:6px 0; font-size:14px; font-weight:600;">{time_str} ({duration_minutes} min)</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#6b7280; font-size:14px;">Dentista</td>
            <td style="padding:6px 0; font-size:14px; font-weight:600;">{dentist_name}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#6b7280; font-size:14px;">Tipo</td>
            <td style="padding:6px 0; font-size:14px; font-weight:600;">{appt_label}</td>
          </tr>
          {reason_row}
        </table>
        <div style="margin-top:24px; display:flex; gap:10px; flex-wrap:wrap;">
          <a href="{agenda_url}" style="display:inline-block; background:#2563eb; color:white; text-decoration:none; padding:11px 22px; border-radius:8px; font-size:14px; font-weight:600;">
            📅 Ver en agenda
          </a>
          {wa_button}
        </div>
        <p style="margin:20px 0 0; font-size:12px; color:#9ca3af;">
          Esta cita fue creada desde el enlace de reserva en línea y aparece en tu agenda con estado <strong>Programada</strong>.
        </p>
      </div>
    </div>
    """

    try:
        resend.Emails.send({
            "from": settings.resend_from,
            "to": [to_email],
            "subject": f"Nueva reserva: {guest_name} — {date_str} {time_str}",
            "html": html,
        })
        logger.info(f"Notificación de reserva enviada a {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error enviando notificación de reserva: {e}")
        return False
