"""Análisis asistido por IA de fotos clínicas para proponer el estado del odontograma.

Solo PROPONE: el odontólogo revisa y corrige cada pieza antes de guardar.
"""
import base64
import json
import re
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.odontogram import ADULT_TEETH, TOOTH_CONDITIONS
from app.models.photo import PatientPhoto

API_URL = "https://api.anthropic.com/v1/messages"

PHOTO_LABELS = {
    "smile": "Sonrisa (frontal)",
    "lateral_right": "Lateral derecha (en oclusión)",
    "lateral_left": "Lateral izquierda (en oclusión)",
    "occlusal_upper": "Oclusal superior",
    "occlusal_lower": "Oclusal inferior",
    "hemi_sd": "Hemiarcada superior derecha (cuadrante 1)",
    "hemi_si": "Hemiarcada superior izquierda (cuadrante 2)",
    "hemi_ii": "Hemiarcada inferior izquierda (cuadrante 3)",
    "hemi_id": "Hemiarcada inferior derecha (cuadrante 4)",
}
PHOTO_ORDER = list(PHOTO_LABELS.keys())

MAX_IMAGES = 9
MAX_IMAGE_BYTES = 4_500_000  # límite de la API: 5 MB por imagen
MAX_TOTAL_BYTES = 24_000_000

SYSTEM_PROMPT = """Eres un asistente para odontólogos. Analizas fotografías clínicas intraorales y propones el \
estado de cada pieza para un odontograma (notación FDI, dentición permanente 11-48). Tu salida es una PROPUESTA que \
el odontólogo revisará y corregirá; no es un diagnóstico.

Criterios ICDAS (solo aplican cuando condition = "caries"):
0 = sano; 1 = primer cambio visual en esmalte (visible solo tras secado); 2 = cambio visual claro en esmalte \
(mancha blanca/marrón visible en húmedo); 3 = ruptura localizada del esmalte sin dentina visible; 4 = sombra oscura \
de dentina subyacente (con o sin ruptura de esmalte); 5 = cavidad distintiva con dentina visible; 6 = cavidad extensa \
con dentina visible (más de la mitad de la superficie).

Reglas:
- Reporta SOLO piezas con hallazgos claros o razonablemente probables. NO listes piezas sanas ni piezas que no se vean.
- Si una pieza falta en la arcada de forma evidente, usa "extraido".
- Sé conservador: ante duda usa confidence "baja" y explica por qué en "note".
- Con fotografías no se pueden evaluar bien caries interproximales ni los códigos ICDAS 1-2 (requieren pieza limpia y seca); \
indícalo en "note" cuando aplique.
- condition debe ser uno de: {conditions}.
- icdas: entero 0-6 solo si condition = "caries"; en otro caso null.
- confidence: "alta", "media" o "baja".
- Cada pieza solo una vez; elige la mejor evidencia. "photos" lista los números de foto (1,2,…) donde la viste.
- Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código, con esta forma:
{{"teeth":[{{"tooth":16,"condition":"caries","icdas":3,"confidence":"media","note":"…","photos":[3]}}],
"general_notes":"observaciones generales breves","limitations":"límites de este análisis por la calidad de las fotos"}}"""


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("sin JSON")
    return json.loads(text[start : end + 1])


async def analyze_patient_photos(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> dict:
    if not get_settings().anthropic_api_key:
        raise ValidationError(
            "El análisis con IA no está configurado (falta ANTHROPIC_API_KEY en el servidor)."
        )

    result = await db.execute(
        select(PatientPhoto).where(
            PatientPhoto.clinic_id == clinic_id,
            PatientPhoto.patient_id == patient_id,
            PatientPhoto.is_active == True,  # noqa: E712
            PatientPhoto.photo_type.in_(PHOTO_ORDER),
        )
    )
    photos = sorted(result.scalars().all(), key=lambda p: (PHOTO_ORDER.index(p.photo_type), p.sort_order))
    if not photos:
        raise NotFoundError("Fotos clasificadas del paciente (sonrisa, laterales, oclusales u hemiarcadas)")

    content: list[dict] = []
    used: list[dict] = []
    total = 0
    for p in photos:
        if len(used) >= MAX_IMAGES:
            break
        try:
            data = storage.read_file(p.storage_path)
        except (FileNotFoundError, OSError):
            continue
        if len(data) > MAX_IMAGE_BYTES or total + len(data) > MAX_TOTAL_BYTES:
            continue
        total += len(data)
        n = len(used) + 1
        used.append({"n": n, "photo_id": str(p.id), "label": PHOTO_LABELS[p.photo_type]})
        content.append({"type": "text", "text": f"Foto {n}: {PHOTO_LABELS[p.photo_type]}"})
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": p.mime_type if p.mime_type in ("image/jpeg", "image/png", "image/webp") else "image/jpeg",
                "data": base64.b64encode(data).decode(),
            },
        })
    if not used:
        raise ValidationError("No se pudieron leer las fotos del paciente.")
    content.append({"type": "text", "text": "Analiza estas fotos y devuelve el JSON indicado."})

    payload = {
        "model": get_settings().anthropic_model,
        "max_tokens": 4000,
        "system": SYSTEM_PROMPT.format(conditions=", ".join(TOOTH_CONDITIONS)),
        "messages": [{"role": "user", "content": content}],
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                API_URL,
                headers={
                    "x-api-key": get_settings().anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError:
        raise ValidationError("No se pudo contactar el servicio de IA. Intenta de nuevo.")
    if resp.status_code != 200:
        raise ValidationError(f"El servicio de IA respondió con error ({resp.status_code}).")

    text = "".join(b.get("text", "") for b in resp.json().get("content", []) if b.get("type") == "text")
    try:
        raw = _parse_json(text)
    except (ValueError, json.JSONDecodeError):
        raise ValidationError("No se pudo interpretar la respuesta de la IA. Intenta de nuevo.")

    suggestions: dict[int, dict] = {}
    for t in raw.get("teeth", []):
        try:
            num = int(t.get("tooth"))
        except (TypeError, ValueError):
            continue
        cond = t.get("condition")
        if num not in ADULT_TEETH or cond not in TOOTH_CONDITIONS or cond == "sano":
            continue
        icdas = t.get("icdas")
        icdas = int(icdas) if cond == "caries" and isinstance(icdas, (int, float)) and 0 <= int(icdas) <= 6 else None
        conf = t.get("confidence") if t.get("confidence") in ("alta", "media", "baja") else "baja"
        suggestions[num] = {
            "tooth": num,
            "condition": cond,
            "icdas": icdas,
            "confidence": conf,
            "note": str(t.get("note") or "")[:400],
            "photos": [int(x) for x in t.get("photos", []) if isinstance(x, (int, float))][:5],
        }

    return {
        "suggestions": [suggestions[k] for k in sorted(suggestions)],
        "general_notes": str(raw.get("general_notes") or "")[:800],
        "limitations": str(raw.get("limitations") or "")[:800],
        "photos_used": used,
    }
