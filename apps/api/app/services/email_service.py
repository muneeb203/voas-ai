"""Transactional email for SaaS users.

All sends go through `_dispatch`. When SMTP credentials are configured we send
via Gmail (or any SMTP provider). Otherwise we log a stub entry so local dev
and CI keep working without mail credentials.
"""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from app.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_ROLE_LABELS = {
    "owner": "Owner",
    "manager": "Manager",
    "staff": "Staff",
}


def _smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _dispatch(
    *,
    to: str,
    subject: str,
    body: str,
    html: str | None = None,
    context: dict[str, Any],
) -> None:
    settings = get_settings()
    if not _smtp_configured():
        log.info(
            "email_send_stub",
            to=to,
            subject=subject,
            from_=settings.email_from,
            body_preview=body[:240],
            **context,
        )
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.email_from
        msg["To"] = to
        msg.attach(MIMEText(body, "plain", "utf-8"))
        if html:
            msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.email_from, [to], msg.as_string())

        log.info("email_sent", to=to, subject=subject, **context)
    except Exception as exc:  # noqa: BLE001
        log.error("email_send_failed", to=to, subject=subject, error=str(exc), **context)


def send_welcome(*, to: str, full_name: str | None, workspace_name: str) -> None:
    greeting = f"Hi {full_name}," if full_name else "Hi,"
    body = (
        f"{greeting}\n\n"
        f"Welcome to VOAS AI — your workspace \"{workspace_name}\" is ready.\n\n"
        f"Your AI front desk can answer calls, take orders, and handle customer "
        f"messages from one dashboard. Next steps:\n"
        f"  • Add your menu in Knowledge Base\n"
        f"  • Connect voice or WhatsApp under Integrations\n"
        f"  • Invite your team from the Team page\n\n"
        f"Open your dashboard any time to get started.\n\n"
        f"— VOAS AI"
    )
    html = (
        f"<p>{greeting}</p>"
        f"<p>Welcome to <strong>VOAS AI</strong> — your workspace "
        f"<strong>{workspace_name}</strong> is ready.</p>"
        f"<p>Your AI front desk can answer calls, take orders, and handle "
        f"customer messages from one dashboard.</p>"
        f"<p><strong>Next steps:</strong></p>"
        f"<ul>"
        f"<li>Add your menu in Knowledge Base</li>"
        f"<li>Connect voice or WhatsApp under Integrations</li>"
        f"<li>Invite your team from the Team page</li>"
        f"</ul>"
        f"<p>Open your dashboard any time to get started.</p>"
        f"<p>— VOAS AI</p>"
    )
    _dispatch(
        to=to,
        subject=f"Welcome to VOAS AI — {workspace_name} is ready",
        body=body,
        html=html,
        context={"template": "welcome", "workspace_name": workspace_name},
    )


def send_team_invite(
    *,
    to: str,
    workspace_name: str,
    accept_url: str,
    role: str,
) -> None:
    role_label = _ROLE_LABELS.get(role, role.title())
    body = (
        f"Hi,\n\n"
        f"You've been invited to join \"{workspace_name}\" on VOAS AI as {role_label}.\n\n"
        f"Accept your invite (expires in 7 days):\n{accept_url}\n\n"
        f"If you don't have a VOAS account yet, you'll be asked to sign up first.\n\n"
        f"— VOAS AI"
    )
    html = (
        f"<p>Hi,</p>"
        f"<p>You've been invited to join <strong>{workspace_name}</strong> on "
        f"VOAS AI as <strong>{role_label}</strong>.</p>"
        f"<p><a href=\"{accept_url}\">Accept your invite</a> (expires in 7 days)</p>"
        f"<p>If you don't have a VOAS account yet, you'll be asked to sign up first.</p>"
        f"<p>— VOAS AI</p>"
    )
    _dispatch(
        to=to,
        subject=f"You're invited to {workspace_name} on VOAS AI",
        body=body,
        html=html,
        context={"template": "team_invite", "workspace_name": workspace_name, "role": role},
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
