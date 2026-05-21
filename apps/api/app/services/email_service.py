"""Email sending — stubbed for V1.

In dev (and through Sprint 5) we don't actually send mail. We log the
message via structlog so the developer can see it in uvicorn output.
At Sprint 6 we swap the body of `_dispatch` for a real Resend call —
no caller needs to change.
"""

from typing import Any

from app.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _dispatch(*, to: str, subject: str, body: str, context: dict[str, Any]) -> None:
    settings = get_settings()
    log.info(
        "email_send_stub",
        to=to,
        subject=subject,
        from_=settings.email_from,
        body_preview=body[:240],
        **context,
    )


def send_ticket_created(*, to: str, ticket_id: str, subject: str) -> None:
    _dispatch(
        to=to,
        subject=f"We got your ticket: {subject}",
        body=(
            f"Hi,\n\nThanks for reaching out — we've logged your ticket "
            f"#{ticket_id[:8]} ({subject}). The VOAS team will reply within "
            f"one business day. You can view the ticket any time in your "
            f"dashboard under Support.\n\n— VOAS AI"
        ),
        context={"template": "ticket_created", "ticket_id": ticket_id},
    )


def send_ticket_user_replied(*, to: str, ticket_id: str, subject: str) -> None:
    """Sent to admins when a workspace user replies. Wired in Sprint 5."""
    _dispatch(
        to=to,
        subject=f"New reply on ticket: {subject}",
        body=(
            f"A workspace user replied on ticket #{ticket_id[:8]} ({subject}). "
            f"Open the admin support inbox to respond."
        ),
        context={"template": "ticket_user_replied", "ticket_id": ticket_id},
    )


def send_ticket_admin_replied(*, to: str, ticket_id: str, subject: str) -> None:
    """Sent to the workspace user when an admin replies. Wired in Sprint 5."""
    _dispatch(
        to=to,
        subject=f"Update on your ticket: {subject}",
        body=(
            f"Hi,\n\nThe VOAS team replied on your ticket #{ticket_id[:8]} "
            f"({subject}). Open the conversation in your dashboard under "
            f"Support to view it.\n\n— VOAS AI"
        ),
        context={"template": "ticket_admin_replied", "ticket_id": ticket_id},
    )


def send_ticket_resolved(*, to: str, ticket_id: str, subject: str) -> None:
    _dispatch(
        to=to,
        subject=f"Ticket resolved: {subject}",
        body=(
            f"Your ticket #{ticket_id[:8]} ({subject}) is marked resolved. "
            f"If it's not actually fixed, reply on the ticket and we'll reopen it."
        ),
        context={"template": "ticket_resolved", "ticket_id": ticket_id},
    )
