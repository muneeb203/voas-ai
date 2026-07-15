from datetime import UTC, datetime
from typing import Any

from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.order import Order, OrderStatus
from app.services import audit_service


def create_manual_order(
    workspace_id: str,
    items: list[dict[str, Any]],
    location_id: str | None = None,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    fulfillment: str = "pickup",
) -> Order:
    """Create an order from the dashboard (staff-entered), priced against the
    menu via the same path the AI uses."""
    from app.services import voice_order_service

    db = get_supabase_admin()
    if not location_id:
        loc = (
            db.table("locations")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        location_id = loc.data[0]["id"] if loc.data else None

    result = voice_order_service.place_order_from_tool_call(
        workspace_id=workspace_id,
        location_id=location_id,
        conversation_id=None,
        customer_id=None,
        customer_phone=customer_phone,
        arguments={
            "items": items,
            "fulfillment": fulfillment,
            "customer_name": customer_name,
            "special_instructions": "Entered from dashboard",
        },
    )
    if not result.get("success"):
        raise AppError(result.get("message") or "Could not create the order.")
    return get_order(workspace_id, str(result["order_id"]))


def list_orders(
    workspace_id: str,
    *,
    status: OrderStatus | None = None,
    limit: int = 100,
) -> list[Order]:
    db = get_supabase_admin()
    query = (
        db.table("orders")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return [Order.model_validate(row) for row in res.data or []]


def get_order(workspace_id: str, order_id: str) -> Order:
    db = get_supabase_admin()
    res = (
        db.table("orders")
        .select("*")
        .eq("id", order_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Order not found")
    return Order.model_validate(res.data[0])


def update_order_status(
    workspace_id: str,
    order_id: str,
    new_status: OrderStatus,
    actor_id: str | None = None,
) -> Order:
    """Move an order to a new status. Workspace-scoped to prevent cross-tenant
    updates. Returns the updated row or raises NotFoundError if the order
    doesn't belong to the workspace."""
    db = get_supabase_admin()
    previous = (
        db.table("orders")
        .select("status")
        .eq("id", order_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    res = (
        db.table("orders")
        .update(
            {
                "status": new_status,
                "updated_at": datetime.now(UTC).isoformat(),
            }
        )
        .eq("id", order_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Order not found")

    # Who cancelled/fulfilled an order, and when, was previously untracked.
    audit_service.write(
        actor_type="user" if actor_id else "system",
        actor_id=actor_id or order_id,
        workspace_id=workspace_id,
        action="order.status_changed",
        resource_type="order",
        resource_id=order_id,
        metadata={
            "from": previous.data[0]["status"] if previous.data else None,
            "to": new_status,
        },
    )
    return Order.model_validate(res.data[0])
