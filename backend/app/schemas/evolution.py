from datetime import date
from typing import Literal
from pydantic import BaseModel, field_validator


class EvolutionCreate(BaseModel):
    date: date
    note: str
    attendance: Literal["asistio", "no_asistio"] | None = None

    @field_validator("note")
    @classmethod
    def note_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La nota no puede estar vacía.")
        return v.strip()


class EvolutionUpdate(BaseModel):
    date: date | None = None
    note: str | None = None
    attendance: Literal["asistio", "no_asistio"] | None = None

    @field_validator("note")
    @classmethod
    def note_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("La nota no puede estar vacía.")
        return v.strip() if v else v
