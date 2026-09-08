import httpx
from datetime import datetime
from app.config import get_settings
from app.core.logging import get_logger
from app.models.email_notification import CallData

log = get_logger(__name__)


async def send_email(recipient_email: str, call_data: CallData, workspace_name: str) -> tuple[bool, str | None]:
    """Send email via Resend. Returns (success, error_message)"""
    settings = get_settings()

    if not settings.resend_api_key:
        log.warning("Resend API key not configured")
        return False, "Resend API key not configured"

    minutes = call_data.duration_seconds // 60
    seconds = call_data.duration_seconds % 60
    duration_str = f"{minutes}m {seconds}s"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
        <h2 style="color: #0A2540;">New Voice Call Received</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; width: 30%;">Caller:</td>
                <td style="padding: 10px;">{call_data.caller_name} ({call_data.caller_phone})</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold;">Duration:</td>
                <td style="padding: 10px;">{duration_str}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold;">Location:</td>
                <td style="padding: 10px;">{call_data.location}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold;">Inquiry:</td>
                <td style="padding: 10px;">{call_data.inquiry}</td>
            </tr>
        </table>
        <h3 style="color: #0A2540; margin-top: 20px;">Call Transcript</h3>
        <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">{call_data.transcript[:500]}{'...' if len(call_data.transcript) > 500 else ''}</p>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">Workspace: {workspace_name}<br>Sent: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
        </div>
    </div>
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "onboarding@resend.dev",
                    "to": recipient_email,
                    "subject": f"New call from {call_data.caller_name}",
                    "html": html_content,
                },
                timeout=10.0,
            )

            if response.status_code in (200, 201):
                log.info(f"Email sent to {recipient_email}")
                return True, None
            else:
                error = f"Resend error: {response.status_code}"
                log.error(error)
                return False, error

    except Exception as e:
        error = f"Email failed: {str(e)}"
        log.error(error)
        return False, error
