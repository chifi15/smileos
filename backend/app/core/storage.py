"""
Capa de abstracción de almacenamiento de archivos.
- Modo S3 (producción): requiere S3_ENDPOINT_URL + S3_ACCESS_KEY en env
- Modo local (fallback): usa LOCAL_MEDIA_PATH env var, o /tmp/smileos-media por defecto
"""
import os
import uuid
from pathlib import Path

MEDIA_ROOT = Path(os.environ.get("LOCAL_MEDIA_PATH", "/tmp/smileos-media"))


def _use_s3() -> bool:
    return bool(os.environ.get("S3_ENDPOINT_URL") and os.environ.get("S3_ACCESS_KEY"))


def _bucket() -> str:
    return os.environ.get("S3_BUCKET_NAME", "smileos-media")


def _s3():
    import boto3
    from botocore.client import Config
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT_URL"),
        aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
        region_name=os.environ.get("S3_REGION", "auto"),
    )


def save_file(storage_path: str, data: bytes) -> None:
    if _use_s3():
        _s3().put_object(Bucket=_bucket(), Key=storage_path, Body=data)
    else:
        path = MEDIA_ROOT / storage_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def read_file(storage_path: str) -> bytes:
    if _use_s3():
        obj = _s3().get_object(Bucket=_bucket(), Key=storage_path)
        return obj["Body"].read()
    return (MEDIA_ROOT / storage_path).read_bytes()


def delete_file(storage_path: str) -> None:
    if _use_s3():
        try:
            _s3().delete_object(Bucket=_bucket(), Key=storage_path)
        except Exception:
            pass
    else:
        try:
            (MEDIA_ROOT / storage_path).unlink(missing_ok=True)
        except OSError:
            pass


def file_exists(storage_path: str) -> bool:
    if _use_s3():
        try:
            _s3().head_object(Bucket=_bucket(), Key=storage_path)
            return True
        except Exception:
            return False
    return (MEDIA_ROOT / storage_path).exists()


def get_local_path(storage_path: str) -> Path:
    return MEDIA_ROOT / storage_path


def build_storage_path(
    clinic_id: uuid.UUID, patient_id: uuid.UUID, photo_id: uuid.UUID, ext: str
) -> str:
    return f"{clinic_id}/{patient_id}/{photo_id}.{ext}"
