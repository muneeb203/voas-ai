from datetime import UTC, datetime

from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.ticket import (
    Ticket,
    TicketMessage,
    TicketStatus,
    TicketWithMessages,
)
from app.services import audit_service, email_service, ticket_service

AdminMessageBody = dict[str, str | bool]


def list_all_tickets(
    *,
    status: TicketStatus | None = None,
    priority: str | None = None,
    workspace_id: str | None = None,
    assigned_admin_id: str | None = None,
    limit: int = 100,
) -> list[Ticket]:
    db = get_supabase_admin()
    query = db.table("support_tickets").select("*").order("updated_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status)
    if priority:
        query = query.eq("priority", priority)
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    if assigned_admin_id:
        query = query.eq("assigned_admin_id", assigned_admin_id)

    res = query.execute()
    if not res.data:
        return []

    ticket_ids = [r["id"] for r in res.data]
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
        ticket_service._hydrate_ticket(row, counts.get(row["id"], 0), latest.get(row["id"]))
        for row in res.data
    ]


def get_ticket(ticket_id: str) -> TicketWithMessages:
    """Admin view: includes internal notes."""
    db = get_supabase_admin()
    res = db.table("support_tickets").select("workspace_id").eq("id", ticket_id).limit(1).execute()
    if not res.data:
        raise NotFoundError("Ticket not found")
    return ticket_service.get_ticket(res.data[0]["workspace_id"], ticket_id, include_internal=True)


def reply(
    ticket_id: str,
    admin_id: str,
    body: str,
    *,
    is_internal_note: bool = False,
) -> TicketMessage:
    db = get_supabase_admin()

    ticket_res = db.table("support_tickets").select("*").eq("id", ticket_id).limit(1).execute()
    if not ticket_res.data:
        raise NotFoundError("Ticket not found")
    ticket = ticket_res.data[0]

    msg_res = (
        db.table("support_messages")
        .insert(
            {
                "ticket_id": ticket_id,
                "sender_type": "admin",
                "sender_id": admin_id,
                "body": body,
                "is_internal_note": is_internal_note,
            }
        )
        .execute()
    )
    if not msg_res.data:
        raise AppError("Could not save message")

    if not is_internal_note:
        # Status logic: if was 'open' or 'in_progress', move to 'waiting_user'.
        new_status = (
            "waiting_user" if ticket["status"] in {"open", "in_progress"} else ticket["status"]
        )
        db.table("support_tickets").update(
            {"status": new_status, "updated_at": datetime.now(UTC).isoformat()}
        ).eq("id", ticket_id).execute()

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=ticket["workspace_id"],
        action="admin.ticket.replied" if not is_internal_note else "admin.ticket.note_added",
        resource_type="support_ticket",
        resource_id=ticket_id,
        metadata={"is_internal_note": is_internal_note},
    )

    if not is_internal_note:
        creator_email, _ = ticket_service._user_lookup(ticket["created_by"])
        if creator_email:
            email_service.send_ticket_admin_replied(
                to=creator_email, ticket_id=ticket_id, subject=ticket["subject"]
            )

    return ticket_service._hydrate_message(msg_res.data[0])


def update_status(ticket_id: str, admin_id: str, status: TicketStatus) -> Ticket:
    db = get_supabase_admin()
    res = db.table("support_tickets").select("*").eq("id", ticket_id).limit(1).execute()
    if not res.data:
        raise NotFoundError("Ticket not found")
    ticket = res.data[0]

    update: dict = {"status": status, "updated_at": datetime.now(UTC).isoformat()}
    if status == "resolved":
        update["resolved_at"] = datetime.now(UTC).isoformat()

    updated = db.table("support_tickets").update(update).eq("id", ticket_id).execute()

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=ticket["workspace_id"],
        action="admin.ticket.status_changed",
        resource_type="support_ticket",
        resource_id=ticket_id,
        metadata={"from": ticket["status"], "to": status},
    )
    return ticket_service._hydrate_ticket(updated.data[0], 0, None)


def assign(ticket_id: str, admin_id: str, assignee_admin_id: str | None) -> Ticket:
    db = get_supabase_admin()
    res = db.table("support_tickets").select("*").eq("id", ticket_id).limit(1).execute()
    if not res.data:
        raise NotFoundError("Ticket not found")
    ticket = res.data[0]

    updated = (
        db.table("support_tickets")
        .update({"assigned_admin_id": assignee_admin_id})
        .eq("id", ticket_id)
        .execute()
    )

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=ticket["workspace_id"],
        action="admin.ticket.assigned",
        resource_type="support_ticket",
        resource_id=ticket_id,
        metadata={"to_admin_id": assignee_admin_id},
    )
    return ticket_service._hydrate_ticket(updated.data[0], 0, None)
