from fastapi import APIRouter

from app.deps import WorkspaceContextDep
from app.models.help import HelpChatReply, HelpChatRequest
from app.services import help_bot_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["help"])


@router.post(
    "/workspaces/{workspace_id}/help/chat",
    response_model=DataResponse[HelpChatReply],
)
async def help_chat(
    ctx: WorkspaceContextDep,
    payload: HelpChatRequest,
) -> DataResponse[HelpChatReply]:
    return ok(
        help_bot_service.chat(ctx.workspace_id, ctx.user.id, payload),
    )
