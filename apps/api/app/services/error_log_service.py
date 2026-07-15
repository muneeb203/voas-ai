"""Per-workspace error log for the admin panel.

`record()` is best-effort by design: logging an error must never itself raise or
slow down the request that failed. If the write fails we fall back to the
structured logger and move on.

Scope is intentionally narrow — unhandled crashes plus third-party integration
failures that break a real flow for the business. Warnings and expected errors
(a slot being taken, a customer hanging up) stay out of here.
"""

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.admin import AdminErrorLogEntry

log = get_logger(__name__)

RETENTION_DAYS = 30
_MAX_MESSAGE = 2000


def record(
    *,
    workspace_id: str | None,
    kind: Literal["crash", "integration"],
    source: str,
    message: str,
    context: dict[str, Any] | None = None,
) -> None:
    """Write one error row. Never raises."""
    try:
        get_supabase_admin().table("error_logs").insert(
            {
                "workspace_id": workspace_id,
                "kind": kind,
                "source": source,
                "message": (message or "")[:_MAX_MESSAGE],
                "context": context,
            }
        ).execute()
    except Exception as exc:  # never let logging break the caller
        log.error("error_log_write_failed", source=source, error=str(exc))


def list_for_workspace(workspace_id: str, limit: int = 100) -> list[AdminErrorLogEntry]:
    res = (
        get_supabase_admin()
        .table("error_logs")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [AdminErrorLogEntry(**row) for row in (res.data or [])]


def prune(older_than_days: int = RETENTION_DAYS) -> None:
    """Drop rows past the retention window. Never raises."""
    cutoff = (datetime.now(UTC) - timedelta(days=older_than_days)).isoformat()
    try:
        get_supabase_admin().table("error_logs").delete().lt("created_at", cutoff).execute()
    except Exception as exc:
        log.error("error_log_prune_failed", error=str(exc))
