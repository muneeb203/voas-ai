from datetime import UTC, datetime

from app.core.exceptions import AppError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.ticket import (
    USER_SETTABLE_STATUSES,
    Ticket,
    TicketCreate,
    TicketMessage,
    TicketMessageCreate,
    TicketStatus,
    TicketWithMessages,
)
from app.services import audit_service, email_service

log = get_logger(__name__)


def _user_lookup(user_id: str) -> tuple[str | None, str | None]:
    db = get_supabase_admin()
    try:
        res = db.auth.admin.get_user_by_id(user_id)
    except Exception:
        return (None, None)
    if not (res and res.user):
        return (None, None)
    email = res.user.email
    meta = res.user.user_metadata or {}
    name = meta.get("full_name") if isinstance(meta, dict) else None
    return (email, name if isinstance(name, str) else None)


def _hydrate_ticket(row: dict, message_count: int, last_message_at: datetime | None) -> Ticket:
    email, full_name = _user_lookup(row["created_by"])
    return Ticket(
        id=row["id"],
        workspace_id=row["workspace_id"],
        created_by=row["created_by"],
        creator_name=full_name,
        creator_email=email,
        assigned_admin_id=row.get("assigned_admin_id"),
        subject=row["subject"],
        status=row["status"],
        priority=row["priority"],
        category=row.get("category"),
        message_count=message_count,
        last_message_at=last_message_at,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        resolved_at=row.get("resolved_at"),
    )


def _hydrate_message(row: dict) -> TicketMessage:
    email: str | None = None
    full_name: str | None = None
    if row["sender_type"] == "user":
        email, full_name = _user_lookup(row["sender_id"])
    return TicketMessage(
        id=row["id"],
        ticket_id=row["ticket_id"],
        sender_type=row["sender_type"],
        sender_id=row["sender_id"],
        sender_name=full_name,
        sender_email=email,
        body=row["body"],
        attachments=row.get("attachments"),
        is_internal_note=row.get("is_internal_note", False),
        created_at=row["created_at"],
    )


def list_tickets(workspace_id: str, status: TicketStatus | None = None) -> list[Ticket]:
    db = get_supabase_admin()
    query = (
        db.table("support_tickets")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("updated_at", desc=True)
        .limit(50)
    )
    if status:
        query = query.eq("status", status)
    res = query.execute()

    if not res.data:
        return []

    # Batch the message-count + last-message lookup per ticket so we don't N+1.
    ticket_ids = [row["id"] for row in res.data]
    counts_res = (
        db.table("support_messages")
        .select("ticket_id, created_at")
        .in_("ticket_id", ticket_ids)
        .eq("is_internal_note", False)
        .execute()
    )

    counts: dict[str, int] = {}
    latest: dict[str, datetime] = {}
    for m in counts_res.data or []:
        tid = m["ticket_id"]
        counts[tid] = counts.get(tid, 0) + 1
        ts = m["created_at"]
        ts_dt = (
            ts if isinstance(ts, datetime) else datetime.fromisoformat(ts.replace("Z", "+00:00"))
        )
        if tid not in latest or latest[tid] < ts_dt:
            latest[tid] = ts_dt

    return [
        _hydrate_ticket(row, counts.get(row["id"], 0), latest.get(row["id"])) for row in res.data
    ]


