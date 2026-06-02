from fastapi import APIRouter, Query

from app.core.exceptions import ForbiddenError
from app.deps import WorkspaceContextDep
from app.models.customer import Customer, CustomerUpdate
from app.models.customer_detail import CustomerDetail
from app.services import customer_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["customers"])

_SORT_OPTIONS = {"last_seen", "total_orders", "total_spent_cents"}


@router.get(
    "/workspaces/{workspace_id}/customers",
    response_model=DataResponse[list[Customer]],
)
async def list_customers(
    ctx: WorkspaceContextDep,
    search: str | None = Query(default=None, max_length=200),
    sort_by: str = Query(default="last_seen"),
) -> DataResponse[list[Customer]]:
    sort_value = sort_by if sort_by in _SORT_OPTIONS else "last_seen"
    customers = customer_service.list_customers(
        ctx.workspace_id, search=search, sort_by=sort_value
    )
    return ok(customers)


@router.get(
    "/workspaces/{workspace_id}/customers/{customer_id}",
    response_model=DataResponse[CustomerDetail],
)
async def get_customer(
    customer_id: str, ctx: WorkspaceContextDep
) -> DataResponse[CustomerDetail]:
    detail = customer_service.get_customer_with_history(ctx.workspace_id, customer_id)
    return ok(detail)


@router.patch(
    "/workspaces/{workspace_id}/customers/{customer_id}",
    response_model=DataResponse[Customer],
)
async def update_customer(
    customer_id: str, payload: CustomerUpdate, ctx: WorkspaceContextDep
) -> DataResponse[Customer]:
    if ctx.role not in ("owner", "manager"):
        raise ForbiddenError("Only owners or managers can edit customers")
    customer = customer_service.update_customer(
        ctx.workspace_id,
        customer_id,
        name=payload.name,
        email=str(payload.email) if payload.email is not None else None,
        tags=payload.tags,
    )
    return ok(customer)
