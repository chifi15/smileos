from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Entorno
    environment: str = "development"

    # Base de datos
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str
    access_token_expire_minutes: int = 480  # 8 horas
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # Oracle Object Storage
    oci_namespace: str = ""
    oci_bucket_name: str = "smileos-media"
    oci_region: str = "us-ashburn-1"
    oci_tenancy_ocid: str = ""
    oci_user_ocid: str = ""
    oci_fingerprint: str = ""
    oci_private_key_path: str = ""

    # OpenAI (v1.0)
    openai_api_key: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    frontend_url: str = "https://smileos-six.vercel.app"

    # WhatsApp Cloud API
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "smileos_wa_verify_2026"

    # Google Gemini (bot WhatsApp — gratis)
    gemini_api_key: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
