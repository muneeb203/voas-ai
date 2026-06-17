from typing import Any, Literal

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin

log = get_logger(__name__)

ActorType = Literal["user", "admin", "system"]


def write(
    *,
    actor_type: ActorType,
    actor_id: str,
    action: str,
    workspace_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Write a single audit log row. Fire-and-forget; failures are logged but
    do NOT raise — we never want audit writes to block the main action.

    Per CLAUDE.md §8: audit_logs is INSERT-only at the application layer.
    """
    db = get_supabase_admin()
    try:
        db.table("audit_logs").insert(
            {
                "actor_type": actor_type,
                "actor_id": actor_id,
                "workspace_id": workspace_id,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "metadata": metadata,
                "ip_address": ip_address,
                "user_agent": user_agent,
            }
        ).execute()
    except Exception as exc:
        log.error(
            "audit_write_failed",
            action=action,
            actor_id=actor_id,
            workspace_id=workspace_id,
            error=str(exc),
        )
