"""Admin-authored product updates broadcast to all workspace users."""

from datetime import datetime, timezone
from typing import Any

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.notification import Announcement, AnnouncementCreate
from app.services import audit_service, notification_service

log = get_logger(__name__)


def _row_to_announcement(row: dict[str, Any]) -> Announcement:
    return Announcement.model_validate(row)


def list_announcements(*, limit: int = 50) -> list[Announcement]:
    db = get_supabase_admin()
    cap = min(max(limit, 1), 100)
    res = (
        db.table("announcements")
        .select("*")
        .order("published_at", desc=True)
        .limit(cap)
        .execute()
    )
    return [_row_to_announcement(r) for r in res.data or []]


def publish(
    payload: AnnouncementCreate,
    *,
    admin_id: str,
    admin_user_id: str,
) -> Announcement:
    db = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()

    res = (
        db.table("announcements")
        .insert(
            {
                "title": payload.title.strip(),
                "body": payload.body.strip(),
                "link": payload.link.strip() if payload.link else None,
                "created_by_admin_id": admin_id,
                "published_at": now,
            }
        )
        .execute()
    )
    if not res.data:
        from app.core.exceptions import AppError

        raise AppError("Could not publish announcement")

    announcement = _row_to_announcement(res.data[0])
    recipients = notification_service.notify_all_users_product_update(
        title=f"VOAS update: {announcement.title}",
        body=announcement.body,
        link=announcement.link,
        announcement_id=announcement.id,
    )

    audit_service.write(
        actor_type="admin",
        actor_id=admin_user_id,
        action="announcement.published",
        resource_type="announcement",
        resource_id=announcement.id,
        metadata={"recipients": recipients, "title": announcement.title},
    )

    log.info(
        "announcement_published",
        announcement_id=announcement.id,
        recipients=recipients,
    )
    return announcement
