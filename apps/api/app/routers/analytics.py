from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query

from app.deps import WorkspaceContextDep
from app.models.analytics import AnalyticsSummary, TodayStats
from app.services import analytics_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["analytics"])


@router.get(
    "/workspaces/{workspace_id}/analytics/summary",
    response_model=DataResponse[AnalyticsSummary],
)
async def get_summary(
    ctx: WorkspaceContextDep,
    days: int = Query(default=30, ge=1, le=365),
) -> DataResponse[AnalyticsSummary]:
    since = datetime.now(UTC) - timedelta(days=days)
    return ok(analytics_service.get_summary(ctx.workspace_id, since))


@router.get(
    "/workspaces/{workspace_id}/analytics/today",
    response_model=DataResponse[TodayStats],
)
async def get_today(ctx: WorkspaceContextDep) -> DataResponse[TodayStats]:
    return ok(analytics_service.get_today_stats(ctx.workspace_id))
