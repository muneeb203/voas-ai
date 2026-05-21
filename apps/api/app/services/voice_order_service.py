"""Glue between Vapi tool calls and the orders table.

The Vapi assistant exposes a `place_order` function. When the customer
confirms an order, the model calls it with structured arguments. We
turn those into a real `orders` row, linked to the current conversation,
priced against the workspace's menu.
"""

from datetime import datetime, timezone
from typing import Any

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.customer import CustomerUpsert
from app.services import customer_service

log = get_logger(__name__)


def _lookup_menu_price(
    workspace_id: str, item_name: str
) -> tuple[str | None, int]:
    """Find a menu item by name (case-insensitive). Returns (item_id, price_cents).
    Returns (None, 0) if no match — order still gets created at $0 with a note.
    """
    db = get_supabase_admin()
    res = (
        db.table("menu_items")
        .select("id, name, price_cents")
        .eq("workspace_id", workspace_id)
        .ilike("name", f"%{item_name}%")
        .limit(1)
        .execute()
    )
    if res.data:
        row = res.data[0]
        return (row["id"], row["price_cents"])
    return (None, 0)


def _resolve_modifier_deltas(
    workspace_id: str, item_id: str | None, modifier_names: list[str]
) -> list[dict[str, Any]]:
    """For each requested modifier name, look up the price delta on the item.
    Falls back to 0 if not found."""
    if not item_id or not modifier_names:
        return [{"name": m, "price_delta_cents": 0} for m in modifier_names]

    db = get_supabase_admin()
    groups_res = (
        db.table("menu_modifier_groups").select("id").eq("item_id", item_id).execute()
    )
    group_ids = [g["id"] for g in groups_res.data or []]
    if not group_ids:
        return [{"name": m, "price_delta_cents": 0} for m in modifier_names]

    options_res = (
        db.table("menu_modifier_options")
        .select("name, price_delta_cents")
        .in_("group_id", group_ids)
        .execute()
    )
    by_name = {
        (o["name"] or "").lower(): o["price_delta_cents"]
        for o in options_res.data or []
    }
    return [
        {"name": m, "price_delta_cents": by_name.get(m.lower(), 0)}
        for m in modifier_names
    ]


def place_order_from_tool_call(
    *,
    workspace_id: str,
    location_id: str | None,
    conversation_id: str | None,
    customer_id: str | None,
    customer_phone: str | None,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    """Materialize a Vapi tool call into an orders row. Returns a summary
    payload to send back to Vapi as the tool result — the agent reads it
    aloud to the customer."""
    db = get_supabase_admin()

    raw_items = arguments.get("items") or []
    items_json: list[dict[str, Any]] = []
    subtotal_cents = 0

    for raw in raw_items:
        name = str(raw.get("name") or "").strip()
        if not name:
            continue
        quantity = max(1, int(raw.get("quantity") or 1))
        item_id, unit_price = _lookup_menu_price(workspace_id, name)
        modifier_names = [str(m) for m in (raw.get("modifiers") or []) if m]
        modifiers = _resolve_modifier_deltas(workspace_id, item_id, modifier_names)
        modifier_total = sum(int(m["price_delta_cents"]) for m in modifiers)

        line_total = (unit_price + modifier_total) * quantity
        subtotal_cents += line_total

        items_json.append(
            {
                "item_id": item_id,
                "name": name,
                "quantity": quantity,
                "unit_price_cents": unit_price + modifier_total,
                "modifiers": modifiers,
                "notes": raw.get("notes"),
            }
        )

    if not items_json:
        return {
            "success": False,
            "message": "I couldn't capture any items from the order — could you list them one more time?",
        }

    # Simple tax estimate: 8% of subtotal. (V2 Sprint 4 uses POS-provided tax.)
    tax_cents = round(subtotal_cents * 0.08)
    total_cents = subtotal_cents + tax_cents

    # Upsert customer if we have a phone but no id yet.
    if not customer_id and customer_phone:
        customer = customer_service.upsert_by_phone(
            workspace_id,
            CustomerUpsert(
                phone=customer_phone,
                name=str(arguments.get("customer_name") or "").strip() or None,
            ),
        )
        customer_id = customer.id

    fulfillment = str(arguments.get("fulfillment") or "pickup").lower()
    special = str(arguments.get("special_instructions") or "").strip() or None
    notes = (
        f"Fulfillment: {fulfillment}." + (f" {special}" if special else "")
    )

    order_res = (
        db.table("orders")
        .insert(
            {
                "workspace_id": workspace_id,
                "location_id": location_id,
                "conversation_id": conversation_id,
                "customer_id": customer_id,
                "status": "confirmed",
                "subtotal_cents": subtotal_cents,
                "tax_cents": tax_cents,
                "tip_cents": 0,
                "total_cents": total_cents,
                "items_json": items_json,
                "customer_phone": customer_phone,
                "customer_name": str(arguments.get("customer_name") or "").strip() or None,
                "payment_status": "unpaid",
                "notes": notes,
            }
        )
        .execute()
    )
    if not order_res.data:
        log.error("voice_order_create_failed", workspace_id=workspace_id)
        return {
            "success": False,
            "message": "Something went wrong saving the order. A team member will follow up.",
        }

    order = order_res.data[0]

    # Tag the conversation with outcome.
    if conversation_id:
        db.table("conversations").update(
            {
                "outcome": "order_placed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", conversation_id).execute()

    log.info(
        "voice_order_placed",
        workspace_id=workspace_id,
        order_id=order["id"],
        items=len(items_json),
        total_cents=total_cents,
    )

    return {
        "success": True,
        "order_id": order["id"],
        "total_dollars": round(total_cents / 100, 2),
        "items_count": sum(int(i["quantity"]) for i in items_json),
        "message": (
            f"Order confirmed for {fulfillment}. "
            f"{sum(int(i['quantity']) for i in items_json)} items, total "
            f"${total_cents / 100:.2f}."
        ),
    }
