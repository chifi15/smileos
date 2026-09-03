import logging
from fastapi import APIRouter, Request, Query, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.services.whatsapp_service import process_message

logger = logging.getLogger("smileos")
settings = get_settings()

router = APIRouter(tags=["WhatsApp"])


@router.get("/whatsapp/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="Token de verificación inválido")


async def _process_background(wa_id: str, text: str) -> None:
    async with AsyncSessionLocal() as db:
        try:
            await process_message(db, wa_id, text)
        except Exception as exc:
            logger.error("WhatsApp bot error para %s: %s", wa_id, exc, exc_info=True)


@router.post("/whatsapp/webhook")
async def receive_message(request: Request, background_tasks: BackgroundTasks):
    try:
        payload = await request.json()
        entry = payload["entry"][0]
        change = entry["changes"][0]["value"]

        if "messages" not in change:
            return {"status": "ok"}

        message = change["messages"][0]
        if message.get("type") != "text":
            return {"status": "ok"}

        wa_id: str = message["from"]
        text: str = message["text"]["body"]
    except Exception:
        return {"status": "ok"}

    background_tasks.add_task(_process_background, wa_id, text)
    return {"status": "ok"}
