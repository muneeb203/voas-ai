from fastapi import APIRouter, HTTPException, status
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.email_notification import EmailNotificationSettings, EmailNotificationSettingsUpdate, EmailLog
from app.core.supabase import get_supabase_admin
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["email-notifications"])


@router.get("/workspaces/{workspace_id}/email-settings", response_model=DataResponse[EmailNotificationSettings | None])
async def get_email_settings(ctx: WorkspaceContextDep) -> DataResponse[EmailNotificationSettings | None]:
    db = get_supabase_admin()
    res = db.table("email_notification_settings").select("*").eq("workspace_id", ctx.workspace_id).limit(1).execute()

    if res.data:
        return ok(EmailNotificationSettings(**res.data[0]))
    return ok(None)


@router.patch("/workspaces/{workspace_id}/email-settings", response_model=DataResponse[EmailNotificationSettings])
async def update_email_settings(
    payload: EmailNotificationSettingsUpdate,
    ctx: OwnerContextDep,
) -> DataResponse[EmailNotificationSettings]:
    db = get_supabase_admin()

    # Get current settings or create
    res = db.table("email_notification_settings").select("*").eq("workspace_id", ctx.workspace_id).limit(1).execute()

    if res.data:
        # Update existing
        updated = db.table("email_notification_settings").update({"enabled": payload.enabled}).eq("workspace_id", ctx.workspace_id).execute()
    else:
        # Create new (need owner email)
        user = db.table("auth.users").select("email").eq("id", ctx.user.id).limit(1).execute()
        owner_email = user.data[0]["email"] if user.data else ""

        updated = db.table("email_notification_settings").insert({
            "workspace_id": ctx.workspace_id,
            "enabled": payload.enabled,
            "recipient_email": owner_email,
        }).execute()

    if not updated.data:
        raise HTTPException(status_code=500, detail="Failed to update email settings")

    return ok(EmailNotificationSettings(**updated.data[0]))


@router.get("/workspaces/{workspace_id}/email-logs", response_model=DataResponse[list[EmailLog]])
async def get_email_logs(
    ctx: WorkspaceContextDep,
    limit: int = 50,
    offset: int = 0,
) -> DataResponse[list[EmailLog]]:
    db = get_supabase_admin()

    res = (
        db.table("email_logs")
        .select("*")
        .eq("workspace_id", ctx.workspace_id)
        .order("sent_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    logs = [EmailLog(**row) for row in res.data or []]
    return ok(logs)
