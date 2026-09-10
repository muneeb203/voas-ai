from fastapi import APIRouter, Query

from app.core.logging import get_logger
from app.deps import CurrentUserDep
from app.models.notification import Notification, NotificationList
from app.services import notification_service
from app.utils.responses import DataResponse, ok

log = get_logger(__name__)
router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=DataResponse[NotificationList])
async def list_notifications(
    user: CurrentUserDep,
    limit: int = Query(default=30, ge=1, le=50),
) -> DataResponse[NotificationList]:
    try:
        return ok(notification_service.list_for_user(user.id, limit=limit))
    except Exception as exc:
        # Gracefully handle Supabase connection errors
        log.error("list_notifications_failed", user_id=user.id, error=str(exc))
        return ok(NotificationList(items=[], unread_count=0))


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=DataResponse[Notification],
)
async def mark_notification_read(
    notification_id: str,
    user: CurrentUserDep,
) -> DataResponse[Notification]:
    try:
        return ok(notification_service.mark_read(notification_id, user.id))
    except Exception as exc:
        log.error("mark_notification_read_failed", user_id=user.id, error=str(exc))
        raise


@router.post("/notifications/read-all", response_model=DataResponse[dict[str, int]])
async def mark_all_notifications_read(user: CurrentUserDep) -> DataResponse[dict[str, int]]:
    try:
        count = notification_service.mark_all_read(user.id)
        return ok({"marked_read": count})
    except Exception as exc:
        log.error("mark_all_notifications_read_failed", user_id=user.id, error=str(exc))
        raise
