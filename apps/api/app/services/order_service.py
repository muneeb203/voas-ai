from app.core.exceptions import NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.order import Order, OrderStatus


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
