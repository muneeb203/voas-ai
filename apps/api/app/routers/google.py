from typing import Annotated

from fastapi import APIRouter, Path, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.core.exceptions import NotFoundError, ServiceUnavailableError
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.services import google_calendar_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["google"])
public_router = APIRouter(tags=["google"])


def _verify_staff(db, workspace_id: str, staff_id: str) -> None:
    res = (
        db.table("salon_staff")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("id", staff_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Staff member not found")


@router.get(
    "/workspaces/{workspace_id}/salon/staff/{staff_id}/google/connect",
    response_model=DataResponse[dict],
)
async def google_connect(
    staff_id: Annotated[str, Path()],
    ctx: OwnerContextDep,
    return_path: str = Query(default="/staff"),
) -> DataResponse[dict]:
    if not google_calendar_service.is_configured():
        raise ServiceUnavailableError("Google Calendar is not configured.")
    db = get_supabase_admin()
    _verify_staff(db, ctx.workspace_id, staff_id)
    cfg = get_settings()
    safe_path = return_path if return_path.startswith("/") else "/staff"
    return_url = cfg.public_app_url.rstrip("/") + safe_path
    state = google_calendar_service.encode_state(staff_id, ctx.workspace_id, return_url)
    return ok({"auth_url": google_calendar_service.build_auth_url(state)})


@router.get(
    "/workspaces/{workspace_id}/salon/staff/{staff_id}/google/status",
    response_model=DataResponse[dict],
)
async def google_status(
    staff_id: Annotated[str, Path()], ctx: WorkspaceContextDep
) -> DataResponse[dict]:
    _verify_staff(get_supabase_admin(), ctx.workspace_id, staff_id)
    return ok(google_calendar_service.get_status(staff_id))


@router.delete(
    "/workspaces/{workspace_id}/salon/staff/{staff_id}/google",
    status_code=204,
)
async def google_disconnect(staff_id: Annotated[str, Path()], ctx: OwnerContextDep) -> None:
    _verify_staff(get_supabase_admin(), ctx.workspace_id, staff_id)
    google_calendar_service.disconnect(staff_id)


@public_router.get("/google/oauth/callback")
async def google_oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    cfg = get_settings()
    decoded = google_calendar_service.decode_state(state or "")
    return_url = decoded.get("r") or (cfg.public_app_url.rstrip("/") + "/staff")
    staff_id = decoded.get("s")
    workspace_id = decoded.get("w")

    if error or not code or not staff_id or not workspace_id:
        return RedirectResponse(f"{return_url}?google=error")

    db = get_supabase_admin()
    check = (
        db.table("salon_staff")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("id", staff_id)
        .limit(1)
        .execute()
    )
    if not check.data:
        return RedirectResponse(f"{return_url}?google=error")

    connected = google_calendar_service.complete_connect(code, staff_id, workspace_id)
    return RedirectResponse(f"{return_url}?google={'connected' if connected else 'error'}")
