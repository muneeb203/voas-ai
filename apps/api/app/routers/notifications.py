from fastapi import APIRouter, Query

from app.deps import CurrentUserDep
from app.models.notification import Notification, NotificationList
from app.services import notification_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=DataResponse[NotificationList])
async def list_notifications(
    user: CurrentUserDep,
    limit: int = Query(default=30, ge=1, le=50),
) -> DataResponse[NotificationList]:
    return ok(notification_service.list_for_user(user.id, limit=limit))


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=DataResponse[Notification],
)
async def mark_notification_read(
    notification_id: str,
    user: CurrentUserDep,
) -> DataResponse[Notification]:
    return ok(notification_service.mark_read(notification_id, user.id))


@router.post("/notifications/read-all", response_model=DataResponse[dict[str, int]])
async def mark_all_notifications_read(user: CurrentUserDep) -> DataResponse[dict[str, int]]:
    count = notification_service.mark_all_read(user.id)
    return ok({"marked_read": count})
