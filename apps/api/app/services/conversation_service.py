from datetime import UTC, datetime

from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.conversation import (
    Conversation,
    ConversationChannel,
    ConversationCreate,
    ConversationDetail,
    ConversationMessage,
    ConversationMessageCreate,
    ConversationStatus,
)
from app.models.customer import Customer
from app.services import audit_service, customer_service


def _ensure_message_counts(conversation_ids: list[str]) -> dict[str, int]:
    if not conversation_ids:
        return {}
    db = get_supabase_admin()
    res = (
        db.table("conversation_messages")
        .select("conversation_id")
        .in_("conversation_id", conversation_ids)
        .execute()
    )
    counts: dict[str, int] = {}
    for row in res.data or []:
        cid = row["conversation_id"]
        counts[cid] = counts.get(cid, 0) + 1
    return counts


def _hydrate(row: dict, message_count: int) -> Conversation:
    return Conversation(**{**row, "message_count": message_count})


def list_conversations(
    workspace_id: str,
    *,
    channel: ConversationChannel | None = None,
    status: ConversationStatus | None = None,
    limit: int = 100,
) -> list[Conversation]:
    db = get_supabase_admin()
    query = (
        db.table("conversations")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("started_at", desc=True)
        .limit(limit)
    )
    if channel:
        query = query.eq("channel", channel)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    if not res.data:
        return []

    counts = _ensure_message_counts([r["id"] for r in res.data])
    return [_hydrate(row, counts.get(row["id"], 0)) for row in res.data]


def get_conversation(workspace_id: str, conversation_id: str) -> ConversationDetail:
    db = get_supabase_admin()
    res = (
        db.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Conversation not found")
    row = res.data[0]

    msgs = (
        db.table("conversation_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    messages = [ConversationMessage.model_validate(m) for m in msgs.data or []]

    customer: Customer | None = None
    if row.get("customer_id"):
        customer = customer_service.get_customer(workspace_id, row["customer_id"])

    order_lookup = (
        db.table("orders").select("id").eq("conversation_id", conversation_id).limit(1).execute()
    )
    order_id = order_lookup.data[0]["id"] if order_lookup.data else None

    base = _hydrate(row, len(messages))
    return ConversationDetail(
        **base.model_dump(),
        messages=messages,
        customer=customer,
        order_id=order_id,
    )


def create_conversation(workspace_id: str, payload: ConversationCreate) -> Conversation:
    db = get_supabase_admin()

    customer_id: str | None = None
    if payload.customer_phone:
        from app.models.customer import CustomerUpsert

        customer = customer_service.upsert_by_phone(
            workspace_id,
            CustomerUpsert(phone=payload.customer_phone, name=payload.customer_name),
        )
        customer_id = customer.id

    res = (
        db.table("conversations")
        .insert(
            {
                "workspace_id": workspace_id,
                "location_id": payload.location_id,
                "customer_id": customer_id,
                "channel": payload.channel,
                "customer_phone": payload.customer_phone,
                "customer_name": payload.customer_name,
                "status": "active",
            }
        )
        .execute()
    )
    if not res.data:
        raise AppError("Could not create conversation")
    return _hydrate(res.data[0], 0)


def append_message(
    workspace_id: str,
    conversation_id: str,
    payload: ConversationMessageCreate,
) -> ConversationMessage:
    db = get_supabase_admin()

    # Verify conversation belongs to this workspace.
    conv = (
        db.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not conv.data:
        raise NotFoundError("Conversation not found")

    res = (
        db.table("conversation_messages")
        .insert(
            {
                "conversation_id": conversation_id,
                "role": payload.role,
                "content": payload.content,
                "audio_url": payload.audio_url,
            }
        )
        .execute()
    )
    if not res.data:
        raise AppError("Could not save message")

    db.table("conversations").update({"updated_at": datetime.now(UTC).isoformat()}).eq(
        "id", conversation_id
    ).execute()

    return ConversationMessage.model_validate(res.data[0])


def escalate_to_ticket(
    workspace_id: str,
    conversation_id: str,
    actor_id: str,
    reason: str | None,
) -> str:
    """Create a support ticket pre-filled with the conversation summary.

    Returns the new ticket id. The conversation status flips to 'escalated'.
    """
    from app.models.ticket import TicketCreate
    from app.services import ticket_service

    detail = get_conversation(workspace_id, conversation_id)
    db = get_supabase_admin()

    summary_lines = [
        f"Escalated from {detail.channel} conversation #{detail.id[:8]}.",
        "",
    ]
    if reason:
        summary_lines += [f"Reason: {reason}", ""]
    if detail.customer_name or detail.customer_phone:
        summary_lines += [
            f"Customer: {detail.customer_name or 'Unknown'}"
            + (f" ({detail.customer_phone})" if detail.customer_phone else ""),
        ]
    if detail.summary:
        summary_lines += ["", "Auto-summary:", detail.summary]
    if detail.messages:
        summary_lines += ["", "Last messages:"]
        for m in detail.messages[-5:]:
            summary_lines.append(f"[{m.role}] {m.content[:200]}")

    subject = f"Escalated {detail.channel} conversation"
    ticket = ticket_service.create_ticket(
        workspace_id,
        actor_id,
        TicketCreate(
            subject=subject,
            body="\n".join(summary_lines),
            category="other",
            priority="high",
        ),
    )

    db.table("conversations").update({"status": "escalated"}).eq("id", conversation_id).execute()

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="conversation.escalated",
        resource_type="conversation",
        resource_id=conversation_id,
        metadata={"ticket_id": ticket.id},
    )

    return ticket.id
