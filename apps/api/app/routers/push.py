from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from app.config import get_settings
from app.deps import CurrentUserDep
from app.services import push_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["push"])


class PushConfig(BaseModel):
    configured: bool
    public_key: str | None = None


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeBody(BaseModel):
    endpoint: str = Field(..., min_length=1)
    keys: PushKeys


class UnsubscribeBody(BaseModel):
    endpoint: str = Field(..., min_length=1)


@router.get("/push/config", response_model=DataResponse[PushConfig])
async def push_config(_: CurrentUserDep) -> DataResponse[PushConfig]:
    """The browser needs the VAPID public key to subscribe. It's public by
    design, but we serve it here so there's a single source of truth."""
    s = get_settings()
    return ok(PushConfig(configured=s.push_configured, public_key=s.vapid_public_key))


@router.post("/push/subscribe", response_model=DataResponse[dict[str, bool]])
async def subscribe(
    body: SubscribeBody,
    user: CurrentUserDep,
    user_agent: str | None = Header(default=None),
) -> DataResponse[dict[str, bool]]:
    push_service.save_subscription(
        user_id=user.id,
        endpoint=body.endpoint,
        p256dh=body.keys.p256dh,
        auth=body.keys.auth,
        user_agent=user_agent,
    )
    return ok({"subscribed": True})


@router.post("/push/unsubscribe", response_model=DataResponse[dict[str, bool]])
async def unsubscribe(
    body: UnsubscribeBody,
    user: CurrentUserDep,
) -> DataResponse[dict[str, bool]]:
    push_service.delete_subscription(user_id=user.id, endpoint=body.endpoint)
    return ok({"subscribed": False})
