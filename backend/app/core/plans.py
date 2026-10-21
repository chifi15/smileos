from typing import TypedDict


class PlanConfig(TypedDict):
    name: str
    patient_limit: int | None  # None = unlimited
    price_usd: int


PLANS: dict[str, PlanConfig] = {
    "free": {"name": "Free", "patient_limit": 30, "price_usd": 0},
    "pro": {"name": "Pro", "patient_limit": None, "price_usd": 29},
    "clinic": {"name": "Clinic", "patient_limit": None, "price_usd": 59},
}

DEFAULT_PLAN = "free"


def get_patient_limit(plan: str) -> int | None:
    return PLANS.get(plan, PLANS[DEFAULT_PLAN])["patient_limit"]
