from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

OrderStatus = Literal[
    "pending", "confirmed", "preparing", "ready", "fulfilled", "cancelled", "refunded"
]
PaymentStatus = Literal["unpaid", "paid", "partial_refund", "refunded", "failed"]


class OrderLineModifier(BaseModel):
    name: str
    price_delta_cents: int = 0


class OrderLineItem(BaseModel):
    item_id: str | None = None
    name: str
    quantity: int = Field(default=1, ge=1)
    unit_price_cents: int
    modifiers: list[OrderLineModifier] = []
    notes: str | None = None


class Order(BaseModel):
    id: str
    workspace_id: str
    location_id: str | None
    conversation_id: str | None
    customer_id: str | None
    status: OrderStatus
    total_cents: int
    subtotal_cents: int
    tax_cents: int
    tip_cents: int
    items_json: list[OrderLineItem]
    customer_phone: str | None
    customer_name: str | None
    payment_status: PaymentStatus
    pos_order_id: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
