import uuid
from typing import Literal
from pydantic import BaseModel

PhotoType = Literal[
    "profile",
    "intraoral_frontal",
    "intraoral_lateral_right",
    "intraoral_lateral_left",
    "extraoral_frontal",
    "extraoral_profile",
    "xray",
    "other",
]


class PhotoUpdate(BaseModel):
    caption: str | None = None
    photo_type: PhotoType | None = None
    appointment_id: uuid.UUID | None = None
