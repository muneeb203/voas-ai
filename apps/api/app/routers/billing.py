from fastapi import APIRouter

from app.deps import ManagerContextDep
from app.models.billing import CreditGrant, UsageSummary
from app.services import billing_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["billing"])


@router.get(
    "/workspaces/{workspace_id}/billing/usage",
    response_model=DataResponse[UsageSummary],
)
async def get_billing_usage(ctx: ManagerContextDep) -> DataResponse[UsageSummary]:
    return ok(billing_service.get_usage_summary(ctx.workspace_id))


@router.get(
    "/workspaces/{workspace_id}/billing/grants",
    response_model=DataResponse[list[CreditGrant]],
)
async def list_billing_grants(ctx: ManagerContextDep) -> DataResponse[list[CreditGrant]]:
    return ok(billing_service.list_grants(ctx.workspace_id))
