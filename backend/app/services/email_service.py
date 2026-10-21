import logging
import resend
from app.core.config import get_settings

logger = logging.getLogger(__name__)


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
