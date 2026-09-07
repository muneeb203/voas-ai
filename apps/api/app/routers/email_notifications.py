from fastapi import APIRouter, HTTPException, status
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.email_notification import EmailNotificationSettings, EmailNotificationSettingsUpdate, EmailLog
from app.core.supabase import get_supabase_admin
from app.utils.responses import DataResponse, ok
from app.core.logging import get_logger

log = get_logger(__name__)

router = APIRouter(tags=["email-notifications"])


@router.get("/workspaces/{workspace_id}/email-settings", response_model=DataResponse[EmailNotificationSettings | None])
async def get_email_settings(ctx: WorkspaceContextDep) -> DataResponse[EmailNotificationSettings | None]:
    db = get_supabase_admin()
    try:
        res = db.table("email_notification_settings").select("*").eq("workspace_id", ctx.workspace_id).limit(1).execute()
        if res.data:
            return ok(EmailNotificationSettings(**res.data[0]))
        return ok(None)
    except Exception as e:
        log.error(f"Failed to get email settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch email settings")


@router.patch("/workspaces/{workspace_id}/email-settings", response_model=DataResponse[EmailNotificationSettings])
async def update_email_settings(
    payload: EmailNotificationSettingsUpdate,
    ctx: OwnerContextDep,
) -> DataResponse[EmailNotificationSettings]:
    db = get_supabase_admin()

    try:
        # Get current settings
        res = db.table("email_notification_settings").select("*").eq("workspace_id", ctx.workspace_id).limit(1).execute()

        if res.data:
            # Update existing
            updated = db.table("email_notification_settings").update(
                {"enabled": payload.enabled}
            ).eq("workspace_id", ctx.workspace_id).execute()
        else:
            # Create new with workspace owner email (enabled by default)
            owner_email = ctx.user.email if hasattr(ctx.user, 'email') else "owner@example.com"

            updated = db.table("email_notification_settings").insert({
                "workspace_id": ctx.workspace_id,
                "enabled": True,
                "recipient_email": owner_email,
                "rate_limit_per_hour": 10,
            }).execute()

        if not updated.data:
            log.error(f"Failed to update email settings for workspace {ctx.workspace_id}")
            raise HTTPException(status_code=500, detail="Failed to update email settings")

        return ok(EmailNotificationSettings(**updated.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error updating email settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update email settings")


@router.get("/workspaces/{workspace_id}/email-logs", response_model=DataResponse[list[EmailLog]])
async def get_email_logs(
    ctx: WorkspaceContextDep,
    limit: int = 50,
    offset: int = 0,
) -> DataResponse[list[EmailLog]]:
    db = get_supabase_admin()

    try:
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
    except Exception as e:
        log.error(f"Failed to get email logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch email logs")
