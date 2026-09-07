from fastapi import APIRouter, BackgroundTasks, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field

from app.deps import WorkspaceContextDep
from app.models.order import Order, OrderStatus
from app.services import order_confirmation_service, order_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["orders"])


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class ManualOrderItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1, le=99)


class ManualOrderInput(BaseModel):
    items: list[ManualOrderItem] = Field(..., min_length=1)
    location_id: str | None = None
    customer_name: str | None = Field(default=None, max_length=160)
    customer_phone: str | None = Field(default=None, max_length=40)
    fulfillment: str = "pickup"


@router.post(
    "/workspaces/{workspace_id}/orders",
    response_model=DataResponse[Order],
    status_code=http_status.HTTP_201_CREATED,
)
async def create_order(
    payload: ManualOrderInput,
    ctx: WorkspaceContextDep,
    background_tasks: BackgroundTasks,
) -> DataResponse[Order]:
    order = order_service.create_manual_order(
        ctx.workspace_id,
        items=[{"name": i.name, "quantity": i.quantity} for i in payload.items],
        location_id=payload.location_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        fulfillment=payload.fulfillment,
    )
    # Same confirmation the voice agent sends — fired after the response so
    # Twilio latency never slows the staff member's save. The service itself
    # no-ops when confirmations are off or there's no customer phone.
    background_tasks.add_task(
        order_confirmation_service.send_order_confirmation,
        workspace_id=ctx.workspace_id,
        location_id=order.location_id,
        customer_phone=order.customer_phone,
        customer_name=order.customer_name,
        order_id=order.id,
        items_json=[{"name": i.name, "quantity": i.quantity} for i in order.items_json],
        total_cents=order.total_cents,
        fulfillment=payload.fulfillment,
    )
    return ok(order)


@router.get("/workspaces/{workspace_id}/orders", response_model=DataResponse[list[Order]])
async def list_orders(
    ctx: WorkspaceContextDep,
    status_filter: OrderStatus | None = Query(default=None, alias="status"),
) -> DataResponse[list[Order]]:
    orders = order_service.list_orders(ctx.workspace_id, status=status_filter)
    return ok(orders)


@router.get("/workspaces/{workspace_id}/orders/{order_id}", response_model=DataResponse[Order])
async def get_order(order_id: str, ctx: WorkspaceContextDep) -> DataResponse[Order]:
    order = order_service.get_order(ctx.workspace_id, order_id)
    return ok(order)


@router.patch(
    "/workspaces/{workspace_id}/orders/{order_id}/status",
    response_model=DataResponse[Order],
)
async def update_status(
    order_id: str,
    payload: OrderStatusUpdate,
    ctx: WorkspaceContextDep,
) -> DataResponse[Order]:
    order = order_service.update_order_status(
        ctx.workspace_id, order_id, payload.status, actor_id=ctx.user.id
    )
    return ok(order)
