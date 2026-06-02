from datetime import datetime, timezone

from app.core.exceptions import NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.conversation import Conversation
from app.models.customer import Customer, CustomerUpsert
from app.models.customer_detail import CustomerDetail
from app.models.order import Order

_SORT_COLUMNS = {"last_seen", "total_orders", "total_spent_cents"}


def list_customers(
    workspace_id: str,
    *,
    search: str | None = None,
    sort_by: str = "last_seen",
    limit: int = 100,
) -> list[Customer]:
    db = get_supabase_admin()
    sort_column = sort_by if sort_by in _SORT_COLUMNS else "last_seen"

    query = (
        db.table("customers")
        .select("*")
        .eq("workspace_id", workspace_id)
    )

    if search:
        # Strip commas so they can't break PostgREST's `or` expression parsing.
        term = search.replace(",", " ").strip()
        if term:
            query = query.or_(f"name.ilike.*{term}*,phone.ilike.*{term}*")

    res = query.order(sort_column, desc=True).limit(limit).execute()
    return [Customer.model_validate(row) for row in res.data or []]


def _message_counts(conversation_ids: list[str]) -> dict[str, int]:
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


def get_customer_with_history(workspace_id: str, customer_id: str) -> CustomerDetail:
    """Customer profile plus their 10 most recent orders + conversations."""
    customer = get_customer(workspace_id, customer_id)
    if customer is None:
        raise NotFoundError("Customer not found")

    db = get_supabase_admin()

    orders_res = (
        db.table("orders")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    recent_orders = [Order.model_validate(row) for row in orders_res.data or []]

    conv_res = (
        db.table("conversations")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("customer_id", customer_id)
        .order("started_at", desc=True)
        .limit(10)
        .execute()
    )
    conv_rows = conv_res.data or []
    counts = _message_counts([r["id"] for r in conv_rows])
    recent_conversations = [
        Conversation(**{**row, "message_count": counts.get(row["id"], 0)})
        for row in conv_rows
    ]

    return CustomerDetail(
        **customer.model_dump(),
        recent_orders=recent_orders,
        recent_conversations=recent_conversations,
    )


def update_customer(
    workspace_id: str,
    customer_id: str,
    name: str | None,
    email: str | None,
    tags: list[str] | None,
) -> Customer:
    db = get_supabase_admin()

    updates: dict = {}
    if name is not None:
        updates["name"] = name
    if email is not None:
        updates["email"] = email
    if tags is not None:
        updates["tags"] = tags

    if not updates:
        existing = get_customer(workspace_id, customer_id)
        if existing is None:
            raise NotFoundError("Customer not found")
        return existing

    res = (
        db.table("customers")
        .update(updates)
        .eq("id", customer_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Customer not found")
    return Customer.model_validate(res.data[0])


def get_customer(workspace_id: str, customer_id: str) -> Customer | None:
    db = get_supabase_admin()
    res = (
        db.table("customers")
        .select("*")
        .eq("id", customer_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return Customer.model_validate(res.data[0])


def upsert_by_phone(workspace_id: str, payload: CustomerUpsert) -> Customer:
    """Find-or-create a customer by phone within the workspace.

    Bumps last_seen on every call. Voice and WhatsApp webhooks will
    call this on every inbound interaction in V2 Sprint 2+.
    """
    db = get_supabase_admin()
    now_iso = datetime.now(timezone.utc).isoformat()

    if payload.phone:
        existing = (
            db.table("customers")
            .select("*")
            .eq("workspace_id", workspace_id)
            .eq("phone", payload.phone)
            .limit(1)
            .execute()
        )
        if existing.data:
            updates: dict = {"last_seen": now_iso}
            if payload.name:
                updates["name"] = payload.name
            if payload.email:
                updates["email"] = payload.email
            if payload.tags:
                updates["tags"] = payload.tags
            res = (
                db.table("customers")
                .update(updates)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
            return Customer.model_validate(res.data[0])

    res = (
        db.table("customers")
        .insert(
            {
                "workspace_id": workspace_id,
                "phone": payload.phone,
                "name": payload.name,
                "email": payload.email,
                "tags": payload.tags,
                "first_seen": now_iso,
                "last_seen": now_iso,
            }
        )
        .execute()
    )
    return Customer.model_validate(res.data[0])
