import uuid
from typing import Any

from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin

log = get_logger(__name__)

BUCKET = "ticket-attachments"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_MIME = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
}


def _sanitize_filename(filename: str) -> str:
    """Strip path separators / control chars. Keep extension."""
    name = filename.replace("\\", "/").split("/")[-1]
    name = "".join(c for c in name if c.isprintable() and c not in "<>:\"|?*\x00")
    name = name.strip().strip(".")
    return (name or "file")[:200]


def create_signed_upload(
    *,
    workspace_id: str,
    ticket_id: str,
    filename: str,
    content_type: str,
    size: int,
) -> dict[str, Any]:
    if content_type not in ALLOWED_MIME:
        raise AppError(f"Unsupported file type: {content_type}")
    if size > MAX_FILE_SIZE:
        raise AppError("File too large (10 MB max)")

    safe_name = _sanitize_filename(filename)
    object_id = f"{uuid.uuid4().hex[:8]}-{safe_name}"
    path = f"{workspace_id}/{ticket_id}/{object_id}"

    db = get_supabase_admin()
    res = db.storage.from_(BUCKET).create_signed_upload_url(path)

    # `res` shape: {"signed_url": "...", "path": "...", "token": "..."}
    if not isinstance(res, dict) or "signed_url" not in res:
        log.error("signed_upload_failed", path=path, response=res)
        raise AppError("Could not create upload URL")

    return {
        "path": res.get("path") or path,
        "signed_url": res["signed_url"],
        "token": res.get("token"),
        "bucket": BUCKET,
        "filename": safe_name,
        "content_type": content_type,
        "size": size,
    }


def get_signed_download_url(path: str, expires_in: int = 60 * 60) -> str:
    """One-hour signed URL for downloading an attachment."""
    db = get_supabase_admin()
    res = db.storage.from_(BUCKET).create_signed_url(path, expires_in)
    if isinstance(res, dict):
        return res.get("signedURL") or res.get("signed_url") or ""
    return ""
