from datetime import datetime, timezone

from app.core.supabase import get_supabase_admin
from app.models.customer import Customer, CustomerUpsert


def list_customers(workspace_id: str, limit: int = 100) -> list[Customer]:
    db = get_supabase_admin()
    res = (
        db.table("customers")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("last_seen", desc=True)
        .limit(limit)
        .execute()
    )
    return [Customer.model_validate(row) for row in res.data or []]


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
