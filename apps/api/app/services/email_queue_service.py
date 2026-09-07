import random
from datetime import datetime, timedelta
from app.core.supabase import get_supabase_admin
from app.models.email_notification import CallData
from app.services import email_service
from app.core.logging import get_logger

log = get_logger(__name__)


async def handle_new_call(workspace_id: str, call_data: CallData):
    """Process new call: send email immediately or queue it"""
    db = get_supabase_admin()

    # Get workspace name
    ws = db.table("workspaces").select("name").eq("id", workspace_id).limit(1).execute()
    workspace_name = ws.data[0]["name"] if ws.data else "Workspace"

    # Get email settings
    settings = db.table("email_notification_settings").select("*").eq("workspace_id", workspace_id).limit(1).execute()
    if not settings.data:
        log.info(f"No email settings for workspace {workspace_id}")
        return

    setting = settings.data[0]
    if not setting["enabled"]:
        log.info(f"Email notifications disabled for workspace {workspace_id}")
        return

    recipient_email = setting["recipient_email"]
    rate_limit = setting["rate_limit_per_hour"]

    # Check hourly rate limit
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    logs = db.table("email_logs").select("id").eq("workspace_id", workspace_id).gte("sent_at", one_hour_ago.isoformat()).execute()

    sent_count = len(logs.data or [])

    if sent_count < rate_limit:
        # Send immediately
        success, error = await email_service.send_email(recipient_email, call_data, workspace_name)

        # Log result
        db.table("email_logs").insert({
            "workspace_id": workspace_id,
            "recipient_email": recipient_email,
            "call_data": call_data.model_dump(),
            "status": "success" if success else "failed",
            "error_message": error,
        }).execute()
    else:
        # Queue with 15-30min delay
        delay_minutes = random.randint(15, 30)
        scheduled_time = datetime.utcnow() + timedelta(minutes=delay_minutes)

        db.table("email_queue").insert({
            "workspace_id": workspace_id,
            "recipient_email": recipient_email,
            "call_data": call_data.model_dump(),
            "status": "pending",
            "scheduled_time": scheduled_time.isoformat(),
        }).execute()

        log.info(f"Call notification queued for {workspace_id} (delay: {delay_minutes}min)")


async def process_queued_emails():
    """Cron job: process pending queued emails"""
    db = get_supabase_admin()

    now = datetime.utcnow().isoformat()
    queued = db.table("email_queue").select("*").eq("status", "pending").lte("scheduled_time", now).execute()

    for item in queued.data or []:
        await process_queue_item(db, item)


async def process_queue_item(db, item: dict):
    """Process a single queued email"""
    try:
        call_data = CallData(**item["call_data"])

        # Get workspace name
        ws = db.table("workspaces").select("name").eq("id", item["workspace_id"]).limit(1).execute()
        workspace_name = ws.data[0]["name"] if ws.data else "Workspace"

        # Try to send
        success, error = await email_service.send_email(item["recipient_email"], call_data, workspace_name)

        if success:
            # Mark as sent
            db.table("email_queue").update({"status": "sent", "sent_at": datetime.utcnow().isoformat()}).eq("id", item["id"]).execute()

            # Log success
            db.table("email_logs").insert({
                "workspace_id": item["workspace_id"],
                "recipient_email": item["recipient_email"],
                "call_data": item["call_data"],
                "status": "success",
            }).execute()
        else:
            # Retry logic (max 3 retries)
            retry_count = item["retry_count"] + 1
            if retry_count < 3:
                next_retry = datetime.utcnow() + timedelta(minutes=15)
                db.table("email_queue").update({
                    "retry_count": retry_count,
                    "scheduled_time": next_retry.isoformat()
                }).eq("id", item["id"]).execute()
                log.warning(f"Email retry {retry_count} scheduled for {item['id']}")
            else:
                # Max retries reached
                db.table("email_queue").update({
                    "status": "failed",
                    "error_message": error
                }).eq("id", item["id"]).execute()

                db.table("email_logs").insert({
                    "workspace_id": item["workspace_id"],
                    "recipient_email": item["recipient_email"],
                    "call_data": item["call_data"],
                    "status": "failed",
                    "error_message": f"Max retries reached: {error}",
                }).execute()

                log.error(f"Email queue item {item['id']} failed after max retries")

    except Exception as e:
        log.error(f"Error processing queue item {item['id']}: {str(e)}")
        db.table("email_queue").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", item["id"]).execute()