def get_ticket(
    workspace_id: str, ticket_id: str, *, include_internal: bool = False
) -> TicketWithMessages:
    db = get_supabase_admin()
    res = (
        db.table("support_tickets")
        .select("*")
        .eq("id", ticket_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Ticket not found")
    ticket_row = res.data[0]

    msg_query = (
        db.table("support_messages")
        .select("*")
        .eq("ticket_id", ticket_id)
        .order("created_at", desc=False)
    )
    if not include_internal:
        msg_query = msg_query.eq("is_internal_note", False)
    msg_res = msg_query.execute()

    messages = [_hydrate_message(m) for m in msg_res.data or []]
    visible = [m for m in messages if not m.is_internal_note]
    last_visible_at = visible[-1].created_at if visible else None

    base = _hydrate_ticket(ticket_row, len(visible), last_visible_at)
    return TicketWithMessages(**base.model_dump(), messages=messages)


def create_ticket(workspace_id: str, user_id: str, payload: TicketCreate) -> Ticket:
    db = get_supabase_admin()

    ticket_res = (
        db.table("support_tickets")
        .insert(
            {
                "workspace_id": workspace_id,
                "created_by": user_id,
                "subject": payload.subject,
                "category": payload.category,
                "priority": payload.priority,
                "status": "open",
            }
        )
        .execute()
    )
    if not ticket_res.data:
        raise AppError("Could not create ticket")
    ticket_row = ticket_res.data[0]
    ticket_id = ticket_row["id"]

    msg_res = (
        db.table("support_messages")
        .insert(
            {
                "ticket_id": ticket_id,
                "sender_type": "user",
                "sender_id": user_id,
                "body": payload.body,
                "is_internal_note": False,
            }
        )
        .execute()
    )
    if not msg_res.data:
        # Roll back ticket; best-effort.
        db.table("support_tickets").delete().eq("id", ticket_id).execute()
        raise AppError("Could not create ticket")

    audit_service.write(
        actor_type="user",
        actor_id=user_id,
        workspace_id=workspace_id,
        action="ticket.created",
        resource_type="support_ticket",
        resource_id=ticket_id,
        metadata={
            "subject": payload.subject,
            "category": payload.category,
            "priority": payload.priority,
        },
    )

    email, _ = _user_lookup(user_id)
    if email:
        email_service.send_ticket_created(to=email, ticket_id=ticket_id, subject=payload.subject)

    return _hydrate_ticket(ticket_row, 1, ticket_row["created_at"])


def add_user_message(
    workspace_id: str,
    ticket_id: str,
    user_id: str,
    payload: TicketMessageCreate,
) -> TicketMessage:
    db = get_supabase_admin()

    ticket_res = (
        db.table("support_tickets")
        .select("*")
        .eq("id", ticket_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not ticket_res.data:
        raise NotFoundError("Ticket not found")
    ticket = ticket_res.data[0]

    if ticket["status"] == "closed":
        raise ForbiddenError("This ticket is closed. Open a new one if you need help.")

    # Validate attachment paths are scoped to this workspace + ticket so a
    # caller can't reference files outside their scope.
    prefix = f"{workspace_id}/{ticket_id}/"
    if payload.attachments:
        for att in payload.attachments:
            if not att.path.startswith(prefix):
                raise ForbiddenError("Attachment path is not scoped to this ticket")
    attachments_json = (
        [a.model_dump() for a in payload.attachments] if payload.attachments else None
    )
    msg_res = (
        db.table("support_messages")
        .insert(
            {
                "ticket_id": ticket_id,
                "sender_type": "user",
                "sender_id": user_id,
                "body": payload.body,
                "attachments": attachments_json,
                "is_internal_note": False,
            }
        )
        .execute()
    )
    if not msg_res.data:
        raise AppError("Could not save message")

    new_status = "open" if ticket["status"] in {"waiting_user", "resolved"} else ticket["status"]
    db.table("support_tickets").update(
        {"status": new_status, "updated_at": datetime.now(UTC).isoformat()}
    ).eq("id", ticket_id).execute()

    audit_service.write(
        actor_type="user",
        actor_id=user_id,
        workspace_id=workspace_id,
        action="ticket.message_added",
        resource_type="support_ticket",
        resource_id=ticket_id,
        metadata={"sender_type": "user", "status_after": new_status},
    )

    return _hydrate_message(msg_res.data[0])


def update_status(
    workspace_id: str,
    ticket_id: str,
    user_id: str,
    status: TicketStatus,
) -> Ticket:
    if status not in USER_SETTABLE_STATUSES:
        raise ForbiddenError("Workspace users can only mark tickets as resolved")

    db = get_supabase_admin()
    existing = (
        db.table("support_tickets")
        .select("*")
        .eq("id", ticket_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise NotFoundError("Ticket not found")
    ticket = existing.data[0]

    if ticket["created_by"] != user_id:
        raise ForbiddenError("Only the ticket creator can change its status")

    if ticket["status"] == status:
        return _hydrate_ticket(ticket, 0, None)

    update: dict = {"status": status, "updated_at": datetime.now(UTC).isoformat()}
    if status == "resolved":
        update["resolved_at"] = datetime.now(UTC).isoformat()

    res = db.table("support_tickets").update(update).eq("id", ticket_id).execute()
    if not res.data:
        raise NotFoundError("Ticket not found")

    audit_service.write(
        actor_type="user",
        actor_id=user_id,
        workspace_id=workspace_id,
        action="ticket.status_changed",
        resource_type="support_ticket",
        resource_id=ticket_id,
        metadata={"from": ticket["status"], "to": status},
    )

    email, _ = _user_lookup(user_id)
    if email and status == "resolved":
        email_service.send_ticket_resolved(to=email, ticket_id=ticket_id, subject=ticket["subject"])

    return _hydrate_ticket(res.data[0], 0, None)
