from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from app.deps import WorkspaceContextDep
from app.models.conversation import (
    Conversation,
    ConversationChannel,
    ConversationCreate,
    ConversationDetail,
    ConversationMessage,
    ConversationMessageCreate,
    ConversationStatus,
    EscalationRequest,
)
from app.services import conversation_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["conversations"])


@router.get(
    "/workspaces/{workspace_id}/conversations",
    response_model=DataResponse[list[Conversation]],
)
async def list_conversations(
    ctx: WorkspaceContextDep,
    channel: ConversationChannel | None = Query(default=None),
    status_filter: ConversationStatus | None = Query(default=None, alias="status"),
) -> DataResponse[list[Conversation]]:
    conversations = conversation_service.list_conversations(
        ctx.workspace_id, channel=channel, status=status_filter
    )
    return ok(conversations)


@router.get(
    "/workspaces/{workspace_id}/conversations/{conversation_id}",
    response_model=DataResponse[ConversationDetail],
)
async def get_conversation(
    conversation_id: str, ctx: WorkspaceContextDep
) -> DataResponse[ConversationDetail]:
    detail = conversation_service.get_conversation(ctx.workspace_id, conversation_id)
    return ok(detail)


@router.post(
    "/workspaces/{workspace_id}/conversations",
    response_model=DataResponse[Conversation],
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate, ctx: WorkspaceContextDep
) -> DataResponse[Conversation]:
    """V2 Sprint 2+ wires this to Vapi / Twilio webhooks. For now it
    accepts manual creation so tests and dev seed scripts work."""
    conversation = conversation_service.create_conversation(ctx.workspace_id, payload)
    return ok(conversation)


@router.post(
    "/workspaces/{workspace_id}/conversations/{conversation_id}/messages",
    response_model=DataResponse[ConversationMessage],
    status_code=status.HTTP_201_CREATED,
)
async def append_message(
    conversation_id: str,
    payload: ConversationMessageCreate,
    ctx: WorkspaceContextDep,
) -> DataResponse[ConversationMessage]:
    message = conversation_service.append_message(ctx.workspace_id, conversation_id, payload)
    return ok(message)


class EscalationResponse(BaseModel):
    ticket_id: str


@router.post(
    "/workspaces/{workspace_id}/conversations/{conversation_id}/escalate",
    response_model=DataResponse[EscalationResponse],
)
async def escalate(
    conversation_id: str, payload: EscalationRequest, ctx: WorkspaceContextDep
) -> DataResponse[EscalationResponse]:
    ticket_id = conversation_service.escalate_to_ticket(
        ctx.workspace_id, conversation_id, ctx.user.id, payload.reason
    )
    return ok(EscalationResponse(ticket_id=ticket_id))
