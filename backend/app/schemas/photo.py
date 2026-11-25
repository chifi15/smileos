import uuid
from typing import Literal
from pydantic import BaseModel

PhotoType = Literal[
    "smile",
    "lateral_right",
    "lateral_left",
    "occlusal_upper",
    "occlusal_lower",
    "hemi_sd",
    "hemi_si",
    "hemi_ii",
    "hemi_id",
]


class PhotoUpdate(BaseModel):
    caption: str | None = None
    photo_type: PhotoType | None = None
    appointment_id: uuid.UUID | None = None


class PhotoReorderRequest(BaseModel):
    order: list[uuid.UUID]
