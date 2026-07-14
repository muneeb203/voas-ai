from fastapi import APIRouter, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field

from app.deps import WorkspaceContextDep
from app.models.order import Order, OrderStatus
from app.services import order_service
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
async def create_order(payload: ManualOrderInput, ctx: WorkspaceContextDep) -> DataResponse[Order]:
    order = order_service.create_manual_order(
        ctx.workspace_id,
        items=[{"name": i.name, "quantity": i.quantity} for i in payload.items],
        location_id=payload.location_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
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
    order = order_service.update_order_status(ctx.workspace_id, order_id, payload.status)
    return ok(order)
