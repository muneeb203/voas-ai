from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.deps import WorkspaceContextDep
from app.models.order import Order, OrderStatus
from app.services import order_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["orders"])


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


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
